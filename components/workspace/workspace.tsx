"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch } from "react"
import { signOut } from "next-auth/react"
import { Check, LogOut } from "lucide-react"
import { api, ApiError, type JobEvent } from "@/lib/api"
import { interpolate, studentVars } from "@/lib/template"
import { Logo } from "@/components/logo"
import { cx } from "@/components/ui"
import { plural } from "./shared"
import { STEP_ORDER, deriveRows, initialFlow, labelOf, persist, reducer, PERIODOS, type Action, type Flow, type Row, type StepId } from "./state"
import { StepNapsis } from "./step-napsis"
import { StepAlumnos } from "./step-alumnos"
import { StepMensaje } from "./step-mensaje"
import { StepRevisar } from "./step-revisar"

const TITLES: Record<StepId, string> = {
  napsis: "Curso en Napsis",
  alumnos: "Alumnos",
  mensaje: "Mensaje",
  revisar: "Crear borradores",
}

/** Escucha el avance del proceso por SSE; si se corta, recupera el estado y se vuelve a conectar. */
function useJobEvents(jobId: string | null, active: boolean, dispatch: Dispatch<Action>) {
  useEffect(() => {
    if (!jobId || !active) return
    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let failures = 0

    const recover = () => {
      timer = setTimeout(async () => {
        if (stopped) return
        try {
          const snap = await api.job(jobId)
          failures = 0
          dispatch({ type: "snapshot", job: snap })
          if (snap.status === "running") connect()
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            dispatch({
              type: "job",
              status: "failed",
              message: "El servicio se reinició y se perdió el detalle del proceso. Revisa tus borradores en Gmail y reintenta los pendientes.",
            })
          } else if (++failures < 20) {
            recover()
          }
        }
      }, Math.min(2000 * (failures + 1), 10000))
    }

    const connect = () => {
      es = new EventSource(api.eventsUrl(jobId))
      es.onmessage = (e) => {
        const ev = JSON.parse(e.data) as JobEvent
        if (ev.type === "snapshot") dispatch({ type: "snapshot", job: ev.job })
        else dispatch(ev)
        const status = ev.type === "snapshot" ? ev.job.status : ev.type === "job" ? ev.status : "running"
        if (status !== "running") {
          stopped = true
          es?.close()
        }
      }
      es.onerror = () => {
        es?.close()
        if (!stopped) recover()
      }
    }

    connect()
    return () => {
      stopped = true
      es?.close()
      clearTimeout(timer)
    }
  }, [jobId, active, dispatch])
}

function reachable(step: StepId, flow: Flow, rows: Row[]): boolean {
  const included = rows.some((r) => r.included)
  switch (step) {
    case "napsis":
      return true
    case "alumnos":
      return !!flow.roster
    case "mensaje":
      return !!flow.roster && included
    case "revisar":
      return (!!flow.roster && included && !!flow.asunto.trim() && !!flow.cuerpo.trim()) || !!flow.jobStatus
  }
}

function summary(step: StepId, flow: Flow, rows: Row[]): string | null {
  switch (step) {
    case "napsis":
      return flow.roster ? `${flow.courseLabel} · ${labelOf(PERIODOS, flow.config.periodo)}` : flow.sessionId ? "Conectado, falta elegir curso" : null
    case "alumnos":
      return flow.parse ? `${rows.filter((r) => r.included).length} de ${rows.length} seleccionados` : null
    case "mensaje":
    {
      const first = rows.find((r) => r.included)
      return flow.parse && first ? interpolate(flow.asunto, studentVars(first.student)) : null
    }
    case "revisar": {
      if (!flow.jobStatus) return null
      const ok = Object.values(flow.results).filter((r) => r.status === "success").length
      return flow.jobStatus === "running" ? `En curso · ${ok} listos` : plural(ok, "borrador creado", "borradores creados")
    }
  }
}

function isDone(step: StepId, flow: Flow, rows: Row[]) {
  switch (step) {
    case "napsis":
      return !!flow.roster
    case "alumnos":
      return rows.some((r) => r.included)
    case "mensaje":
      return !!flow.parse && !!flow.asunto.trim() && !!flow.cuerpo.trim() && (flow.step === "revisar" || !!flow.jobStatus)
    case "revisar":
      return flow.jobStatus === "done"
  }
}

export default function Workspace({ email, name }: { email: string; name: string }) {
  const [flow, dispatch] = useReducer(reducer, undefined, initialFlow)
  const rows = useMemo(() => deriveRows(flow), [flow])
  const running = flow.jobStatus === "running"
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => persist(flow), [flow])
  useJobEvents(flow.jobId, running, dispatch)

  // Si se recarga con un proceso terminado en "revisar", seguir ahí; si se perdió el curso, volver al inicio
  const step: StepId = reachable(flow.step, flow, rows) ? flow.step : "napsis"

  const go = useCallback((s: StepId) => {
    dispatch({ type: "patch", patch: { step: s } })
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0 })
      window.scrollTo({ top: 0 })
      mainRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true })
    })
  }, [])

  // Avisar si se cierra la pestaña mientras corre el proceso
  useEffect(() => {
    if (!running) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [running])

  async function logout() {
    if (flow.sessionId) await api.closeSession(flow.sessionId).catch(() => {})
    sessionStorage.clear()
    await signOut({ callbackUrl: "/" })
  }

  const props = { flow, dispatch, rows, go, email }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface px-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <span className="hidden max-w-[16rem] truncate text-[0.8125rem] text-ink-2 sm:inline" title={email}>
            {name || email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] text-ink-2 hover:bg-panel hover:text-ink"
          >
            <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <nav aria-label="Pasos" className="border-b border-line bg-panel lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:border-r lg:border-b-0">
          <ol className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:gap-0.5 lg:px-3 lg:py-6">
            {STEP_ORDER.map((s, i) => {
              const can = reachable(s, flow, rows) && (!running || s === "revisar")
              const current = s === step
              const done = isDone(s, flow, rows) && !current
              const sub = summary(s, flow, rows)
              return (
                <li key={s} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => can && go(s)}
                    disabled={!can}
                    aria-current={current ? "step" : undefined}
                    className={cx(
                      "group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
                      current ? "bg-surface shadow-[0_1px_2px_oklch(0.23_0.02_255/0.08)]" : can ? "hover:bg-surface/70" : "cursor-not-allowed"
                    )}
                  >
                    <span
                      className={cx(
                        "tabular mt-px grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-200",
                        done ? "bg-accent text-white" : current ? "bg-ink text-white" : "border border-line-strong text-ink-3"
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cx("block text-sm font-medium", current || can ? "text-ink" : "text-ink-3")}>{TITLES[s]}</span>
                      {sub && <span className="mt-0.5 hidden truncate text-xs text-ink-2 lg:block">{sub}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="hidden px-6 text-xs leading-5 text-ink-3 lg:block">La contraseña de Napsis no se guarda. El trabajo de esta pestaña se recupera si recargas.</p>
        </nav>

        <main ref={mainRef} className="min-w-0 px-5 pt-8 sm:px-8 lg:pt-10">
          <div className="mx-auto max-w-6xl">
            {step === "napsis" && <StepNapsis {...props} />}
            {step === "alumnos" && <StepAlumnos {...props} />}
            {step === "mensaje" && <StepMensaje {...props} />}
            {step === "revisar" && <StepRevisar {...props} />}
          </div>
        </main>
      </div>
    </div>
  )
}
