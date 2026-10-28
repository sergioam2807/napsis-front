"use client"

import { forwardRef, useId } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2, XCircle, type LucideIcon } from "lucide-react"

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

// ── Button ─────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger"
  size?: "md" | "sm"
  loading?: boolean
  icon?: LucideIcon
  iconRight?: LucideIcon
}

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0"
const BTN_VARIANT = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-line disabled:text-ink-3",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-panel disabled:text-ink-3 disabled:hover:bg-surface",
  quiet: "text-ink-2 hover:bg-panel hover:text-ink disabled:text-ink-3 disabled:hover:bg-transparent",
  danger: "border border-danger-line bg-surface text-danger hover:bg-danger-soft disabled:text-ink-3",
}
const BTN_SIZE = { md: "h-10 px-4 text-sm", sm: "h-8 px-3 text-[0.8125rem]" }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, iconRight: IconRight, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" strokeWidth={1.75} aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" strokeWidth={1.75} aria-hidden /> : null}
    </button>
  )
})

// ── Form fields ────────────────────────────────────────────────────

export const inputClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:bg-panel disabled:text-ink-3 aria-invalid:border-danger aria-invalid:focus:ring-danger/15"

type FieldProps = {
  label: string
  hint?: React.ReactNode
  error?: string | null
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function Field({ label, hint, error, children, className, action }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink">
          {label}
        </label>
        {action}
      </div>
      {children({ id, "aria-describedby": hint || error ? hintId : undefined, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={hintId} className={cx("text-xs", error ? "text-danger" : "text-ink-3")}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; loading?: boolean }

export function Select({ options, loading, className, ...rest }: SelectProps) {
  if (loading) return <div className="skeleton h-10 w-full" aria-hidden />
  return (
    <div className="relative">
      <select className={cx(inputClass, "cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed", className)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
    </div>
  )
}

// ── Notice ─────────────────────────────────────────────────────────

const NOTICE = {
  info: { icon: Info, cls: "bg-panel text-ink-2", iconCls: "text-ink-3" },
  success: { icon: CheckCircle2, cls: "bg-accent-soft text-accent-strong", iconCls: "text-accent" },
  warn: { icon: AlertTriangle, cls: "bg-warn-soft text-[oklch(0.4_0.09_70)]", iconCls: "text-warn" },
  danger: { icon: XCircle, cls: "bg-danger-soft text-[oklch(0.42_0.15_25)]", iconCls: "text-danger" },
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  live,
}: {
  tone?: keyof typeof NOTICE
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
  live?: boolean
}) {
  const { icon: Icon, cls, iconCls } = NOTICE[tone]
  return (
    <div
      className={cx("flex items-start gap-3 rounded-lg px-3.5 py-3 text-[0.8125rem] leading-5", cls, className)}
      role={live ? (tone === "danger" ? "alert" : "status") : undefined}
    >
      <Icon className={cx("mt-0.5 size-4 shrink-0", iconCls)} strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

// ── Chip ───────────────────────────────────────────────────────────

const CHIP = {
  neutral: "bg-panel text-ink-2",
  accent: "bg-accent-soft text-accent-strong",
  warn: "bg-warn-soft text-[oklch(0.42_0.09_70)]",
  danger: "bg-danger-soft text-[oklch(0.45_0.16_25)]",
  progress: "bg-surface text-ink ring-1 ring-inset ring-line-strong",
}

export function Chip({ tone = "neutral", icon: Icon, spin, children, title }: { tone?: keyof typeof CHIP; icon?: LucideIcon; spin?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cx("inline-flex h-6 max-w-full items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-200", CHIP[tone])}
    >
      {Icon && <Icon className={cx("size-3.5 shrink-0", spin && "animate-spin")} strokeWidth={2} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-panel px-1.5 py-px font-sans text-2xs text-ink-2">{children}</kbd>
}
