import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/** Protege /dashboard: sin sesión de Google vuelve al inicio. */
export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.redirect(new URL("/", req.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
