import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { WorkspaceLoader } from "@/components/workspace/loader"

export const metadata: Metadata = { title: "Crear borradores · Informes Napsis" }

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.error) redirect("/")
  return <WorkspaceLoader email={session.user.email} name={session.user.name ?? ""} />
}
