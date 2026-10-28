/** Marca: una hoja con esquina doblada que termina en un sobre. */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect x="1" y="1" width="26" height="26" rx="7" className="fill-accent" />
        <path d="M9 7.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 9 20V8a.5.5 0 0 1 .5-.5Z" fill="none" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M16 7.5V11.5h4" fill="none" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m9.5 14.5 5 3.25 5-3.25" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="text-[0.9375rem] leading-none font-semibold tracking-[-0.01em] text-ink">
          Informes <span className="text-ink-3">Napsis</span>
        </span>
      )}
    </span>
  )
}
