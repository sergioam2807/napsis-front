"use client"

import { useState } from "react"
import { ArrowRight, Eye, EyeOff, LogIn, RefreshCw, School } from "lucide-react"
import { api, ApiError, type NapsisOptions } from "@/lib/api"
import { computeDv, formatLoginRut, isValidLoginRut, loginRut, parseLoginRut } from "@/lib/rut"
import { Button, Field, Notice, Select, inputClass } from "@/components/ui"
import { ApiErrorNotice, StepFooter, StepHeader, plural, type StepProps } from "./shared"
import { PERIODOS, RELIGION, labelOf, type Flow } from "./state"

type Loading = null | "connect" | "grado" | "curso" | "roster"

/** Ajusta la configuración a lo que Napsis ofrece, respetando la última elección si sigue disponible. */
function fitConfig(flow: Flow, o: NapsisOptions) {
  const curso = o.curso.some((c) => c.value === flow.config.curso) ? flow.config.curso : (o.curso[0]?.value ?? "")
  return { ...flow.config, tipoEns: o.selected.tipoEns, grado: o.selected.grado, curso }
}

export function StepNapsis({ flow, dispatch, go }: StepProps) {
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [editColegio, setEditColegio] = useState(false)
  const [loading, setLoading] = useState<Loading>(null)
  const [error, setError] = useState<unknown>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [rutTouched, setRutTouched] = useState(false)

  const parsedRut = parseLoginRut(flow.rut)
  const rutError =
    !rutTouched || flow.rut.trim() === ""
      ? null
      : !parsedRut.body
        ? "Revisa el RUT: no se entiende el número."
        : parsedRut.dv && computeDv(parsedRut.body) !== parsedRut.dv
          ? "Revisa el RUT: el dígito verificador no coincide."
          : null
  const connected = !!flow.sessionId && !!flow.options
  const cfg = flow.config
  const cfgKey = `${cfg.tipoEns}|${cfg.grado}|${cfg.curso}`
  const rosterFresh = !!flow.roster && flow.rosterFor === cfgKey

  function onSessionError(err: unknown) {
    if (err instanceof ApiError && err.napsisExpired) {
      dispatch({ type: "patch", patch: { sessionId: null, options: null } })
      setLoginError(null)
    }
    setError(err)
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setRutTouched(true)
    if (!isValidLoginRut(flow.rut) || !password) return
    setLoading("connect")
    setError(null)
    setLoginError(null)
    try {
      // Napsis espera el número sin dígito verificador.
      const rut = loginRut(flow.rut)
      const res = await api.openSession(rut, password, flow.colegio.trim())
      let options = res.options
      // Recuperar el último tipo de enseñanza / grado usado si existe en esta cuenta
      const want = flow.config
      const hasTipo = options.tipoEns.some((o) => o.value === want.tipoEns)
      if (hasTipo && (want.tipoEns !== options.selected.tipoEns || want.grado !== options.selected.grado)) {
        options = await api.options(res.sessionId, want.tipoEns, want.grado).catch(() => options)
      }
      dispatch({ type: "patch", patch: { rut, colegio: res.colegio, sessionId: res.sessionId, options, config: fitConfig(flow, options) } })
      setPassword("")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && !err.googleExpired) setLoginError(err.message)
      else setError(err)
    } finally {
      setLoading(null)
    }
  }

  async function changeCascade(level: "tipoEns" | "grado", value: string) {
    if (!flow.sessionId) return
    setLoading(level === "tipoEns" ? "grado" : "curso")
    setError(null)
    const next = level === "tipoEns" ? { tipoEns: value, grado: undefined } : { tipoEns: cfg.tipoEns, grado: value }
    dispatch({ type: "patch", patch: { config: { ...cfg, ...(level === "tipoEns" ? { tipoEns: value } : { grado: value }) } } })
    try {
      const options = await api.options(flow.sessionId, next.tipoEns, next.grado)
      dispatch({ type: "patch", patch: { options, config: { ...fitConfig(flow, options), curso: options.curso[0]?.value ?? "" } } })
    } catch (err) {
      onSessionError(err)
    } finally {
      setLoading(null)
    }
  }

  async function loadRoster() {
    if (!flow.sessionId || !flow.options) return
    if (rosterFresh) return go("alumnos")
    setLoading("roster")
    setError(null)
    try {
      const { students } = await api.roster(flow.sessionId, cfg)
      if (!students.length) {
        setError(new ApiError("Napsis no muestra alumnos en ese curso. Revisa el grado y el curso.", 0))
        return
      }
      const o = flow.options
      // Napsis suele nombrar el curso con el grado incluido ("3° Básico A"); no repetirlo
      const grado = labelOf(o.grado, cfg.grado)
      const curso = labelOf(o.curso, cfg.curso)
      const courseLabel = curso.toLowerCase().includes(grado.toLowerCase()) ? curso : [grado, curso].filter(Boolean).join(" ")
      dispatch({ type: "course", roster: students, courseLabel, rosterFor: cfgKey })
      go("alumnos")
    } catch (err) {
      onSessionError(err)
    } finally {
      setLoading(null)
    }
  }

  async function disconnect() {
    if (flow.sessionId) void api.closeSession(flow.sessionId).catch(() => {})
    dispatch({ type: "patch", patch: { sessionId: null, options: null } })
  }

  // ── Sin conexión ────────────────────────────────────────────────
  if (!connected) {
    return (
      <>
        <StepHeader title="Conectar con Napsis">
          Ingresa con tu cuenta de Napsis para elegir el curso. La contraseña se usa solo mientras trabajas y no se guarda.
        </StepHeader>

        {flow.roster && (
          <Notice tone="info" className="mb-6 max-w-xl">
            La conexión con Napsis se cerró por inactividad. Vuelve a ingresar tu contraseña; tu curso ({flow.courseLabel}) y tus alumnos se mantienen.
          </Notice>
        )}

        <form onSubmit={connect} className="flex max-w-md flex-col gap-5" noValidate>
          <Field
            label="RUT"
            hint={
              rutError
                ? undefined
                : parsedRut.body
                  ? `Se enviará a Napsis como ${parsedRut.body}, sin dígito verificador.`
                  : "Sin dígito verificador, ej. 17.791.339"
            }
            error={rutError}
          >
            {(p) => (
              <input
                {...p}
                className={`${inputClass} tabular`}
                value={flow.rut}
                onChange={(e) => dispatch({ type: "patch", patch: { rut: e.target.value } })}
                onBlur={() => {
                  setRutTouched(true)
                  if (isValidLoginRut(flow.rut)) dispatch({ type: "patch", patch: { rut: formatLoginRut(flow.rut) } })
                }}
                autoComplete="username"
                inputMode="text"
                placeholder="17.791.339"
                autoFocus={!flow.rut}
              />
            )}
          </Field>

          <Field label="Contraseña de Napsis" error={loginError}>
            {(p) => (
              <div className="relative">
                <input
                  {...p}
                  type={showPass ? "text" : "password"}
                  className={`${inputClass} pr-11`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setLoginError(null)
                  }}
                  autoComplete="current-password"
                  autoFocus={!!flow.rut}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-panel hover:text-ink"
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
                </button>
              </div>
            )}
          </Field>

          <div className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
            <School className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
            {editColegio ? (
              <Field label="Código del colegio en Napsis" hint="Es la parte de la dirección snd.napsis.cl/código/…" className="flex-1">
                {(p) => (
                  <input {...p} className={inputClass} value={flow.colegio} onChange={(e) => dispatch({ type: "patch", patch: { colegio: e.target.value.trim() } })} />
                )}
              </Field>
            ) : (
              <>
                <span>
                  Colegio: <span className="font-medium text-ink">{flow.colegio}</span>
                </span>
                <button type="button" className="text-accent underline hover:text-accent-strong" onClick={() => setEditColegio(true)}>
                  Cambiar
                </button>
              </>
            )}
          </div>

          {error ? <ApiErrorNotice error={error} /> : null}

          <div>
            <Button type="submit" variant="primary" icon={LogIn} loading={loading === "connect"} disabled={!flow.rut || !password}>
              {loading === "connect" ? "Conectando con Napsis…" : "Conectar con Napsis"}
            </Button>
            {loading === "connect" && <p className="mt-2 text-xs text-ink-3">Suele tardar entre 10 y 20 segundos.</p>}
          </div>
        </form>
      </>
    )
  }

  // ── Conectado: elegir curso ─────────────────────────────────────
  const o = flow.options!
  return (
    <>
      <StepHeader
        title="Elegir el curso"
        aside={
          <p className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
            <span className="size-2 rounded-full bg-accent" aria-hidden />
            Conectado como <span className="tabular font-medium text-ink">{formatLoginRut(flow.rut)}</span>
            <button type="button" onClick={disconnect} className="text-accent underline hover:text-accent-strong">
              Cambiar cuenta
            </button>
          </p>
        }
      >
        Los informes se generan con estas opciones para todos los alumnos del curso.
      </StepHeader>

      <div className="grid max-w-3xl gap-x-5 gap-y-5 sm:grid-cols-2">
        <Field label="Tipo de enseñanza">
          {(p) => <Select {...p} value={cfg.tipoEns} options={o.tipoEns} onChange={(e) => changeCascade("tipoEns", e.target.value)} disabled={!!loading} />}
        </Field>
        <Field label="Grado">
          {(p) => (
            <Select {...p} value={cfg.grado} options={o.grado} loading={loading === "grado"} onChange={(e) => changeCascade("grado", e.target.value)} disabled={!!loading} />
          )}
        </Field>
        <Field label="Curso" className="sm:col-span-2">
          {(p) =>
            o.curso.length || loading ? (
              <Select
                {...p}
                value={cfg.curso}
                options={o.curso}
                loading={loading === "grado" || loading === "curso"}
                onChange={(e) => dispatch({ type: "patch", patch: { config: { ...cfg, curso: e.target.value } } })}
                disabled={!!loading}
              />
            ) : (
              <p className="text-sm text-ink-2">Este grado no tiene cursos disponibles en tu cuenta.</p>
            )
          }
        </Field>

        <div className="border-t border-line pt-5 sm:col-span-2">
          <p className="text-[0.8125rem] font-medium text-ink">Formato del informe</p>
        </div>
        <Field label="Período">
          {(p) => <Select {...p} value={cfg.periodo} options={PERIODOS} onChange={(e) => dispatch({ type: "patch", patch: { config: { ...cfg, periodo: e.target.value } } })} />}
        </Field>
        <Field label="Nota de religión">
          {(p) => <Select {...p} value={cfg.religion} options={RELIGION} onChange={(e) => dispatch({ type: "patch", patch: { config: { ...cfg, religion: e.target.value } } })} />}
        </Field>
      </div>

      {error ? (
        <div className="mt-6 max-w-3xl">
          <ApiErrorNotice error={error} onRetry={loadRoster} />
        </div>
      ) : null}

      <StepFooter
        status={
          loading === "roster"
            ? "Leyendo el listado del curso en Napsis…"
            : rosterFresh
              ? `${plural(flow.roster!.length, "alumno", "alumnos")} en ${flow.courseLabel}`
              : "Se leerá el listado de alumnos del curso."
        }
      >
        {rosterFresh && (
          <Button variant="quiet" icon={RefreshCw} onClick={() => dispatch({ type: "patch", patch: { rosterFor: "" } })} disabled={!!loading}>
            Volver a leer
          </Button>
        )}
        <Button variant="primary" iconRight={ArrowRight} onClick={loadRoster} loading={loading === "roster"} disabled={!cfg.curso || (!!loading && loading !== "roster")}>
          {rosterFresh ? "Continuar" : "Cargar alumnos del curso"}
        </Button>
      </StepFooter>
    </>
  )
}
