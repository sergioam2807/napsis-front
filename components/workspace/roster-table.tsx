"use client"

import { useRef, useState } from "react"
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  FileDown,
  Loader2,
  MailPlus,
  Pencil,
  SkipForward,
  UserSearch,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { StudentStatus } from "@/lib/api"
import { formatRut } from "@/lib/rut"
import { isEmail, type RosterEntry } from "@/lib/students"
import { nombreCompleto } from "@/lib/template"
import { Chip, cx } from "@/components/ui"
import type { Action, Row } from "./state"

const STATUS: Record<StudentStatus, { label: string; tone: "neutral" | "accent" | "warn" | "danger" | "progress"; icon: LucideIcon; spin?: boolean }> = {
  pending: { label: "En cola", tone: "neutral", icon: Clock },
  downloading: { label: "Descargando PDF", tone: "progress", icon: FileDown },
  drafting: { label: "Creando borrador", tone: "progress", icon: MailPlus },
  success: { label: "Borrador creado", tone: "accent", icon: CheckCircle2 },
  failed: { label: "Falló", tone: "danger", icon: XCircle },
  skipped: { label: "Omitido", tone: "neutral", icon: SkipForward },
}

export function StatusChip({ status }: { status: StudentStatus }) {
  const s = STATUS[status]
  return (
    <Chip tone={s.tone} icon={status === "downloading" || status === "drafting" ? Loader2 : s.icon} spin={status === "downloading" || status === "drafting"}>
      {s.label}
    </Chip>
  )
}

/** Correo editable en línea: clic para editar, Enter guarda, Esc cancela. */
function EmailCell({ value, onSave, label, invalidLabel }: { value: string; onSave: (v: string) => void; label: string; invalidLabel: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const invalid = value !== "" && !isEmail(value)

  if (editing) {
    const commit = () => {
      setEditing(false)
      if (draft.trim() !== value) onSave(draft)
    }
    return (
      <input
        ref={ref}
        autoFocus
        type="email"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        className="h-8 w-full min-w-44 rounded-md border border-accent bg-surface px-2 text-[0.8125rem] ring-3 ring-accent/15 outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={cx(
        "group/email -mx-1.5 flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[0.8125rem] hover:bg-panel",
        invalid ? "text-danger" : value ? "text-ink-2" : "text-ink-3 italic"
      )}
      aria-label={`${label}: ${value || "vacío"}. Editar`}
      title={invalid ? invalidLabel : "Editar"}
    >
      <span className="truncate">{value || "Agregar correo"}</span>
      <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover/email:opacity-100 group-focus-visible/email:opacity-100" strokeWidth={2} aria-hidden />
    </button>
  )
}

function AssignSelect({ row, free, dispatch }: { row: Row; free: RosterEntry[]; dispatch: React.Dispatch<Action> }) {
  const options = row.match ? [row.match, ...free] : free
  return (
    <label className="flex items-center gap-1.5">
      <UserSearch className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
      <span className="sr-only">Asignar alumno de Napsis a {nombreCompleto(row.student)}</span>
      <select
        value={row.match?.value ?? ""}
        onChange={(e) => dispatch({ type: "match", key: row.student.key, value: e.target.value || null })}
        className="h-7 max-w-52 cursor-pointer rounded-md border border-line-strong bg-surface px-1.5 text-xs text-ink hover:border-ink-3"
      >
        <option value="">Asignar alumno de Napsis…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

type Props = {
  rows: Row[]
  mode: "review" | "progress"
  dispatch: React.Dispatch<Action>
  freeRoster?: RosterEntry[]
  emptyText: string
}

export function RosterTable({ rows, mode, dispatch, freeRoster = [], emptyText }: Props) {
  const selectable = rows.filter((r) => !r.blocked)
  const allOn = selectable.length > 0 && selectable.every((r) => r.included)
  const someOn = selectable.some((r) => r.included)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="max-h-[min(62dvh,40rem)] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-panel text-xs font-medium text-ink-2">
            <tr className="[&>th]:border-b [&>th]:border-line [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
              {mode === "review" && (
                <th className="w-10 !pr-0">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-[var(--color-accent)]"
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = someOn && !allOn
                    }}
                    onChange={(e) => dispatch({ type: "toggleMany", keys: selectable.map((r) => r.student.key), include: e.target.checked })}
                    aria-label="Seleccionar todos los alumnos listos"
                    disabled={!selectable.length}
                  />
                </th>
              )}
              <th>Alumno</th>
              <th>Apoderado (Para)</th>
              <th>Alumno (CC)</th>
              <th className="w-[15rem]">{mode === "review" ? "Revisión" : "Estado"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-3">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const s = row.student
              const dim = mode === "review" && !row.included
              return (
                <tr
                  key={s.key}
                  className={cx(
                    "align-top transition-colors duration-150 [&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-2.5 last:[&>td]:border-b-0",
                    mode === "review" && row.included && "bg-surface hover:bg-ground",
                    dim && "bg-ground/60"
                  )}
                >
                  {mode === "review" && (
                    <td className="!pr-0">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent)] disabled:cursor-not-allowed"
                        checked={row.included}
                        disabled={row.blocked}
                        onChange={(e) => dispatch({ type: "toggle", key: s.key, include: e.target.checked })}
                        aria-label={`Incluir a ${nombreCompleto(s)}`}
                      />
                    </td>
                  )}
                  <td className={cx("min-w-[13rem]", dim && "opacity-60")}>
                    <p className="font-medium text-ink">{nombreCompleto(s) || <span className="text-ink-3 italic">Sin nombre</span>}</p>
                    <p className="tabular mt-0.5 text-xs whitespace-nowrap text-ink-3">
                      {s.rut ? formatRut(s.rut) : "Sin RUT"} · fila {s.row}
                    </p>
                  </td>
                  <td className="max-w-[16rem]">
                    <p className={cx("truncate text-[0.8125rem] text-ink", dim && "opacity-60")}>{s.nombreApoderado || <span className="text-ink-3 italic">Sin nombre</span>}</p>
                    {mode === "review" ? (
                      <EmailCell
                        value={s.correoApoderado}
                        label={`Correo del apoderado de ${nombreCompleto(s)}`}
                        invalidLabel="Correo inválido"
                        onSave={(v) => dispatch({ type: "edit", key: s.key, field: "correoApoderado", value: v })}
                      />
                    ) : (
                      <p className="truncate text-[0.8125rem] text-ink-2">{s.correoApoderado}</p>
                    )}
                  </td>
                  <td className="max-w-[14rem]">
                    {mode === "review" ? (
                      <EmailCell
                        value={s.emailAlumno}
                        label={`Correo del alumno ${nombreCompleto(s)}`}
                        invalidLabel="Correo inválido: no irá con copia"
                        onSave={(v) => dispatch({ type: "edit", key: s.key, field: "emailAlumno", value: v })}
                      />
                    ) : (
                      <p className="truncate text-[0.8125rem] text-ink-2">{isEmail(s.emailAlumno) ? s.emailAlumno : "Sin copia"}</p>
                    )}
                  </td>
                  <td>
                    {mode === "progress" ? (
                      row.result ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusChip status={row.result.status} />
                          {row.result.message && (row.result.status === "failed" || row.result.status === "skipped") && (
                            <p className="text-xs leading-4 text-ink-2">{row.result.message}</p>
                          )}
                        </div>
                      ) : (
                        <Chip>No incluido</Chip>
                      )
                    ) : (
                      <ReviewCell row={row} free={freeRoster} dispatch={dispatch} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReviewCell({ row, free, dispatch }: { row: Row; free: RosterEntry[]; dispatch: React.Dispatch<Action> }) {
  const blocks = row.issues.filter((i) => i.severity === "block")
  const warns = row.issues.filter((i) => i.severity === "warn")
  const needsAssign = row.issues.some((i) => i.code === "no_match") || row.match?.by === "manual" || row.match?.by === "nombre"

  return (
    <div className="flex flex-col items-start gap-1.5">
      {blocks.length === 0 && warns.length === 0 && (
        <Chip tone="accent" icon={Check}>
          Listo
        </Chip>
      )}
      {blocks.map((i) => (
        <Chip key={i.code} tone="danger" icon={Ban} title={i.text}>
          {i.text}
        </Chip>
      ))}
      {blocks.length === 0 && warns.length > 0 && (
        <Chip tone="warn" icon={AlertTriangle} title={warns.map((w) => w.text).join(". ")}>
          {warns.length === 1 ? warns[0].text : `Listo, con ${warns.length} avisos`}
        </Chip>
      )}
      {blocks.length === 0 && warns.length > 1 && (
        <ul className="text-xs leading-4 text-ink-2">
          {warns.map((w) => (
            <li key={w.code}>{w.text}</li>
          ))}
        </ul>
      )}
      {needsAssign && <AssignSelect row={row} free={free} dispatch={dispatch} />}
      {row.match && row.match.by !== "rut" && <p className="text-xs text-ink-3">En Napsis: {row.match.label}</p>}
    </div>
  )
}
