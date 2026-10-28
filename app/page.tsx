import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { FileDown, KeyRound, MailCheck, ShieldCheck } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { GoogleSignIn } from "@/components/google-sign-in"
import { Logo } from "@/components/logo"
import { Notice } from "@/components/ui"

const ERRORS: Record<string, string> = {
  AccessDenied: "Esa cuenta de Google no tiene acceso. Ingresa con tu correo del colegio.",
  OAuthCallback: "Google canceló el ingreso. Intenta de nuevo y acepta el permiso de borradores.",
  Default: "No se pudo iniciar sesión con Google. Intenta de nuevo.",
}

const STEPS = [
  { icon: KeyRound, title: "Entra a Napsis con tu cuenta", text: "Eliges el curso y el período una sola vez." },
  { icon: FileDown, title: "Descarga el informe de cada alumno", text: "Cruza tu Excel con el listado del curso y avisa lo que no calza." },
  { icon: MailCheck, title: "Deja un borrador por apoderado", text: "Con el PDF adjunto y copia al alumno. Tú revisas y envías desde Gmail." },
]

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getServerSession(authOptions)
  if (session && !session.error) redirect("/dashboard")
  const { error } = await searchParams

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,34rem)]">
      <section className="flex flex-col justify-between gap-12 px-6 py-8 sm:px-12 lg:py-12">
        <Logo />
        <div className="max-w-xl">
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.02em] text-ink sm:text-[2.75rem]">
            Los informes del curso, listos en tu Gmail.
          </h1>
          <p className="mt-4 max-w-[52ch] text-base leading-7 text-ink-2">
            Descarga desde Napsis el informe parcial de cada alumno y prepara un correo por apoderado. Nada se envía solo.
          </p>

          <ol className="mt-10 flex flex-col">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative flex gap-4 pb-7 last:pb-0">
                {i < STEPS.length - 1 && <span className="absolute top-10 bottom-1 left-[1.1875rem] w-px bg-line-strong" aria-hidden />}
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-accent">
                  <Icon className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="pt-1.5">
                  <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-ink-3">Para profesores jefe y equipos administrativos de colegios con Napsis.</p>
      </section>

      <section className="flex items-center border-t border-line bg-surface px-6 py-12 sm:px-12 lg:border-t-0 lg:border-l">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-xl font-semibold text-ink">Ingresar</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-2">Usa la cuenta de Google donde quieres recibir los borradores.</p>

          {error && (
            <Notice tone="danger" className="mt-6" live>
              {ERRORS[error] ?? ERRORS.Default}
            </Notice>
          )}
          {session?.error && (
            <Notice tone="warn" className="mt-6">
              Tu sesión de Google expiró. Vuelve a ingresar para seguir.
            </Notice>
          )}

          <GoogleSignIn />

          <div className="mt-8 flex gap-3 border-t border-line pt-6 text-[0.8125rem] leading-5 text-ink-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
            <p>
              Google te pedirá permiso para <strong className="font-medium text-ink">crear borradores</strong>. La app no puede leer ni enviar tus
              correos, y tu contraseña de Napsis no se guarda.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
