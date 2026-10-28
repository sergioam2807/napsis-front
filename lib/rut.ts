/** Utilidades de RUT chileno. */

/** "24.147.564-7" | "241475647" | "24147564-k" → "24147564-7" / "24147564-K". Devuelve "" si no parece RUT. */
export function normalizeRut(input: string): string {
  const clean = String(input ?? "").toUpperCase().replace(/[^0-9K]/g, "")
  if (clean.length < 2) return ""
  const body = clean.slice(0, -1).replace(/^0+/, "")
  const dv = clean.slice(-1)
  if (!/^\d+$/.test(body)) return ""
  return `${body}-${dv}`
}

/** Número sin dígito verificador. */
export function rutBody(input: string): string {
  const n = normalizeRut(input)
  return n ? n.split("-")[0] : ""
}

export function computeDv(body: string): string {
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (sum % 11)
  return r === 11 ? "0" : r === 10 ? "K" : String(r)
}

export function isValidRut(input: string): boolean {
  const n = normalizeRut(input)
  if (!n) return false
  const [body, dv] = n.split("-")
  return body.length >= 6 && computeDv(body) === dv
}

/** "24147564-7" → "24.147.564-7" */
export function formatRut(input: string): string {
  const n = normalizeRut(input)
  if (!n) return input
  const [body, dv] = n.split("-")
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`
}

// ── RUT de acceso a Napsis ───────────────────────────────────────────
// Napsis identifica al usuario por el número SIN dígito verificador
// ("17791339"), a diferencia del RUT de los alumnos, que viene del Excel
// siempre con DV. Por eso el login tiene sus propias funciones.

/**
 * Separa el RUT escrito en el login. `body` es lo que se envía a Napsis; `dv`
 * queda solo para avisar de un tipeo, y va vacío si no se escribió ninguno.
 *
 *   "17791339"     → { body: "17791339", dv: "" }   ← como lo pide Napsis
 *   "17791339-1"   → { body: "17791339", dv: "1" }
 *   "17.791.339-1" → { body: "17791339", dv: "1" }
 *   "177913391"    → { body: "17791339", dv: "1" }  ← 9 seguidos: cuerpo + DV
 */
export function parseLoginRut(input: string): { body: string; dv: string } {
  const none = { body: "", dv: "" }
  const clean = String(input ?? "").toUpperCase().replace(/[^0-9K-]/g, "")
  const dash = clean.indexOf("-")

  let body = dash >= 0 ? clean.slice(0, dash) : clean
  let dv = dash >= 0 ? clean.slice(dash + 1) : ""
  // Una K solo puede ser dígito verificador.
  if (dash < 0 && body.endsWith("K")) {
    body = body.slice(0, -1)
    dv = "K"
  }
  // Sin separador, los cuerpos chilenos llegan a 8 dígitos: 9 seguidos traen el DV pegado.
  if (dash < 0 && !dv && body.length === 9) {
    dv = body.slice(-1)
    body = body.slice(0, -1)
  }

  body = body.replace(/^0+/, "")
  if (!/^\d{6,8}$/.test(body)) return none
  if (dv && !/^[0-9K]$/.test(dv)) return none
  return { body, dv }
}

/** Lo que se envía a Napsis: el número sin dígito verificador. */
export function loginRut(input: string): string {
  return parseLoginRut(input).body
}

/** Válido si tiene forma de RUT y, cuando se escribió un DV, este cuadra. */
export function isValidLoginRut(input: string): boolean {
  const { body, dv } = parseLoginRut(input)
  if (!body) return false
  return dv === "" || computeDv(body) === dv
}

/** "17791339" | "17.791.339-1" → "17.791.339" (sin dígito verificador) */
export function formatLoginRut(input: string): string {
  const { body } = parseLoginRut(input)
  return body ? body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : input
}
