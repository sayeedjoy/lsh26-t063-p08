import { useEffect, useMemo, useRef, useState } from "react"

import { api, type CaseListItem } from "@/api"
import type { StudentResult } from "@/engine"
import { Figure, Mark } from "@/components/ledger"
import type { Page, Route } from "@/hooks/use-route"
import { cn } from "@/lib/utils"

const PAGES: Array<{ page: Page; label: string }> = [
  { page: "overview", label: "Roll" },
  { page: "audit", label: "Audit" },
  { page: "trace", label: "Trace" },
  { page: "checklists", label: "Checking lists" },
  { page: "calculator", label: "Mark sheet" },
  { page: "rules", label: "Rules" },
]

type Entry =
  | { kind: "page"; id: string; label: string; page: Page }
  | { kind: "case"; id: string; label: string; hint: string; caseId: string }
  | { kind: "student"; id: string; label: string; hint: string; student: StudentResult }

/**
 * Finding one candidate among 1,765 by scrolling is not a workflow, so the
 * register opens to a search: ⌘K anywhere jumps straight to a student, a
 * case, or a section.
 */
export function CommandPalette({
  onOpenChange,
  cases,
  caseId,
  navigate,
}: {
  onOpenChange: (open: boolean) => void
  cases: CaseListItem[]
  caseId: string | null
  navigate: (next: Partial<Route>) => void
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [students, setStudents] = useState<StudentResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // The roster is only worth fetching once someone actually opens the search.
  useEffect(() => {
    if (!caseId) return
    let live = true
    void api
      .caseDetail(caseId)
      .then((detail) => {
        if (live) setStudents(detail.results)
      })
      .catch(() => {
        if (live) setStudents([])
      })
    return () => {
      live = false
    }
  }, [caseId])

  // Focus after paint, or the dialog steals it back.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase()
    const pages: Entry[] = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({
      kind: "page",
      id: `page:${p.page}`,
      label: p.label,
      page: p.page,
    }))

    const caseEntries: Entry[] = cases
      .filter((c) => q.length >= 2 && c.caseId.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({
        kind: "case",
        id: `case:${c.caseId}`,
        label: c.caseId,
        hint: `${c.students} candidates · ${c.passRate}% pass`,
        caseId: c.caseId,
      }))

    const studentEntries: Entry[] = (
      q
        ? students.filter(
            (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
          )
        : students
    )
      .slice(0, 8)
      .map((s) => ({
        kind: "student",
        id: `student:${s.id}`,
        label: s.name,
        hint: `${s.id} · ${s.class}`,
        student: s,
      }))

    return [...studentEntries, ...caseEntries, ...pages]
  }, [query, students, cases])

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" })
  }, [active])

  const choose = (entry: Entry) => {
    if (entry.kind === "page") navigate({ page: entry.page })
    else if (entry.kind === "case") navigate({ caseId: entry.caseId })
    else navigate({ page: "trace", studentId: entry.student.id })
    onOpenChange(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onOpenChange(false)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (entries.length ? (i + 1) % entries.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (entries.length ? (i - 1 + entries.length) % entries.length : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const entry = entries[active]
      if (entry) choose(entry)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] print:hidden"
      onMouseDown={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find a candidate, case or section"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl border border-rule-strong bg-card shadow-2xl shadow-foreground/10"
      >
        <div className="flex items-center gap-2 border-b border-rule px-3">
          <span className="label-form shrink-0">Find</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Candidate name or roll number…"
            className="h-11 w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground"
          />
          <kbd className="cite shrink-0 rounded-sm border border-rule px-1.5 py-0.5">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              No candidate, case or section matches “{query}”.
            </p>
          ) : (
            entries.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                data-active={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(entry)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-rule/50 px-3 py-2 text-left last:border-b-0",
                  i === active && "bg-accent",
                )}
              >
                <span className="label-form w-14 shrink-0">
                  {entry.kind === "student" ? "cand" : entry.kind}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.label}</span>
                  {"hint" in entry && (
                    <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                      {entry.hint}
                    </span>
                  )}
                </span>
                {entry.kind === "student" &&
                  (entry.student.passed ? (
                    <Figure className="text-sm">{entry.student.gpaValue}</Figure>
                  ) : (
                    <Mark tone="oxide">cancelled</Mark>
                  ))}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-rule px-3 py-1.5">
          <span className="cite">↑↓ move</span>
          <span className="cite">⏎ open</span>
          <span className="cite ml-auto">
            {caseId ?? "no case"} · {students.length} on roll
          </span>
        </div>
      </div>
    </div>
  )
}
