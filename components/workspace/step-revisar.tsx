"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ExternalLink, KeyRound, MailPlus, RotateCw, Square, SquarePlus } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { isEmail } from "@/lib/students"
import { interpolate, studentVars } from "@/lib/template"
import { Button, Field, Notice, cx, inputClass } from "@/components/ui"
import { RosterTable } from "./roster-table"
import { ApiErrorNotice, StepFooter, StepHeader, plural, type StepProps } from "./shared"
import { PERIODOS, RELIGION, labelOf, toPayload, type Row } from "./state"

const SECONDS_PER_STUDENT = 15

export function StepRevisar({ flow, dispatch, rows, go, email }: StepProps) {
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [password, setPassword] = useState("")
  const [reconnecting, setReconnecting] = useState(false)
  const [onlyProblems, setOnlyProblems] = useState(false)

  const included = rows.filter((r) => r.included)
  const inJob = rows.filter((r) => r.result)
  const started = !!flow.jobStatus
  const running = flow.jobStatus === "running"

  const tally = useMemo(() => {
    const t = { success: 0, failed: 0, skipped: 0, active: 0, pending: 0 }
    for (const r of inJob) {
      const s = r.result!.status
      if (s === "success") t.success++
      else if (s === "failed") t.failed++
      else if (s === "skipped") t.skipped++
      else if (s === "pending") t.pending++
      else t.active++
    }
    return t
  }, [inJob])
  const done = tally.success + tally.failed + tally.skipped
  const retryable = inJob.filter((r) => (r.result!.status === "failed" || r.result!.status === "skipped") && !r.blocked)

  async function start(target: Row[]) {
    if (!flow.sessionId) return
    setStarting(true)
    setError(null)
    try {
      const { jobId } = await api.startJob({
        sessionId: flow.sessionId,
        students: target.map(toPayload),
        asunto: flow.asunto,
        cuerpo: flow.cuerpo,
        napsisConfig: flow.config,
      })
      dispatch({ type: "jobStarted", jobId, keys: target.map((r) => r.student.key) })
      setOnlyProblems(false)
    } catch (err) {
      if (err instanceof ApiError && err.napsisExpired) dispatch({ type: "patch", patch: { sessionId: null, options: null } })
      setError(err)
    } finally {
      setStarting(false)
    }
  }

  async function cancel() {
    if (!flow.jobId) return
    setCancelling(true)
    try {
      await api.cancelJob(flow.jobId)
    } catch (err) {
      setError(err)
    } finally {
      setCancelling(false)
    }
  }

  async function reconnect(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setReconnecting(true)
    setError(null)
    try {
      const res = await api.openSession(flow.rut, password, flow.colegio)
      dispatch({ type: "patch", patch: { sessionId: res.sessionId, options: flow.options ?? res.options } })
      setPassword("")
    } catch (err) {
      setError(err)
    } finally {
      setReconnecting(false)
    }
  }

  const needsReconnect = !flow.sessionId && !running
  const reconnectForm = needsReconnect && (
    <form onSubmit={reconnect} className="mb-6 flex max-w-xl flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
        <p className="text-[0.8125rem] leading-5 text-ink-2">
          La conexión con Napsis se cerró. Ingresa tu contraseña para {started ? "reintentar" : "crear los borradores"}; no hay que repetir los pasos anteriores.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Contraseña de Napsis" className="min-w-56 flex-1">
          {(p) => <input {...p} type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />}
        </Field>
        <Button type="submit" variant="secondary" loading={reconnecting} disabled={!password}>
          Reconectar
        </Button>
      </div>
    </form>
  )

  // ── Antes de empezar ────────────────────────────────────────────
  if (!started) {
    const withCc = included.filter((r) => isEmail(r.student.emailAlumno)).length
    const minutes = Math.max(1, Math.round((included.length * SECONDS_PER_STUDENT) / 60))
    const sample = included[0] ? interpolate(flow.asunto, studentVars(included[0].student)) : ""
    const summary: [string, React.ReactNode][] = [
      ["Curso", flow.courseLabel],
      ["Informe", `${labelOf(PERIODOS, flow.config.periodo)} · religión ${labelOf(RELIGION, flow.config.religion).toLowerCase()}`],
      ["Destinatarios", `${plural(included.length, "apoderado", "apoderados")}, ${withCc} con copia al alumno`],
      ["Asunto", sample],
      ["Borradores en", email],
    ]

    return (
      <>
        <StepHeader title="Revisar y crear borradores">
          Nada se envía: cada correo queda en Borradores de tu Gmail para que lo revises y lo envíes tú.
        </StepHeader>

        {reconnectForm}

        <dl className="max-w-3xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {summary.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-[0.8125rem] text-ink-3">{k}</dt>
              <dd className="min-w-0 truncate text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 max-w-3xl text-[0.8125rem] leading-6 text-ink-2">
          Toma cerca de {plural(minutes, "minuto", "minutos")}. Puedes seguir usando el computador; si recargas esta página, el avance se recupera.
        </p>

        {error ? (
          <div className="mt-5 max-w-3xl">
            <ApiErrorNotice error={error} />
          </div>
        ) : null}

        <StepFooter status={<>Se crearán <span className="tabular font-semibold text-ink">{included.length}</span> borradores</>}>
          <Button variant="quiet" icon={ArrowLeft} onClick={() => go("mensaje")}>
            Mensaje
          </Button>
          <Button variant="primary" icon={MailPlus} onClick={() => start(included)} loading={starting} disabled={!included.length || !flow.sessionId}>
            Crear {plural(included.length, "borrador", "borradores")}
          </Button>
        </StepFooter>
      </>
    )
  }

  // ── En curso / terminado ────────────────────────────────────────
  const total = inJob.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const problems = tally.failed + tally.skipped
  const visible = onlyProblems ? inJob.filter((r) => r.result!.status === "failed" || r.result!.status === "skipped") : inJob
  const gmailDrafts = `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#drafts`

  const title = running ? "Creando borradores" : flow.jobStatus === "cancelled" ? "Proceso cancelado" : problems ? "Terminado, con pendientes" : "Borradores listos"

  return (
    <>
      <StepHeader title={title}>{running ? "Cada fila cambia a verde cuando su borrador ya está en Gmail." : flow.jobMessage}</StepHeader>

      {reconnectForm}

      <div className="mb-6 rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-sm text-ink-2" aria-live="polite">
            <span className="tabular text-[2rem] leading-none font-semibold tracking-[-0.02em] text-ink">{tally.success}</span>
            <span className="tabular ml-1.5 text-base text-ink-3">/ {total}</span>
            <span className="ml-3">{plural(tally.success, "borrador creado", "borradores creados")}</span>
            {tally.failed > 0 && <span className="ml-3 text-danger">{plural(tally.failed, "falló", "fallaron")}</span>}
            {tally.skipped > 0 && <span className="ml-3 text-ink-3">{plural(tally.skipped, "omitido", "omitidos")}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button variant="danger" size="sm" icon={Square} onClick={cancel} loading={cancelling}>
                Cancelar
              </Button>
            ) : (
              <>
                <a
                  href={gmailDrafts}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-2 rounded-lg bg-accent px-3 text-[0.8125rem] font-medium text-white transition-colors duration-150 hover:bg-accent-strong"
                >
                  Abrir Borradores en Gmail
                  <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
                </a>
                {retryable.length > 0 && (
                  <Button size="sm" variant="secondary" icon={RotateCw} onClick={() => start(retryable)} loading={starting} disabled={!flow.sessionId}>
                    Reintentar {plural(retryable.length, "pendiente", "pendientes")}
                  </Button>
                )}
                <Button size="sm" variant="quiet" icon={SquarePlus} onClick={() => dispatch({ type: "newCourse" })}>
                  Procesar otro curso
                </Button>
              </>
            )}
          </div>
        </div>

        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Avance del proceso"
        >
          <div className={cx("h-full rounded-full transition-[width] duration-500 ease-out", problems && !running ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-ink-3">{running ? flow.jobMessage : `${pct}% procesado`}</p>
      </div>

      {error ? (
        <div className="mb-4">
          <ApiErrorNotice error={error} />
        </div>
      ) : null}

      {!running && problems > 0 && (
        <Notice tone="warn" className="mb-4">
          Revisa el motivo de cada fila con problemas. Si fue un error pasajero de Napsis, usa “Reintentar”; los borradores ya creados no se duplican.
        </Notice>
      )}

      {problems > 0 && (
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          Mostrar solo los que tienen problemas
        </label>
      )}

      <RosterTable rows={visible} mode="progress" dispatch={dispatch} emptyText="Sin alumnos en esta vista." />
    </>
  )
}
