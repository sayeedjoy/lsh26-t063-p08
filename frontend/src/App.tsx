import { useEffect, useState } from "react"
import { Search } from "lucide-react"

import { api } from "@/api"
import { CasePicker } from "@/components/case-picker"
import { CommandPalette } from "@/components/command-palette"
import { Sheet, SheetSkeleton } from "@/components/ledger"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAsync } from "@/hooks/use-async"
import { useRoute, type Page } from "@/hooks/use-route"
import { cn } from "@/lib/utils"
import { AuditPage } from "@/pages/audit"
import { CalculatorPage } from "@/pages/calculator"
import { ChecklistsPage } from "@/pages/checklists"
import { OverviewPage } from "@/pages/overview"
import { RulesPage } from "@/pages/rules"
import { StudentTracePage } from "@/pages/student-trace"

/**
 * The office's own path through the book, in the order it is walked.
 *
 * Four of these five sections show a record that has already been computed.
 * The mark sheet is the only one you operate — type marks and every rule
 * fires live — so it is the only one that carries a badge saying so.
 */
const NAV: Array<{ page: Page; label: string; note: string; badge?: string }> = [
  { page: "overview", label: "Roll", note: "Every candidate in the case" },
  { page: "audit", label: "Audit", note: "Proof the hard cases are here" },
  { page: "trace", label: "Trace", note: "How one result was reached" },
  { page: "checklists", label: "Checking lists", note: "What needs a human eye" },
  {
    page: "calculator",
    label: "Mark sheet",
    note: "Type marks, watch the rules fire",
    badge: "Try it",
  },
  { page: "rules", label: "Rules", note: "The rules being applied" },
]

export function App() {
  const [route, navigate] = useRoute()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { data: cases, error: casesError, loading: casesLoading } = useAsync(() => api.cases(), [])
  const { data: health } = useAsync(() => api.health(), [])

  useEffect(() => {
    if (!route.caseId && cases && cases.length > 0) {
      navigate({ caseId: cases[0]!.caseId })
    }
  }, [route.caseId, cases, navigate])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const activeCase = cases?.find((c) => c.caseId === route.caseId)

  return (
    <div className="min-h-svh lg:flex">
      {/* The spine of the book: what is in it, and where you are in it. */}
      <aside
        className={cn(
          "border-rule bg-sidebar lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:shrink-0 lg:border-r",
          "border-b lg:border-b-0 print:hidden",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-rule px-4 py-3.5 lg:border-b">
            <p className="cite text-muted-foreground">P08 · school results</p>
            <h1 className="heading-masthead mt-1 text-[0.9375rem] text-foreground">
              Tabulation
              <br />
              Register
            </h1>
          </div>

          {/* Below the sidebar breakpoint the sections were a horizontal
              scroller, which put half the book off the edge of the screen with
              nothing to say so. Laid out as a ruled grid instead, every
              section is visible at once — hairline gaps do the ruling, the
              way the index page of a register is set. */}
          <nav
            aria-label="Sections"
            className={cn(
              "grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 md:grid-cols-6",
              "lg:flex lg:flex-1 lg:flex-col lg:gap-0 lg:bg-transparent lg:p-2",
            )}
          >
            {NAV.map((item) => {
              const current = route.page === item.page
              return (
                <button
                  key={item.page}
                  onClick={() => navigate({ page: item.page })}
                  aria-current={current ? "page" : undefined}
                  title={item.note}
                  className={cn(
                    "group relative px-3 py-2.5 text-left transition-colors lg:px-3 lg:py-2",
                    current
                      ? "bg-card text-foreground"
                      : "bg-sidebar text-muted-foreground hover:bg-accent/70 hover:text-foreground lg:bg-transparent",
                  )}
                >
                  {/* Where the reader's thumb is in the book. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 bg-seal transition-opacity",
                      current ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pb-0.5">
                    <span className="heading-register text-[0.9375rem]">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "badge-live inline-flex shrink-0 items-center rounded-sm px-1.5 py-px",
                          "bg-seal font-mono text-[0.625rem] leading-tight font-medium text-seal-foreground",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <span className="hidden text-[0.6875rem] leading-tight text-muted-foreground lg:block">
                    {item.note}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* The colophon: what this book was made from. */}
          <div className="hidden border-t border-rule px-4 py-3 lg:block">
            <dl className="space-y-1 font-mono text-[0.6875rem] tabular-nums">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">cases</dt>
                <dd>{health?.cases ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">candidates</dt>
                <dd>{health?.students?.toLocaleString() ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">evaluated in</dt>
                <dd>{health ? `${health.evaluatedInMs} ms` : "—"}</dd>
              </div>
            </dl>
            <p className="mt-2.5 flex items-center gap-1.5 border-t border-rule pt-2.5 text-[0.6875rem] text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  health?.database === "connected"
                    ? "bg-seal"
                    : health?.database === "error"
                      ? "bg-oxide"
                      : "bg-rule-strong",
                )}
              />
              <span className="font-mono">database {health?.database ?? "…"}</span>
            </p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Everything you can do to the whole register, in one strip. */}
        <header className="sticky top-0 z-20 border-b border-rule bg-background/90 backdrop-blur print:hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-7">
            {cases && (
              <CasePicker
                cases={cases}
                activeCaseId={route.caseId}
                onSelect={(caseId) => navigate({ caseId, page: route.page })}
                className="w-64"
              />
            )}
            {activeCase && (
              <p className="hidden font-mono text-[0.6875rem] text-muted-foreground sm:block">
                {activeCase.classes.join(" · ")}
              </p>
            )}

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={cn(
                "ml-auto flex h-8 items-center gap-2 rounded-sm border border-rule bg-card px-2.5",
                "text-xs text-muted-foreground transition-colors hover:border-rule-strong hover:text-foreground",
              )}
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Find a candidate</span>
              <kbd className="cite hidden rounded-sm border border-rule px-1 sm:inline">⌘K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </header>

        <main className="px-4 py-6 lg:px-7 lg:py-8">
          <div className="mx-auto max-w-6xl">
            {casesError && <ErrorState message={casesError} />}
            {casesLoading && !cases && <PageSkeleton />}
            {cases && route.caseId && (
              <>
                {route.page === "overview" && (
                  <OverviewPage
                    caseId={route.caseId}
                    onOpenStudent={(id) => navigate({ page: "trace", studentId: id })}
                    onOpenChecklists={() => navigate({ page: "checklists" })}
                    onOpenAudit={() => navigate({ page: "audit" })}
                    onOpenSheet={(id) => navigate({ page: "calculator", sheetId: id })}
                  />
                )}
                {route.page === "audit" && (
                  <AuditPage
                    caseId={route.caseId}
                    onOpenStudent={(id) => navigate({ page: "trace", studentId: id })}
                  />
                )}
                {route.page === "calculator" && (
                  <CalculatorPage caseId={route.caseId} sheetId={route.sheetId} />
                )}
                {route.page === "trace" && (
                  <StudentTracePage
                    caseId={route.caseId}
                    studentId={route.studentId}
                    onSelectStudent={(id) => navigate({ page: "trace", studentId: id })}
                  />
                )}
                {route.page === "checklists" && (
                  <ChecklistsPage
                    caseId={route.caseId}
                    onOpenStudent={(id) => navigate({ page: "trace", studentId: id })}
                  />
                )}
                {route.page === "rules" && <RulesPage />}
              </>
            )}
          </div>
        </main>
      </div>

      {cases && paletteOpen && (
        <CommandPalette
          onOpenChange={setPaletteOpen}
          cases={cases}
          caseId={route.caseId}
          navigate={navigate}
        />
      )}
    </div>
  )
}

/** The masthead of a single page of the register. */
export function PageHead({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-foreground pb-3">
      <div className="min-w-0">
        {/* Stamped, not printed: the one line that says which case you are
            reading sits in the seal's own colour, the way an office marks a
            form it has picked up. */}
        <p className="label-form inline-block rounded-sm border border-seal/40 bg-seal-soft px-2 py-1 text-seal">
          {eyebrow}
        </p>
        <h2 className="heading-register mt-2 text-[2rem]">{title}</h2>
        {children && (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{children}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  )
}

/** Errors name what failed and what to do — they do not apologise. */
export function ErrorState({ message }: { message: string }) {
  return (
    <Sheet className="border-oxide/40 bg-oxide-soft">
      <div className="p-4">
        <p className="heading-register text-sm text-oxide">The register could not be read.</p>
        <p className="mt-1 font-mono text-xs text-oxide/80">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Check that the API is running, then reload.
        </p>
      </div>
    </Sheet>
  )
}

export function LoadingState() {
  return <PageSkeleton />
}

function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <SheetSkeleton rows={3} />
      <SheetSkeleton rows={8} />
    </div>
  )
}

export default App
