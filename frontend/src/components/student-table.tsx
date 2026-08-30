import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import type { StudentResult } from "@/engine"
import type { PageSize } from "@/components/ledger"
import {
  Empty,
  Figure,
  Mark,
  Pagination,
  Ruled,
  Sheet,
  SheetHead,
  StruckFigure,
  Td,
  Th,
  Tr,
} from "@/components/ledger"
import { cn } from "@/lib/utils"

type SortKey = "name" | "id" | "class" | "gpa"

const LETTERS = ["A+", "A", "A-", "B", "C", "D", "F"] as const

const LISTS = [
  { value: "", label: "Whole roll" },
  { value: "optional", label: "On the optional list" },
  { value: "practicalFail", label: "On the practical-fail list" },
  { value: "absent", label: "On the absent list" },
] as const

/** Filters read as a strip of form fields, because that is what they are. */
function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="label-form">{label}</span>
      {children}
    </label>
  )
}

const controlClass =
  "h-8 rounded-sm border border-rule bg-card px-2 text-xs transition-colors hover:border-rule-strong"

export function StudentTable({
  students,
  onOpenStudent,
}: {
  students: StudentResult[]
  onOpenStudent: (id: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gpa")
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [letterFilter, setLetterFilter] = useState<string>("")
  const [listFilter, setListFilter] = useState<(typeof LISTS)[number]["value"]>("")
  const [query, setQuery] = useState("")
  const [pageSize, setPageSize] = useState<PageSize>(50)
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    let filtered = students
    if (letterFilter) filtered = filtered.filter((s) => s.letter === letterFilter)
    if (listFilter) filtered = filtered.filter((s) => s.flags[listFilter])
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      filtered = filtered.filter(
        (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
      )
    }
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * sortDir
      if (sortKey === "id") return a.id.localeCompare(b.id) * sortDir
      if (sortKey === "class") return a.class.localeCompare(b.class) * sortDir
      return (a.gpaHundredths - b.gpaHundredths) * sortDir
    })
  }, [students, letterFilter, listFilter, query, sortKey, sortDir])

  /* A leaf of the roll. The whole roll is still sorted and filtered above —
     only the rows put on screen are cut down, so counts stay honest. */
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const start = pageSize === "all" ? 0 : (current - 1) * pageSize
  const pageRows = pageSize === "all" ? rows : rows.slice(start, start + pageSize)

  /* A new case is a new register: leaf 12 of the old one means nothing here. */
  const [shown, setShown] = useState(students)
  if (shown !== students) {
    setShown(students)
    setPage(1)
  }

  /* Every control that reorders or narrows the roll turns back to leaf one,
     because the rows under your cursor are not the rows you were reading. */
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setSortDir(key === "gpa" ? -1 : 1)
    }
    setPage(1)
  }

  const sortFor = (key: SortKey) => (sortKey === key ? (sortDir === 1 ? "asc" : "desc") : false)
  const filtered = rows.length !== students.length

  const clear = () => {
    setQuery("")
    setLetterFilter("")
    setListFilter("")
    setPage(1)
  }

  return (
    <Sheet>
      <SheetHead
        title="Candidate roll"
        count={students.length}
        note="Every candidate in the case, with the published GPA. Open one to see how it was reached."
        actions={
          <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
            showing {rows.length}
          </span>
        }
      />

      <div className="flex flex-wrap items-end gap-3 border-b border-rule p-3 print:hidden">
        <Field label="Search" className="min-w-[12rem] flex-1">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Name or roll number"
              className={cn(controlClass, "w-full pl-7 font-mono")}
            />
          </div>
        </Field>

        <Field label="Letter">
          <select
            value={letterFilter}
            onChange={(e) => {
              setLetterFilter(e.target.value)
              setPage(1)
            }}
            className={cn(controlClass, "font-mono")}
          >
            <option value="">All letters</option>
            {LETTERS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Checking list">
          <select
            value={listFilter}
            onChange={(e) => {
              setListFilter(e.target.value as typeof listFilter)
              setPage(1)
            }}
            className={controlClass}
          >
            {LISTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        {filtered && (
          <button
            type="button"
            onClick={clear}
            className="h-8 rounded-sm px-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>
          No candidate on this roll matches those filters.{" "}
          <button
            type="button"
            onClick={clear}
            className="text-foreground underline underline-offset-4"
          >
            Clear them
          </button>
          .
        </Empty>
      ) : (
        <Ruled minWidth="46rem">
          <thead>
            <tr>
              <Th sort={sortFor("name")} onSort={() => toggleSort("name")}>
                Candidate
              </Th>
              <Th className="w-24" sort={sortFor("id")} onSort={() => toggleSort("id")}>
                Roll
              </Th>
              <Th className="w-24" sort={sortFor("class")} onSort={() => toggleSort("class")}>
                Class
              </Th>
              <Th className="w-32" align="right" sort={sortFor("gpa")} onSort={() => toggleSort("gpa")}>
                GPA
              </Th>
              <Th className="w-20" align="center">Letter</Th>
              <Th className="w-40 print:hidden">Checking lists</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s) => (
              <Tr key={s.id} flagged={!s.passed} onClick={() => onOpenStudent(s.id)}>
                <Td>
                  {/* The name is the control, so the row is reachable by keyboard. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenStudent(s.id)
                    }}
                    className="text-left font-medium underline-offset-4 hover:underline"
                  >
                    {s.name}
                  </button>
                </Td>
                <Td>
                  <Figure tone="muted" className="text-xs">
                    {s.id}
                  </Figure>
                </Td>
                <Td className="text-xs">{s.class}</Td>
                <Td align="right">
                  {s.passed ? (
                    <Figure className="font-medium">{s.gpaValue}</Figure>
                  ) : (
                    <StruckFigure computed={s.gpa.uncancelledGpa} published="0.00" />
                  )}
                </Td>
                <Td align="center">
                  <Figure tone={s.letter === "F" ? "oxide" : "ink"} className="font-semibold">
                    {s.letter}
                  </Figure>
                </Td>
                <Td className="print:hidden">
                  <div className="flex flex-wrap gap-1">
                    {s.flags.optional && <Mark title="On the optional-subject list">OPT</Mark>}
                    {s.flags.practicalFail && (
                      <Mark tone="ochre" title="On the practical-fail list">
                        PRAC
                      </Mark>
                    )}
                    {s.flags.absent && (
                      <Mark tone="oxide" title="On the absent list">
                        AB
                      </Mark>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Ruled>
      )}

      {rows.length > 0 && (
        <Pagination
          page={current}
          pageCount={pageCount}
          from={start + 1}
          to={start + pageRows.length}
          total={rows.length}
          unit="candidates"
          pageSize={pageSize}
          pageSizes={[25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      )}
    </Sheet>
  )
}
