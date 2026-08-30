/**
 * Task 12 — typed fetch client. Return types are the shared engine types
 * directly; nothing is redeclared here.
 */

import type {
  Archetype,
  AuditCriterion,
  CaseAudit,
  CaseSummary,
  Checklists,
  ChecklistRow,
  MultipleRow,
  RuleDoc,
  StudentResult,
  SubjectDef,
  RawMark,
} from "@/engine"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * Where the API lives.
 *
 * Empty by default, which means same-origin `/api/...` — that is what the Vite
 * dev proxy gives you, so nothing needs configuring while developing.
 *
 * The frontend and backend deploy as two separate containers, so in production
 * they are usually two different origins. The origin therefore comes from
 * `window.__APP_ENV__.API_URL`, which `/env.js` renders from the container's
 * `API_URL` environment variable at request time: set it in Dokploy and the
 * running container picks it up, no rebuild. `VITE_API_URL` remains as a
 * build-time fallback for static hosts that cannot run the server.
 */
const API_BASE = (
  window.__APP_ENV__?.API_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "")

export const apiUrl = (path: string) => `${API_BASE}/api${path}`

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const url = apiUrl(path)
  const res = await fetch(url, {
    method,
    ...(payload === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  })
  const body = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const message =
      body && typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText
    throw new ApiError(res.status, message)
  }
  if (body === null) {
    throw new ApiError(
      res.status,
      `The API returned a non-JSON response from ${url}. Check the frontend API_URL setting.`,
    )
  }
  return body as T
}

const get = <T>(path: string) => request<T>("GET", path)

export interface HealthResponse {
  ok: boolean
  problemId: string
  schemaVersion: string
  cases: number
  students: number
  evaluatedInMs: number
  loadedAt: string
  database: "connected" | "error" | "not configured"
}

export interface RulesResponse {
  rules: RuleDoc[]
  note: string
}

export interface CaseListItem {
  caseId: string
  students: number
  classes: string[]
  passRate: string
  averageGpa: string
}

export interface CaseDetail {
  caseId: string
  subjects: SubjectDef[]
  compulsory: string[]
  results: StudentResult[]
  summary: CaseSummary
}

export interface ChecklistsResponse extends Checklists {
  caseId: string
  counts: CaseSummary["checklistCounts"]
}

/** A mark sheet as typed into the calculator. */
export interface StudentInput {
  id: string
  name: string
  class: string
  optional: string
  marks: Record<string, RawMark>
}

export interface SavedCalculation {
  id: number
  caseId: string
  studentName: string
  studentClass: string
  optionalCode: string
  marks: Record<string, RawMark>
  result: StudentResult
  gpa: string
  letter: string
  passed: boolean
  createdAt: string
}

export interface Verification {
  caseId: string
  studentId: string
  listName: string
  verifiedBy: string
  note: string | null
  verifiedAt: string
}

const enc = encodeURIComponent

export const api = {
  health: () => get<HealthResponse>("/health"),
  rules: () => get<RulesResponse>("/rules"),
  cases: () => get<CaseListItem[]>("/cases"),
  caseDetail: (caseId: string) => get<CaseDetail>(`/cases/${enc(caseId)}`),
  student: (caseId: string, studentId: string) =>
    get<StudentResult>(`/cases/${enc(caseId)}/students/${enc(studentId)}`),
  checklists: (caseId: string) => get<ChecklistsResponse>(`/cases/${enc(caseId)}/checklists`),
  audit: (caseId: string) => get<CaseAudit>(`/cases/${enc(caseId)}/audit`),

  /** Grade a typed-in mark sheet server-side. Needs no database. */
  calculate: (caseId: string, student: StudentInput) =>
    request<StudentResult>("POST", "/calculate", { caseId, student }),

  listCalculations: () => get<SavedCalculation[]>("/calculations"),
  saveCalculation: (caseId: string, student: StudentInput) =>
    request<SavedCalculation>("POST", "/calculations", { caseId, student }),
  deleteCalculation: (id: number) => request<{ deleted: number }>("DELETE", `/calculations/${id}`),

  verifications: (caseId: string) => get<Verification[]>(`/cases/${enc(caseId)}/verifications`),
  verify: (caseId: string, input: { studentId: string; listName: string; verifiedBy: string; note?: string | null }) =>
    request<Verification>("POST", `/cases/${enc(caseId)}/verifications`, input),
  unverify: (caseId: string, studentId: string, listName: string) =>
    request<{ cleared: boolean }>("DELETE", `/cases/${enc(caseId)}/verifications/${enc(studentId)}/${enc(listName)}`),
}

export type { Archetype, AuditCriterion, CaseAudit, ChecklistRow, MultipleRow, RawMark, RuleDoc, StudentResult, SubjectDef }
