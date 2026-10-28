"use client"

import dynamic from "next/dynamic"

/** El flujo vive en sessionStorage/localStorage: se renderiza solo en el navegador. */
const Workspace = dynamic(() => import("./workspace"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label="Cargando">
      <div className="h-14 border-b border-line bg-surface" />
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[16.5rem_1fr]">
        <div className="hidden border-r border-line bg-panel lg:block" />
        <div className="mx-auto w-full max-w-6xl px-8 pt-10">
          <div className="skeleton h-8 w-64" />
          <div className="skeleton mt-3 h-4 w-96 max-w-full" />
          <div className="skeleton mt-8 h-10 w-full max-w-md" />
          <div className="skeleton mt-4 h-10 w-full max-w-md" />
        </div>
      </div>
    </div>
  ),
})

export function WorkspaceLoader(props: { email: string; name: string }) {
  return <Workspace {...props} />
}
