import { describe, expect, it } from "vitest"
import { computeDv, formatLoginRut, formatRut, isValidLoginRut, isValidRut, loginRut, normalizeRut } from "./rut"
import { isBlocked, mapColumns, matchRoster, parseRows, reviewStudent } from "./students"
import { interpolate, studentVars, suggestVariable, unknownVariables, reportFilename } from "./template"

const HEADERS = [
  "Apellido Paterno",
  "Apellido Materno",
  "Primer Nombre",
  "Segundo Nombre",
  "Rut con DV",
  "Email Institucional del Alumno",
  "Nombre Completo del Apoderado",
  "Correo Apoderado",
]

describe("rut", () => {
  it("normaliza y valida el dígito verificador", () => {
    expect(normalizeRut("24.147.564-6")).toBe("24147564-6")
    expect(normalizeRut("241475646")).toBe("24147564-6")
    expect(normalizeRut("7.654.321-k")).toBe("7654321-K")
    expect(computeDv("24147564")).toBe("6")
    expect(isValidRut("24.147.564-6")).toBe(true)
    expect(isValidRut("24.147.564-7")).toBe(false)
    expect(isValidRut("12345678-5")).toBe(true)
    expect(formatRut("241475646")).toBe("24.147.564-6")
  })

  it("el RUT de login va a Napsis sin dígito verificador", () => {
    // Napsis identifica al usuario por el número pelado, se escriba como se escriba.
    expect(loginRut("17791339")).toBe("17791339")
    expect(loginRut("17791339-1")).toBe("17791339")
    expect(loginRut("17.791.339-1")).toBe("17791339")
    expect(loginRut("177913391")).toBe("17791339")
    expect(loginRut("7.654.321-k")).toBe("7654321")
  })

  it("acepta el RUT de login sin DV y solo revisa el DV si se escribió", () => {
    expect(isValidLoginRut("17791339")).toBe(true)
    expect(isValidLoginRut("17791339-1")).toBe(true)
    expect(isValidLoginRut("17791339-9")).toBe(false)
    expect(isValidLoginRut("123")).toBe(false)
    expect(isValidLoginRut("")).toBe(false)
    expect(formatLoginRut("17791339-1")).toBe("17.791.339")
  })
})

describe("mapColumns", () => {
  it("no confunde 'Correo Apoderado' con el nombre del apoderado", () => {
    const m = mapColumns(HEADERS)
    expect(m.nombreApoderado).toBe(6)
    expect(m.correoApoderado).toBe(7)
    expect(m.emailAlumno).toBe(5)
    expect(m.rut).toBe(4)
  })

  it("tolera tildes, mayúsculas y otro orden", () => {
    const m = mapColumns(["CORREO APODERADO", "RUT", "Nombres", "Apellido paterno", "Nombre del Apoderado"])
    expect(m).toMatchObject({ correoApoderado: 0, rut: 1, primerNombre: 2, apellidoPaterno: 3, nombreApoderado: 4 })
  })
})

describe("parseRows", () => {
  it("encuentra el encabezado bajo un título y conserva filas incompletas", () => {
    const rows = [
      ["Listado 3° Básico A"],
      HEADERS,
      ["Arancibia", "Carrasco", "Demián", "Abel", "24.147.564-7", "DEMIAN@colegio.cl", "Allison Carrasco", "allison@gmail.com"],
      ["Soto", "", "Ana", "", "12345678-5", "", "Pedro Soto", ""],
      ["", "", "", "", "", "", "", ""],
    ]
    const r = parseRows(rows)
    expect(r.missingColumns).toEqual([])
    expect(r.students).toHaveLength(2)
    expect(r.students[0]).toMatchObject({ key: "24147564-7", row: 3, rut: "24147564-7", emailAlumno: "demian@colegio.cl" })
    expect(r.students[1].correoApoderado).toBe("")
  })

  it("informa columnas faltantes", () => {
    const r = parseRows([["Nombre", "Edad"], ["Ana", "10"]])
    expect(r.students).toHaveLength(0)
    expect(r.missingColumns.length).toBeGreaterThan(0)
  })
})

describe("matchRoster + reviewStudent", () => {
  const [a, b, c] = parseRows([
    HEADERS,
    ["Arancibia", "Carrasco", "Demián", "", "24147564-7", "d@colegio.cl", "Allison", "allison@gmail.com"],
    ["Pérez", "Rojas", "María", "", "11111111-1", "m@colegio.cl", "Juan", "juan@gmail.com"],
    ["Díaz", "", "Tomás", "", "22222222-2", "", "Rosa", "rosa@gmail"],
  ]).students
  const roster = [
    { value: "24147564-229-1", label: "ARANCIBIA CARRASCO DEMIAN ABEL" },
    { value: "99999999-229-1", label: "PEREZ ROJAS MARIA JOSE" },
  ]

  it("cruza por RUT y, si no, por nombre único", () => {
    const m = matchRoster([a, b, c], roster)
    expect(m[a.key]).toMatchObject({ value: "24147564-229-1", by: "rut" })
    expect(m[b.key]).toMatchObject({ value: "99999999-229-1", by: "nombre" })
    expect(m[c.key]).toBeUndefined()
  })

  it("bloquea lo que no se puede enviar y avisa lo demás", () => {
    const m = matchRoster([a, b, c], roster)
    expect(isBlocked(reviewStudent(a, m[a.key], true))).toBe(false)
    expect(reviewStudent(b, m[b.key], true).map((i) => i.code)).toContain("name_match")
    const ic = reviewStudent(c, m[c.key], true).map((i) => i.code)
    expect(ic).toEqual(expect.arrayContaining(["no_match", "bad_parent_email", "no_student_email"]))
  })
})

describe("template", () => {
  it("interpola y detecta variables mal escritas", () => {
    const s = parseRows([HEADERS, ["Soto", "", "Ana", "", "12345678-5", "", "Pedro Soto", "p@x.cl"]]).students[0]
    expect(interpolate("Hola {nombreApoderado}, {nombreAlumno}", studentVars(s))).toBe("Hola Pedro Soto, Ana Soto")
    expect(unknownVariables("{nombreAlumo} {rut}")).toEqual(["nombreAlumo"])
    expect(suggestVariable("nombreAlumo")).toBe("nombreAlumno")
    expect(reportFilename(s)).toBe("Informe_Soto_Ana_12345678.pdf")
  })
})
