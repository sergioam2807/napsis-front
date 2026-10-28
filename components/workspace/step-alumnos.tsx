"use client"

import { useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Search, Upload } from "lucide-react"
import { downloadTemplate, readStudentsFile } from "@/lib/excel"
import { FIELD_LABELS, normalizeText, type Field } from "@/lib/students"
import { nombreCompleto } from "@/lib/template"
import { Button, Notice, cx, inputClass } from "@/components/ui"
import { RosterTable } from "./roster-table"
import { StepFooter, StepHeader, plural, type StepProps } from "./shared"
import { unmatchedRoster, type Row } from "./state"

type Filter = "todos" | "revisar" | "listos" | "excluidos"

export function StepAlumnos({ flow, dispatch, rows, go }: StepProps) {
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [filter, setFilter] = useState<Filter>("todos")
  const [query, setQuery] = useState("")
  const [showColumns, setShowColumns] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parse = flow.parse
  const free = useMemo(() => unmatchedRoster(flow, rows), [flow, rows])
  const counts = useMemo(() => {
    const revisar = rows.filter((r) => r.blocked || r.issues.length > 0).length
    return {
      todos: rows.length,
      revisar,
      listos: rows.filter((r) => r.included).length,
      excluidos: rows.filter((r) => !r.included).length,
    }
  }, [rows])

  const visible = useMemo(() => {
    const q = normalizeText(query)
    const byFilter = (r: Row) =>
      filter === "todos" ? true : filter === "revisar" ? r.blocked || r.issues.length > 0 : filter === "listos" ? r.included : !r.included
    const byQuery = (r: Row) => {
      if (!q) return true
      const s = r.student
      return normalizeText(`${nombreCompleto(s)} ${s.rut} ${s.nombreApoderado} ${s.correoApoderado} ${s.emailAlumno}`).includes(q)
    }
    return rows.filter((r) => byFilter(r) && byQuery(r))
  }, [rows, filter, query])

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setFileError("Ese archivo no es un Excel. Usa un .xlsx, .xls o .csv.")
      return
    }
    setReading(true)
    setFileError(null)
    try {
      const result = await readStudentsFile(file)
      if (!result.students.length) {
        const missing = result.missingColumns.map((f) => FIELD_LABELS[f]).join(", ")
        setFileError(
          result.missingColumns.length
            ? `No encontramos las columnas ${missing}. Revisa que la primera fila del Excel tenga los encabezados.`
            : "El Excel no tiene filas con alumnos."
        )
        return
      }
      dispatch({ type: "excel", fileName: file.name, parse: result })
      setFilter("todos")
    } catch {
      setFileError("No pudimos leer el archivo. Ábrelo en Excel, guárdalo como .xlsx e inténtalo de nuevo.")
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" tabIndex={-1} onChange={(e) => handleFile(e.target.files?.[0])} />
  )

  // ── Sin archivo: zona para soltar ───────────────────────────────
  if (!parse) {
    return (
      <>
        <StepHeader title="Alumnos y apoderados">
          Sube el Excel con los correos. Lo cruzamos con los {plural(flow.roster?.length ?? 0, "alumno", "alumnos")} de {flow.courseLabel || "tu curso"} en Napsis.
        </StepHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void handleFile(e.dataTransfer.files?.[0])
          }}
          className={cx(
            "flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center transition-[background-color,border-color] duration-150",
            dragOver ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:border-ink-3 hover:bg-ground"
          )}
          aria-describedby="excel-help"
          disabled={reading}
        >
          <span className={cx("grid size-12 place-items-center rounded-full", dragOver ? "bg-surface text-accent" : "bg-panel text-ink-2")}>
            <Upload className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-[0.9375rem] font-medium text-ink">{reading ? "Leyendo el archivo…" : "Arrastra el Excel aquí o haz clic para elegirlo"}</span>
          <span id="excel-help" className="text-[0.8125rem] text-ink-3">
            .xlsx, .xls o .csv · se lee en tu navegador
          </span>
        </button>
        {fileInput}

        {fileError && (
          <Notice tone="danger" className="mt-4" live>
            {fileError}
          </Notice>
        )}

        <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[0.8125rem] font-medium text-ink">Columnas que buscamos</p>
            <p className="mt-1 text-[0.8125rem] leading-6 text-ink-2">
              {Object.values(FIELD_LABELS).join(" · ")}. El orden no importa y los nombres pueden variar un poco.
            </p>
          </div>
          <div className="self-center">
            <Button variant="secondary" size="sm" icon={Download} onClick={() => void downloadTemplate()}>
              Descargar plantilla
            </Button>
          </div>
        </div>

        <StepFooter status="Paso 2 de 4">
          <Button variant="quiet" icon={ArrowLeft} onClick={() => go("napsis")}>
            Curso
          </Button>
        </StepFooter>
      </>
    )
  }

  // ── Con archivo: revisión ───────────────────────────────────────
  const missingOptional = (["emailAlumno", "nombreApoderado"] as Field[]).filter((f) => !parse.columns[f])
  const tabs: { id: Filter; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "revisar", label: "Por revisar" },
    { id: "listos", label: "Seleccionados" },
    { id: "excluidos", label: "No se enviarán" },
  ]

  return (
    <>
      <StepHeader title="Alumnos y apoderados">
        Revisa quiénes recibirán el informe. Puedes corregir un correo con un clic o asignar a mano un alumno que no calzó.
      </StepHeader>

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <FileSpreadsheet className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{flow.fileName}</p>
          <p className="text-xs text-ink-3">
            {plural(parse.students.length, "fila", "filas")} con alumnos
            {parse.ignoredRows > 0 && ` · ${plural(parse.ignoredRows, "fila ignorada", "filas ignoradas")}`}
            {" · "}
            <button type="button" className="text-accent underline hover:text-accent-strong" onClick={() => setShowColumns((v) => !v)} aria-expanded={showColumns}>
              {showColumns ? "Ocultar columnas" : "Ver columnas detectadas"}
            </button>
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={Upload} onClick={() => inputRef.current?.click()} loading={reading}>
          Reemplazar archivo
        </Button>
        {fileInput}
        {showColumns && (
          <dl className="grid w-full gap-x-6 gap-y-1 border-t border-line pt-3 text-xs sm:grid-cols-2">
            {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
              <div key={f} className="flex justify-between gap-3">
                <dt className="text-ink-3">{FIELD_LABELS[f]}</dt>
                <dd className={parse.columns[f] ? "truncate text-ink" : "text-warn"}>{parse.columns[f] ?? "No encontrada"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {fileError && (
          <Notice tone="danger" live>
            {fileError}
          </Notice>
        )}
        {missingOptional.length > 0 && (
          <Notice tone="warn">
            No encontramos la columna {missingOptional.map((f) => FIELD_LABELS[f]).join(" ni ")}. Puedes seguir, pero esos datos quedarán vacíos.
          </Notice>
        )}
        {parse.duplicates.length > 0 && <Notice tone="warn">RUT repetido en el Excel: {parse.duplicates.join(", ")}. Revisa que no sean el mismo alumno.</Notice>}
        {free.length > 0 && (
          <Notice tone="info">
            {plural(free.length, "alumno", "alumnos")} de {flow.courseLabel} no {free.length === 1 ? "está" : "están"} en tu Excel:{" "}
            <span className="text-ink">{free.slice(0, 6).map((r) => r.label).join(", ")}</span>
            {free.length > 6 && ` y ${free.length - 6} más`}.
          </Notice>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filtrar alumnos" className="flex flex-wrap gap-1 rounded-lg bg-panel p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={cx(
                "flex h-8 items-center gap-2 rounded-md px-3 text-[0.8125rem] font-medium transition-colors duration-150",
                filter === t.id ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.23_0.02_255/0.08)]" : "text-ink-2 hover:text-ink"
              )}
            >
              {t.label}
              <span className={cx("tabular text-xs", t.id === "revisar" && counts.revisar > 0 ? "text-warn" : "text-ink-3")}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Buscar alumno</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
          <input className={`${inputClass} h-9 pl-9`} placeholder="Buscar por nombre, RUT o correo" value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
        </label>
      </div>

      <RosterTable
        rows={visible}
        mode="review"
        dispatch={dispatch}
        freeRoster={free}
        emptyText={query ? "Ningún alumno coincide con la búsqueda." : filter === "revisar" ? "Nada por revisar. Todos los alumnos están listos." : "Sin alumnos en esta vista."}
      />

      <StepFooter
        status={
          <>
            <span className="tabular font-semibold text-ink">{counts.listos}</span> de {plural(rows.length, "alumno", "alumnos")} recibirán el informe
          </>
        }
      >
        <Button variant="quiet" icon={ArrowLeft} onClick={() => go("napsis")}>
          Curso
        </Button>
        <Button variant="primary" iconRight={ArrowRight} onClick={() => go("mensaje")} disabled={counts.listos === 0}>
          Redactar mensaje
        </Button>
      </StepFooter>
    </>
  )
}
