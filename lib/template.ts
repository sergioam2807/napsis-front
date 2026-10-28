import type { Student } from "./students"

export const VARIABLES = [
  { key: "nombreApoderado", label: "Nombre apoderado" },
  { key: "nombreAlumno", label: "Nombre alumno" },
  { key: "rut", label: "RUT alumno" },
] as const

/** Variables que el worker también reconoce (no se ofrecen como botón pero son válidas). */
const EXTRA_KEYS = ["emailAlumno", "correoApoderado"]
const KNOWN = new Set<string>([...VARIABLES.map((v) => v.key), ...EXTRA_KEYS])

export const ASUNTO_DEFAULT = "Informe parcial de {nombreAlumno}"
export const CUERPO_DEFAULT =
  "Estimado/a {nombreApoderado}:\n\n" +
  "Junto con saludar, le hacemos llegar el informe parcial de {nombreAlumno}, que encontrará adjunto a este correo.\n\n" +
  "Quedamos atentos ante cualquier consulta.\n\n" +
  "Saludos cordiales."

export function nombreCompleto(s: Pick<Student, "primerNombre" | "segundoNombre" | "apellidoPaterno" | "apellidoMaterno">) {
  return [s.primerNombre, s.segundoNombre, s.apellidoPaterno, s.apellidoMaterno]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
}

export function studentVars(s: Student): Record<string, string> {
  return {
    nombreAlumno: nombreCompleto(s),
    nombreApoderado: s.nombreApoderado,
    rut: s.rut,
    emailAlumno: s.emailAlumno,
    correoApoderado: s.correoApoderado,
  }
}

export function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m))
}

/** Variables escritas en la plantilla que no existen (ej. un typo como {nombreAlumo}). */
export function unknownVariables(...templates: string[]): string[] {
  const found = new Set<string>()
  for (const t of templates) {
    for (const m of t.matchAll(/\{(\w+)\}/g)) if (!KNOWN.has(m[1])) found.add(m[1])
  }
  return [...found]
}

/** Variable conocida más parecida (distancia de edición ≤ 3). */
export function suggestVariable(name: string): string | null {
  let best: string | null = null
  let bestD = 4
  for (const k of KNOWN) {
    const d = levenshtein(name.toLowerCase(), k.toLowerCase())
    if (d < bestD) {
      bestD = d
      best = k
    }
  }
  return best
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

/** Mismo nombre de archivo que genera el worker: Informe_Perez_Juan_12345678.pdf */
export function reportFilename(s: Pick<Student, "apellidoPaterno" | "primerNombre" | "rut">) {
  const clean = (v: string) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "")
  const rutNum = String(s.rut || "").replace(/[^0-9]/g, "").slice(0, -1) || "sinrut"
  return `${["Informe", clean(s.apellidoPaterno), clean(s.primerNombre), rutNum].filter(Boolean).join("_")}.pdf`
}
