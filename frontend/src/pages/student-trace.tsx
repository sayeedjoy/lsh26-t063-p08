import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react"

import { ErrorState, LoadingState, PageHead } from "@/App"
import { api } from "@/api"
import { GpaWorking } from "@/components/gpa-working"
import { Empty, Figure, Mark } from "@/components/ledger"
import { PublishedResult } from "@/components/published-result"
import { TraceTable } from "@/components/trace-table"
import { useAsync } from "@/hooks/use-async"
import { cn } from "@/lib/utils"

export function StudentTracePage({
  caseId,
  studentId,
  onSelectStudent,
}: {
  caseId: string
  studentId: string | null
  onSelectStudent: (studentId: string) => void
}) {
  const { data, error, loading } = useAsync(() => api.caseDetail(caseId), [caseId])
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!studentId && data && data.results.length > 0) {
      onSelectStudent(data.results[0]!.id)
    }
  }, [studentId, data, onSelectStudent])

  const matches = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.results
    return data.results.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    )
  }, [data, query])

  const results = data?.results ?? []
  const index = results.findIndex((s) => s.id === studentId)
  const student = index >= 0 ? results[index]! : null
  const previous = index > 0 ? results[index - 1]! : null
  const next = index >= 0 && index < results.length - 1 ? results[index + 1]! : null

  if (error) return <ErrorState message={error} />
  if (loading && !data) return <LoadingState />
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow={`Case ${caseId}`}
        title={student ? student.name : "Calculation trace"}
        actions={
          student && (
            <>
              <div className="flex items-center rounded-sm border border-rule bg-card">
                <button
                  type="button"
                  disabled={!previous}
                  onClick={() => previous && onSelectStudent(previous.id)}
                  title={previous ? `Previous: ${previous.name}` : "First on the roll"}
                  className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">Previous candidate</span>
                </button>
                <span className="border-x border-rule px-2 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                  {index + 1} / {results.length}
                </span>
                <button
                  type="button"
                  disabled={!next}
                  onClick={() => next && onSelectStudent(next.id)}
                  title={next ? `Next: ${next.name}` : "Last on the roll"}
                  className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                  <span className="sr-only">Next candidate</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-7 items-center gap-1.5 rounded-sm border border-rule bg-card px-2.5 text-xs font-medium transition-colors hover:border-rule-strong hover:bg-accent"
              >
                <Printer className="size-3.5" />
                Print this trace
              </button>
            </>
          )
        }
      >
        {student
          ? `Roll ${student.id} · ${student.class}. Every figure below, and the rule that produced it.`
          : "Pick a candidate to see how their result was reached."}
      </PageHead>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* The roll, kept to hand so you can walk it without leaving the trace. */}
        <aside className="lg:sticky lg:top-[4.25rem] lg:self-start print:hidden">
          <div className="relative mb-2">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              placeholder="Filter the roll"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full rounded-sm border border-rule bg-card pr-2 pl-7 font-mono text-xs transition-colors hover:border-rule-strong"
            />
          </div>

          <div className="max-h-[65vh] overflow-y-auto border border-rule bg-card">
            {matches.length === 0 ? (
              <Empty>No candidate matches “{query}”.</Empty>
            ) : (
              matches.map((s) => {
                const current = s.id === studentId
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelectStudent(s.id)}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "relative flex w-full items-baseline gap-2 border-b border-rule/60 px-2.5 py-1.5 text-left last:border-b-0",
                      current ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-0.5 bg-seal",
                        current ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{s.name}</span>
                      <span className="block font-mono text-[0.625rem] text-muted-foreground">
                        {s.id} · {s.class}
                      </span>
                    </span>
                    {s.passed ? (
                      <Figure className="text-[0.6875rem]">{s.gpaValue}</Figure>
                    ) : (
                      <Mark tone="oxide">F</Mark>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {!student ? (
            <div className="border border-rule bg-card">
              <Empty>Pick a candidate from the roll to see their trace.</Empty>
            </div>
          ) : (
            <>
              <PublishedResult student={student} />
              <TraceTable student={student} />
              <GpaWorking student={student} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
