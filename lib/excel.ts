import { FIELD_LABELS, parseRows, type ParseResult } from "./students"

/** Lee la primera hoja de un Excel/CSV en el navegador. xlsx se carga solo cuando se necesita. */
export async function readStudentsFile(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx")
  const data = new Uint8Array(await file.arrayBuffer())
  const wb = XLSX.read(data, { type: "array", cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error("El archivo no tiene hojas.")
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" })
  return parseRows(rows)
}

/** Descarga una plantilla vacía con las columnas esperadas. */
export async function downloadTemplate() {
  const XLSX = await import("xlsx")
  const headers = [
    "Apellido Paterno",
    "Apellido Materno",
    "Primer Nombre",
    "Segundo Nombre",
    "Rut con DV",
    "Email Institucional del Alumno",
    "Nombre Completo del Apoderado",
    "Correo Apoderado",
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers])
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Alumnos")
  XLSX.writeFile(wb, "plantilla-alumnos.xlsx")
}

export const EXPECTED_COLUMNS = Object.values(FIELD_LABELS)
