"use client"

import type { Dispatch } from "react"
import { signIn } from "next-auth/react"
import { ApiError } from "@/lib/api"
import { Button, Notice } from "@/components/ui"
import type { Action, Flow, Row, StepId } from "./state"

export type StepProps = {
  flow: Flow
  dispatch: Dispatch<Action>
  rows: Row[]
  go: (step: StepId) => void
  email: string
}

export function StepHeader({ title, children, aside }: { title: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        <h1 className="text-[1.5rem] leading-8 font-semibold tracking-[-0.015em] text-ink" tabIndex={-1} data-step-heading>
          {title}
        </h1>
        {children && <p className="mt-1.5 text-sm leading-6 text-ink-2">{children}</p>}
      </div>
      {aside}
    </div>
  )
}

/** Barra inferior fija con la acción principal del paso. */
export function StepFooter({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-10 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-ink-2" aria-live="polite">
          {status}
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  )
}

/** Error de API mostrado inline, con la salida que corresponde. */
export function ApiErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null
  const e = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "Error inesperado", 0)
  if (e.googleExpired) {
    return (
      <Notice
        tone="warn"
        live
        title="Tu sesión de Google expiró"
        action={
          <Button size="sm" variant="secondary" onClick={() => signIn("google")}>
            Volver a ingresar
          </Button>
        }
      >
        Tu trabajo en esta pestaña se mantiene.
      </Notice>
    )
  }
  return (
    <Notice
      tone="danger"
      live
      action={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : undefined
      }
    >
      {e.message}
    </Notice>
  )
}

export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`
}
