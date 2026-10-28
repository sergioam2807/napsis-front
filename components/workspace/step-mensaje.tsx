"use client"

import { useRef, useState } from "react"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Paperclip, Plus, RotateCcw } from "lucide-react"
import { isEmail } from "@/lib/students"
import { VARIABLES, interpolate, nombreCompleto, reportFilename, studentVars, suggestVariable, unknownVariables } from "@/lib/template"
import { Button, Field, Notice, inputClass } from "@/components/ui"
import { StepFooter, StepHeader, type StepProps } from "./shared"

type Target = "asunto" | "cuerpo"

export function StepMensaje({ flow, dispatch, rows, go, email }: StepProps) {
  const included = rows.filter((r) => r.included)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [target, setTarget] = useState<Target>("cuerpo")
  const asuntoRef = useRef<HTMLInputElement>(null)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)

  const idx = Math.min(previewIdx, Math.max(0, included.length - 1))
  const row = included[idx]
  const vars = row ? studentVars(row.student) : {}
  const unknown = unknownVariables(flow.asunto, flow.cuerpo)

  function insert(variable: string) {
    const token = `{${variable}}`
    const el = target === "asunto" ? asuntoRef.current : cuerpoRef.current
    const value = target === "asunto" ? flow.asunto : flow.cuerpo
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    dispatch({ type: "patch", patch: { [target]: next } })
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }

  function fixVariable(wrong: string, right: string) {
    const re = new RegExp(`\\{${wrong}\\}`, "g")
    dispatch({ type: "patch", patch: { asunto: flow.asunto.replace(re, `{${right}}`), cuerpo: flow.cuerpo.replace(re, `{${right}}`) } })
  }

  return (
    <>
      <StepHeader title="Mensaje">
        Un mismo texto para todos, personalizado con los datos de cada alumno. Se guarda en este navegador para la próxima vez.
      </StepHeader>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Editor */}
        <div className="flex flex-col gap-5">
          <Field label="Asunto">
            {(p) => (
              <input
                {...p}
                ref={asuntoRef}
                className={inputClass}
                value={flow.asunto}
                onFocus={() => setTarget("asunto")}
                onChange={(e) => dispatch({ type: "patch", patch: { asunto: e.target.value } })}
                aria-invalid={!flow.asunto.trim() || undefined}
              />
            )}
          </Field>

          <div>
            <p className="mb-2 text-[0.8125rem] text-ink-2">
              Insertar en el {target === "asunto" ? "asunto" : "cuerpo"}:
            </p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  // mousedown evita que el campo pierda la posición del cursor antes de insertar
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(v.key)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 text-[0.8125rem] font-medium text-accent-strong transition-colors duration-150 hover:border-accent hover:bg-[oklch(0.92_0.04_165)]"
                >
                  <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Cuerpo"
            action={
              <button
                type="button"
                onClick={() => dispatch({ type: "resetMessage" })}
                className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
              >
                <RotateCcw className="size-3" strokeWidth={2} aria-hidden />
                Restaurar texto sugerido
              </button>
            }
          >
            {(p) => (
              <textarea
                {...p}
                ref={cuerpoRef}
                rows={12}
                className={`${inputClass} h-auto resize-y py-2.5 leading-6`}
                value={flow.cuerpo}
                onFocus={() => setTarget("cuerpo")}
                onChange={(e) => dispatch({ type: "patch", patch: { cuerpo: e.target.value } })}
                aria-invalid={!flow.cuerpo.trim() || undefined}
              />
            )}
          </Field>

          {unknown.map((u) => {
            const s = suggestVariable(u)
            return (
              <Notice
                key={u}
                tone="warn"
                live
                action={
                  s ? (
                    <Button size="sm" variant="secondary" onClick={() => fixVariable(u, s)}>
                      Cambiar a {`{${s}}`}
                    </Button>
                  ) : undefined
                }
              >
                <code className="font-mono text-xs">{`{${u}}`}</code> no es una variable, así que aparecerá tal cual en el correo.
              </Notice>
            )
          })}
        </div>

        {/* Vista previa */}
        <section aria-label="Vista previa del correo" className="xl:sticky xl:top-6 xl:self-start">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[0.8125rem] font-medium text-ink">Vista previa</p>
            {included.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-ink-2">
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md hover:bg-panel disabled:opacity-40"
                  onClick={() => setPreviewIdx(Math.max(0, idx - 1))}
                  disabled={idx === 0}
                  aria-label="Alumno anterior"
                >
                  <ChevronLeft className="size-4" strokeWidth={1.75} />
                </button>
                <span className="tabular min-w-16 text-center">
                  {idx + 1} de {included.length}
                </span>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md hover:bg-panel disabled:opacity-40"
                  onClick={() => setPreviewIdx(Math.min(included.length - 1, idx + 1))}
                  disabled={idx >= included.length - 1}
                  aria-label="Alumno siguiente"
                >
                  <ChevronRight className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>

          <article className="overflow-hidden rounded-xl border border-line bg-surface">
            <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 border-b border-line bg-panel/60 px-4 py-3 text-[0.8125rem]">
              <dt className="text-ink-3">De</dt>
              <dd className="truncate text-ink-2">{email}</dd>
              <dt className="text-ink-3">Para</dt>
              <dd className="truncate text-ink">{row ? `${row.student.nombreApoderado || "Apoderado"} <${row.student.correoApoderado}>` : "—"}</dd>
              <dt className="text-ink-3">CC</dt>
              <dd className="truncate text-ink-2">{row && isEmail(row.student.emailAlumno) ? row.student.emailAlumno : "Sin copia"}</dd>
              <dt className="text-ink-3">Asunto</dt>
              <dd className="font-medium text-ink">{interpolate(flow.asunto, vars) || <span className="text-danger">Falta el asunto</span>}</dd>
            </dl>
            <div className="max-h-[26rem] overflow-auto px-4 py-4">
              <p className="max-w-[65ch] text-sm leading-6 whitespace-pre-wrap text-ink">{interpolate(flow.cuerpo, vars)}</p>
            </div>
            {row && (
              <div className="border-t border-line px-4 py-3">
                <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-ground px-2.5 py-1.5 text-xs text-ink-2">
                  <Paperclip className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden />
                  {reportFilename(row.student)}
                </span>
              </div>
            )}
          </article>
          {row && <p className="mt-2 text-xs text-ink-3">Así verá el correo el apoderado de {nombreCompleto(row.student)}.</p>}
        </section>
      </div>

      <StepFooter status="Paso 3 de 4">
        <Button variant="quiet" icon={ArrowLeft} onClick={() => go("alumnos")}>
          Alumnos
        </Button>
        <Button variant="primary" iconRight={ArrowRight} onClick={() => go("revisar")} disabled={!flow.asunto.trim() || !flow.cuerpo.trim()}>
          Revisar y crear
        </Button>
      </StepFooter>
    </>
  )
}
