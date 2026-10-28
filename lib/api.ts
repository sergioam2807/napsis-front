import type { RosterEntry, Student } from "./students"

export type Opt = { value: string; label: string }
export type NapsisOptions = { tipoEns: Opt[]; grado: Opt[]; curso: Opt[]; selected: { tipoEns: string; grado: string } }
export type NapsisConfig = { tipoEns: string; grado: string; curso: string; periodo: string; religion: string }

export type StudentStatus = "pending" | "downloading" | "drafting" | "success" | "failed" | "skipped"
export type JobStatus = "running" | "done" | "cancelled" | "failed"
export type JobSnapshot = {
  id: string
  status: JobStatus
  message: string
  students: { key: string; nombre: string; status: StudentStatus; message: string }[]
}
export type JobEvent =
  | { type: "snapshot"; job: JobSnapshot }
  | { type: "student"; key: string; status: StudentStatus; message: string }
  | { type: "job"; status: JobStatus; message: string }

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
  /** La sesión de Napsis del worker ya no existe (expiró o se reinició el servicio). */
  get napsisExpired() {
    return this.status === 410
  }
  get googleExpired() {
    return this.code === "google_auth"
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/worker/${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError("Sin conexión. Revisa tu internet e intenta de nuevo.", 0)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status, data.code ?? data.kind)
  return data as T
}

export type JobStudentPayload = Student & { napsisValue: string }

export const api = {
  openSession: (napsisRut: string, napsisPassword: string, colegio: string) =>
    call<{ sessionId: string; colegio: string; options: NapsisOptions }>("POST", "sessions", { napsisRut, napsisPassword, colegio }),
  options: (sessionId: string, tipoEns?: string, grado?: string) =>
    call<NapsisOptions>("POST", `sessions/${sessionId}/options`, { tipoEns, grado }),
  roster: (sessionId: string, cfg: Pick<NapsisConfig, "tipoEns" | "grado" | "curso">) =>
    call<{ students: RosterEntry[] }>("POST", `sessions/${sessionId}/roster`, cfg),
  closeSession: (sessionId: string) => call<void>("DELETE", `sessions/${sessionId}`),
  startJob: (payload: { sessionId: string; students: JobStudentPayload[]; asunto: string; cuerpo: string; napsisConfig: NapsisConfig }) =>
    call<{ jobId: string }>("POST", "jobs", payload),
  job: (jobId: string) => call<JobSnapshot>("GET", `jobs/${jobId}`),
  cancelJob: (jobId: string) => call<{ ok: true }>("POST", `jobs/${jobId}/cancel`),
  eventsUrl: (jobId: string) => `/api/worker/jobs/${jobId}/events`,
}
