import type { NextAuthOptions } from "next-auth"
import type { JWT } from "next-auth/jwt"
import GoogleProvider from "next-auth/providers/google"

async function refreshAccessToken(token: JWT): Promise<JWT> {
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
  const refreshed = await res.json()
  if (!res.ok) throw refreshed

  return {
    ...token,
    accessToken: refreshed.access_token as string,
    refreshToken: (refreshed.refresh_token as string | undefined) ?? token.refreshToken,
    expiresAt: Date.now() + (refreshed.expires_in as number) * 1000,
    error: undefined,
  }
}

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.compose",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!allowedDomains.length) return true
      const domain = user.email?.split("@")[1]?.toLowerCase() ?? ""
      return allowedDomains.includes(domain) ? true : "/?error=AccessDenied"
    },

    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token ?? "",
          refreshToken: account.refresh_token ?? "",
          expiresAt: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
        }
      }
      // Margen de 5 min para que un proceso que empieza ahora no quede con un token a punto de vencer
      if (Date.now() < token.expiresAt - 5 * 60_000) return token
      try {
        return await refreshAccessToken(token)
      } catch {
        return { ...token, error: "RefreshTokenError" }
      }
    },

    async session({ session, token }) {
      // El access token NO se expone al navegador: solo lo usa el servidor (lib/session.ts)
      if (token.error) session.error = token.error
      return session
    },
  },
  pages: { signIn: "/", error: "/" },
}
