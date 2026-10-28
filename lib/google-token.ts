// Solo servidor: usa GOOGLE_CLIENT_SECRET.
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export type AuthedUser = { email: string; accessToken: () => Promise<string | null> }

/**
 * Lee la sesión desde la cookie JWT. Devuelve el correo del usuario y una función
 * que entrega un access token de Google vigente (refrescándolo si hace falta).
 */
export async function getAuthedUser(req: NextRequest): Promise<AuthedUser | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return null

  return {
    email: token.email.toLowerCase(),
    accessToken: async () => {
      if (token.accessToken && Date.now() < (token.expiresAt ?? 0) - 5 * 60_000) return token.accessToken
      if (!token.refreshToken) return null
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken,
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return (data.access_token as string) ?? null
    },
  }
}
