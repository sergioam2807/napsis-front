import type { JobSnapshot, JobStatus, NapsisConfig, NapsisOptions, StudentStatus } from "@/lib/api"
import { ASUNTO_DEFAULT, CUERPO_DEFAULT } from "@/lib/template"
import {
  isBlocked,
  isEmail,
  matchRoster,
  reviewStudent,
  type Issue,
  type Match,
  type ParseResult,
  type RosterEntry,
  type Student,
} from "@/lib/students"

export type StepId = "napsis" | "alumnos" | "mensaje" | "revisar"
export const STEP_ORDER: StepId[] = ["napsis", "alumnos", "mensaje", "revisar"]

export const PERIODOS = [
  { value: "1", label: "1° semestre" },
  { value: "2", label: "2° semestre" },
  { value: "A", label: "Anual" },
]
export const RELIGION = [
  { value: "1", label: "Conceptual abreviada" },
  { value: "2", label: "Conceptual detallada" },
  { value: "3", label: "Numérica" },
]

export type Result = { status: StudentStatus; message: string }

export type Flow = {
  step: StepId
  // Napsis
  rut: string
  colegio: string
  sessionId: string | null
  options: NapsisOptions | null
  config: NapsisConfig
  /** Curso confirmado (etiqueta legible) y su listado de alumnos. */
  courseLabel: string
  roster: RosterEntry[] | null
  /** "tipoEns|grado|curso" del listado cargado, para saber si hay que recargarlo. */
  rosterFor: string
  // Alumnos
  fileName: string | null
  parse: ParseResult | null
  edits: Record<string, Partial<Pick<Student, "correoApoderado" | "emailAlumno">>>
  manualMatches: Record<string, string | null>
  excluded: string[]
  // Mensaje
  asunto: string
  cuerpo: string
  // Proceso
  jobId: string | null
  jobStatus: JobStatus | null
  jobMessage: string
  results: Record<string, Result>
}

type Prefs = Pick<Flow, "rut" | "colegio" | "asunto" | "cuerpo"> & { config: Partial<NapsisConfig> }

const FLOW_KEY = "napsis.flow.v2"
const PREFS_KEY = "napsis.prefs.v2"

export const DEFAULT_COLEGIO = process.env.NEXT_PUBLIC_DEFAULT_COLEGIO || "rayencaven"

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function initialFlow(): Flow {
  const prefs = typeof window !== "undefined" ? readJson<Prefs>(localStorage, PREFS_KEY) : null
  const base: Flow = {
    step: "napsis",
    rut: prefs?.rut ?? "",
    colegio: prefs?.colegio || DEFAULT_COLEGIO,
    sessionId: null,
    options: null,
    config: {
      tipoEns: prefs?.config?.tipoEns ?? "",
      grado: prefs?.config?.grado ?? "",
      curso: prefs?.config?.curso ?? "",
      periodo: prefs?.config?.periodo || PERIODOS[0].value,
      religion: prefs?.config?.religion || RELIGION[1].value,
    },
    courseLabel: "",
    roster: null,
    rosterFor: "",
    fileName: null,
    parse: null,
    edits: {},
    manualMatches: {},
    excluded: [],
    asunto: prefs?.asunto || ASUNTO_DEFAULT,
    cuerpo: prefs?.cuerpo || CUERPO_DEFAULT,
    jobId: null,
    jobStatus: null,
    jobMessage: "",
    results: {},
  }
  if (typeof window === "undefined") return base
  const saved = readJson<Flow>(sessionStorage, FLOW_KEY)
  return saved ? { ...base, ...saved } : base
}

export function persist(flow: Flow) {
  try {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow))
    const prefs: Prefs = { rut: flow.rut, colegio: flow.colegio, asunto: flow.asunto, cuerpo: flow.cuerpo, config: flow.config }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando sin recordar */
  }
}

// ── Reducer ────────────────────────────────────────────────────────

export type Action =
  | { type: "patch"; patch: Partial<Flow> }
  | { type: "course"; roster: RosterEntry[]; courseLabel: string; rosterFor: string }
  | { type: "excel"; fileName: string; parse: ParseResult }
  | { type: "clearExcel" }
  | { type: "edit"; key: string; field: "correoApoderado" | "emailAlumno"; value: string }
  | { type: "match"; key: string; value: string | null }
  | { type: "toggle"; key: string; include: boolean }
  | { type: "toggleMany"; keys: string[]; include: boolean }
  | { type: "jobStarted"; jobId: string; keys: string[] }
  | { type: "snapshot"; job: JobSnapshot }
  | { type: "student"; key: string; status: StudentStatus; message: string }
  | { type: "job"; status: JobStatus; message: string }
  | { type: "newCourse" }
  | { type: "resetMessage" }

export function reducer(flow: Flow, a: Action): Flow {
  switch (a.type) {
    case "patch":
      return { ...flow, ...a.patch }
    case "course":
      return { ...flow, roster: a.roster, courseLabel: a.courseLabel, rosterFor: a.rosterFor, manualMatches: {}, results: {}, jobId: null, jobStatus: null, jobMessage: "" }
    case "excel":
      return { ...flow, fileName: a.fileName, parse: a.parse, edits: {}, manualMatches: {}, excluded: [], results: {}, jobId: null, jobStatus: null }
    case "clearExcel":
      return { ...flow, fileName: null, parse: null, edits: {}, manualMatches: {}, excluded: [], results: {} }
    case "edit":
      return { ...flow, edits: { ...flow.edits, [a.key]: { ...flow.edits[a.key], [a.field]: a.value.trim().toLowerCase() } } }
    case "match":
      return { ...flow, manualMatches: { ...flow.manualMatches, [a.key]: a.value } }
    case "toggle":
      return { ...flow, excluded: a.include ? flow.excluded.filter((k) => k !== a.key) : [...new Set([...flow.excluded, a.key])] }
    case "toggleMany": {
      const set = new Set(flow.excluded)
      for (const k of a.keys) {
        if (a.include) set.delete(k)
        else set.add(k)
      }
      return { ...flow, excluded: [...set] }
    }
    case "jobStarted": {
      const results = { ...flow.results }
      for (const k of a.keys) results[k] = { status: "pending", message: "En cola" }
      return { ...flow, jobId: a.jobId, jobStatus: "running", jobMessage: "Iniciando…", results }
    }
    case "snapshot": {
      const results = { ...flow.results }
      for (const s of a.job.students) results[s.key] = { status: s.status, message: s.message }
      return { ...flow, results, jobStatus: a.job.status, jobMessage: a.job.message }
    }
    case "student":
      return { ...flow, results: { ...flow.results, [a.key]: { status: a.status, message: a.message } } }
    case "job": {
      if (a.status === "running") return { ...flow, jobStatus: a.status, jobMessage: a.message }
      // Al terminar, nada queda "en curso": lo que no alcanzó a procesarse pasa a omitido
      const results = { ...flow.results }
      for (const [k, r] of Object.entries(results)) {
        if (r.status === "pending" || r.status === "downloading" || r.status === "drafting") results[k] = { status: "skipped", message: "No se alcanzó a procesar" }
      }
      return { ...flow, results, jobStatus: a.status, jobMessage: a.message }
    }
    case "newCourse":
      return {
        ...flow,
        step: "napsis",
        roster: null,
        courseLabel: "",
        rosterFor: "",
        fileName: null,
        parse: null,
        edits: {},
        manualMatches: {},
        excluded: [],
        jobId: null,
        jobStatus: null,
        jobMessage: "",
        results: {},
      }
    case "resetMessage":
      return { ...flow, asunto: ASUNTO_DEFAULT, cuerpo: CUERPO_DEFAULT }
  }
}

// ── Derivados ──────────────────────────────────────────────────────

export type Row = {
  student: Student
  match: Match | undefined
  issues: Issue[]
  blocked: boolean
  included: boolean
  result: Result | undefined
}

export function deriveRows(flow: Flow): Row[] {
  const parsed = flow.parse?.students ?? []
  const students = parsed.map((s) => ({ ...s, ...flow.edits[s.key] }))
  const roster = flow.roster ?? []
  const auto = flow.roster ? matchRoster(students, roster) : {}
  const excluded = new Set(flow.excluded)

  return students.map((s) => {
    let match: Match | undefined = auto[s.key]
    if (s.key in flow.manualMatches) {
      const v = flow.manualMatches[s.key]
      const entry = v ? roster.find((r) => r.value === v) : undefined
      match = entry ? { ...entry, by: "manual" } : undefined
    }
    const issues = reviewStudent(s, match, !!flow.roster)
    const blocked = isBlocked(issues)
    return { student: s, match, issues, blocked, included: !blocked && !excluded.has(s.key), result: flow.results[s.key] }
  })
}

/** Alumnos del curso en Napsis que no están en el Excel ni asignados. */
export function unmatchedRoster(flow: Flow, rows: Row[]): RosterEntry[] {
  const used = new Set(rows.map((r) => r.match?.value).filter(Boolean))
  return (flow.roster ?? []).filter((r) => !used.has(r.value))
}

export function toPayload(row: Row) {
  const s = row.student
  return { ...s, emailAlumno: isEmail(s.emailAlumno) ? s.emailAlumno : "", napsisValue: row.match!.value }
}

export function labelOf(opts: { value: string; label: string }[] | undefined, value: string) {
  return opts?.find((o) => o.value === value)?.label ?? ""
}
