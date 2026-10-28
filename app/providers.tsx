"use client"

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  // Refresca la sesión cada 10 min para que el token de Google se renueve en la cookie
  return <SessionProvider refetchInterval={10 * 60}>{children}</SessionProvider>
}
