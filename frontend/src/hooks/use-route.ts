/**
 * URL-synced app state via plain query params — no router dependency.
 * ?case=PUB-01&page=trace&student=S001
 * ?case=PUB-01&page=calculator&sheet=4
 */

import { useCallback, useSyncExternalStore } from "react"

export type Page = "overview" | "audit" | "calculator" | "trace" | "checklists" | "rules"

export interface Route {
  caseId: string | null
  page: Page
  studentId: string | null
  /** A saved sheet to load into the mark sheet, so the roll can link to one. */
  sheetId: number | null
}

/** Saved-sheet ids are positive integers; anything else is not a sheet. */
function sheetIdFrom(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseRoute(search: string): Route {
  const params = new URLSearchParams(search)
  const page = params.get("page")
  return {
    caseId: params.get("case"),
    page:
      page === "audit" ||
      page === "calculator" ||
      page === "trace" ||
      page === "checklists" ||
      page === "rules"
        ? page
        : "overview",
    studentId: params.get("student"),
    // `Number(null)` is 0 and `Number("")` is 0, so an absent param has to be
    // rejected before the number is looked at — otherwise every page believes
    // it was asked for sheet 0.
    sheetId: sheetIdFrom(params.get("sheet")),
  }
}

// useSyncExternalStore requires getSnapshot to return a referentially stable
// value when nothing has changed — parseRoute() builds a new object every
// call, so we cache it against the query string that produced it. Without
// this the snapshot looks different on every render and React throws
// ("The result of getSnapshot should be cached") before anything mounts.
let cachedSearch: string | null = null
let cachedRoute: Route | null = null

function readRoute(): Route {
  const search = window.location.search
  if (cachedRoute === null || cachedSearch !== search) {
    cachedSearch = search
    cachedRoute = parseRoute(search)
  }
  return cachedRoute
}

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  return () => window.removeEventListener("popstate", callback)
}

export function useRoute(): [Route, (next: Partial<Route>) => void] {
  const route = useSyncExternalStore(subscribe, readRoute, readRoute)

  const navigate = useCallback((next: Partial<Route>) => {
    const current = readRoute()
    const merged: Route = { ...current, ...next }
    const params = new URLSearchParams()
    if (merged.caseId) params.set("case", merged.caseId)
    if (merged.page && merged.page !== "overview") params.set("page", merged.page)
    if (merged.studentId && merged.page === "trace") params.set("student", merged.studentId)
    if (merged.sheetId !== null && merged.page === "calculator") {
      params.set("sheet", String(merged.sheetId))
    }
    const query = params.toString()
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.pushState({}, "", url)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, [])

  return [route, navigate]
}
