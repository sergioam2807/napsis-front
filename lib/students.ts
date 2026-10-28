import { isValidRut, normalizeRut, rutBody } from "./rut"

export type Student = {
  /** Identificador estable: RUT normalizado, o "fila-N" si no hay RUT. */
  key: string
  /** Fila en el Excel (1-based, como la ve el usuario). */
  row: number
  apellidoPaterno: string
  apellidoMaterno: string
  primerNombre: string
  segundoNombre: string
  rut: string
  emailAlumno: string
  nombreApoderado: string
  correoApoderado: string
}

export type Field = Exclude<keyof Student, "key" | "row">

export const FIELD_LABELS: Record<Field, string> = {
  apellidoPaterno: "Apellido paterno",
  apellidoMaterno: "Apellido materno",
  primerNombre: "Primer nombre",
  segundoNombre: "Segundo nombre",
  rut: "RUT con DV",
  emailAlumno: "Email institucional del alumno",
  nombreApoderado: "Nombre del apoderado",
  correoApoderado: "Correo del apoderado",
}

/** Orden = prioridad: los campos más específicos eligen columna primero. */
const ALIASES: [Field, string[]][] = [
  ["correoApoderado", ["correo apoderado", "correo del apoderado", "email apoderado", "email del apoderado", "mail apoderado", "correo electronico apoderado"]],
  ["emailAlumno", ["email institucional del alumno", "email institucional", "correo institucional", "email alumno", "correo alumno", "mail alumno"]],
  ["nombreApoderado", ["nombre completo del apoderado", "nombre del apoderado", "nombre apoderado", "apoderado"]],
  ["rut", ["rut con dv", "rut alumno", "rut del alumno", "rut"]],
  ["apellidoPaterno", ["apellido paterno", "paterno"]],
  ["apellidoMaterno", ["apellido materno", "materno"]],
  ["primerNombre", ["primer nombre", "nombres", "nombre alumno"]],
  ["segundoNombre", ["segundo nombre"]],
]

const REQUIRED: Field[] = ["rut", "correoApoderado", "primerNombre", "apellidoPaterno"]

export function normalizeText(s: unknown) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function isEmail(s: string) {
  return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(s.trim())
}

/** Asigna a cada campo la mejor columna disponible. Devuelve índice de columna por campo. */
export function mapColumns(headers: string[]): Partial<Record<Field, number>> {
  const norm = headers.map(normalizeText)
  const used = new Set<number>()
  const mapping: Partial<Record<Field, number>> = {}

  for (const [field, aliases] of ALIASES) {
    let idx = -1
    for (const alias of aliases) {
      idx = norm.findIndex((h, i) => !used.has(i) && h === alias)
      if (idx >= 0) break
    }
    if (idx < 0) {
      for (const alias of aliases) {
        idx = norm.findIndex((h, i) => !used.has(i) && h.includes(alias))
        if (idx >= 0) break
      }
    }
    if (idx >= 0) {
      mapping[field] = idx
      used.add(idx)
    }
  }
  return mapping
}

export type ParseResult = {
  students: Student[]
  /** Encabezado detectado por campo (para mostrar al usuario). */
  columns: Partial<Record<Field, string>>
  missingColumns: Field[]
  /** Filas vacías o sin RUT ni nombre que se ignoraron. */
  ignoredRows: number
  duplicates: string[]
}

/**
 * Convierte filas crudas (primera hoja, array de arrays) en alumnos.
 * Busca el encabezado en las primeras 10 filas (algunos exportes traen un título arriba).
 */
export function parseRows(rows: unknown[][]): ParseResult {
  let headerIdx = -1
  let mapping: Partial<Record<Field, number>> = {}
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const m = mapColumns((rows[i] ?? []).map((c) => String(c ?? "")))
    if (Object.keys(m).length > Object.keys(mapping).length) {
      mapping = m
      headerIdx = i
    }
    if (Object.keys(m).length >= 6) break
  }

  const headers = headerIdx >= 0 ? (rows[headerIdx] ?? []).map((c) => String(c ?? "").trim()) : []
  const columns: Partial<Record<Field, string>> = {}
  for (const [f, i] of Object.entries(mapping) as [Field, number][]) columns[f] = headers[i]
  const missingColumns = REQUIRED.filter((f) => mapping[f] === undefined)

  const students: Student[] = []
  const seen = new Map<string, number>()
  const duplicates: string[] = []
  let ignoredRows = 0

  if (headerIdx < 0 || missingColumns.length === REQUIRED.length) {
    return { students, columns, missingColumns: REQUIRED, ignoredRows: 0, duplicates }
  }

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const get = (f: Field) => (mapping[f] === undefined ? "" : String(row[mapping[f]!] ?? "").replace(/\s+/g, " ").trim())
    const rawRut = get("rut")
    const s = {
      apellidoPaterno: get("apellidoPaterno"),
      apellidoMaterno: get("apellidoMaterno"),
      primerNombre: get("primerNombre"),
      segundoNombre: get("segundoNombre"),
      rut: normalizeRut(rawRut) || rawRut,
      emailAlumno: get("emailAlumno").toLowerCase(),
      nombreApoderado: get("nombreApoderado"),
      correoApoderado: get("correoApoderado").toLowerCase(),
    }
    if (!s.rut && !s.primerNombre && !s.apellidoPaterno) {
      if (row.some((c) => String(c ?? "").trim())) ignoredRows++
      continue
    }
    let key = normalizeRut(rawRut) || `fila-${r + 1}`
    if (seen.has(key)) {
      duplicates.push(s.rut)
      key = `${key}#${r + 1}`
    }
    seen.set(key, r)
    students.push({ key, row: r + 1, ...s })
  }

  return { students, columns, missingColumns, ignoredRows, duplicates }
}

// ── Cruce con el listado de Napsis ────────────────────────────────

export type RosterEntry = { value: string; label: string }
export type Match = { value: string; label: string; by: "rut" | "nombre" | "manual" }

function rosterRutBody(value: string) {
  return value.match(/^(\d{6,9})/)?.[1] ?? ""
}

/** Busca cada alumno del Excel en el listado del curso: primero por RUT, luego por nombre (solo si es único). */
export function matchRoster(students: Student[], roster: RosterEntry[]): Record<string, Match> {
  const result: Record<string, Match> = {}
  const taken = new Set<string>()
  const byBody = new Map(roster.map((r) => [rosterRutBody(r.value), r]))

  for (const s of students) {
    const body = rutBody(s.rut)
    const hit = (body && byBody.get(body)) || roster.find((r) => body && r.value.includes(body))
    if (hit && !taken.has(hit.value)) {
      result[s.key] = { ...hit, by: "rut" }
      taken.add(hit.value)
    }
  }

  for (const s of students) {
    if (result[s.key] || !s.apellidoPaterno || !s.primerNombre) continue
    const ap = normalizeText(s.apellidoPaterno)
    const nom = normalizeText(s.primerNombre)
    const candidates = roster.filter((r) => {
      if (taken.has(r.value)) return false
      const l = normalizeText(r.label)
      return l.includes(ap) && l.includes(nom)
    })
    if (candidates.length === 1) {
      result[s.key] = { ...candidates[0], by: "nombre" }
      taken.add(candidates[0].value)
    }
  }
  return result
}

// ── Revisión ──────────────────────────────────────────────────────

export type Issue = { code: string; severity: "block" | "warn"; text: string }

export function reviewStudent(s: Student, match: Match | undefined, hasRoster: boolean): Issue[] {
  const issues: Issue[] = []
  if (hasRoster && !match) {
    issues.push({ code: "no_match", severity: "block", text: "No aparece en el curso de Napsis" })
  }
  if (!s.correoApoderado) {
    issues.push({ code: "no_parent_email", severity: "block", text: "Falta el correo del apoderado" })
  } else if (!isEmail(s.correoApoderado)) {
    issues.push({ code: "bad_parent_email", severity: "block", text: "Correo del apoderado inválido" })
  }
  if (match?.by === "nombre") {
    issues.push({ code: "name_match", severity: "warn", text: "Encontrado por nombre: el RUT no coincide" })
  }
  if (!s.emailAlumno) {
    issues.push({ code: "no_student_email", severity: "warn", text: "Sin correo del alumno: no irá con copia" })
  } else if (!isEmail(s.emailAlumno)) {
    issues.push({ code: "bad_student_email", severity: "warn", text: "Correo del alumno inválido: no irá con copia" })
  }
  if (s.rut && !isValidRut(s.rut) && match?.by !== "nombre") {
    issues.push({ code: "bad_rut", severity: "warn", text: "El dígito verificador del RUT no cuadra" })
  }
  return issues
}

export const isBlocked = (issues: Issue[]) => issues.some((i) => i.severity === "block")
