import { NextResponse, type NextRequest } from "next/server"
import { getAuthedUser } from "@/lib/google-token"

/**
 * Proxy autenticado hacia el worker. Solo deja pasar las rutas conocidas,
 * agrega la API key del servicio y la identidad del usuario, y para crear
 * un proceso inyecta el access token de Google (que nunca llega al navegador).
 */

const ROUTES: { method: string; pattern: RegExp }[] = [
  { method: "POST", pattern: /^sessions$/ },
  { method: "POST", pattern: /^sessions\/[\w-]+\/(options|roster)$/ },
  { method: "DELETE", pattern: /^sessions\/[\w-]+$/ },
  { method: "POST", pattern: /^jobs$/ },
  { method: "GET", pattern: /^jobs\/[\w-]+$/ },
  { method: "GET", pattern: /^jobs\/[\w-]+\/events$/ },
  { method: "POST", pattern: /^jobs\/[\w-]+\/cancel$/ },
]

export const dynamic = "force-dynamic"
export const maxDuration = 300

type Ctx = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  const route = path.join("/")
  if (!ROUTES.some((r) => r.method === req.method && r.pattern.test(route))) {
    return NextResponse.json({ error: "Ruta no permitida" }, { status: 404 })
  }

  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: "Tu sesión de Google expiró. Vuelve a ingresar.", code: "google_auth" }, { status: 401 })

  const workerUrl = process.env.WORKER_URL
  const apiKey = process.env.WORKER_API_KEY
  if (!workerUrl || !apiKey) {
    return NextResponse.json({ error: "Falta configurar WORKER_URL y WORKER_API_KEY en el servidor." }, { status: 500 })
  }

  let body: string | undefined
  if (req.method === "POST") {
    const json = await req.json().catch(() => ({}))
    if (route === "jobs") {
      const token = await user.accessToken()
      if (!token) {
        return NextResponse.json({ error: "Google no renovó el permiso de Gmail. Cierra sesión y vuelve a ingresar.", code: "google_auth" }, { status: 401 })
      }
      json.googleAccessToken = token
    }
    body = JSON.stringify(json)
  }

  let upstream: Response
  try {
    upstream = await fetch(`${workerUrl.replace(/\/$/, "")}/api/${route}`, {
      method: req.method,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "x-user-email": user.email,
      },
      body,
      signal: req.signal,
      cache: "no-store",
    })
  } catch {
    if (req.signal.aborted) return new Response(null, { status: 499 })
    return NextResponse.json({ error: "No se pudo conectar con el servicio de descarga. Revisa que el worker esté en línea." }, { status: 502 })
  }

  if (route.endsWith("/events") && upstream.ok && upstream.body) {
    return new Response(upstream.body, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    })
  }

  if (upstream.status === 204) return new Response(null, { status: 204 })
  const text = await upstream.text()
  return new Response(text || "{}", {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  })
}

export { handle as GET, handle as POST, handle as DELETE }
