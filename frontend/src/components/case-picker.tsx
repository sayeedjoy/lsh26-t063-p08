import { ChevronDown } from "lucide-react"

import type { CaseListItem } from "@/api"
import { cn } from "@/lib/utils"

/**
 * Which of the 25 published cases the register is open at.
 *
 * The option text carries the case's roll size and pass rate, so choosing a
 * case is an informed move rather than picking a code out of a list.
 */
export function CasePicker({
  cases,
  activeCaseId,
  onSelect,
  className,
}: {
  cases: CaseListItem[]
  activeCaseId: string | null
  onSelect: (caseId: string) => void
  className?: string
}) {
  const active = cases.find((c) => c.caseId === activeCaseId)

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="case-picker" className="sr-only">
        Case
      </label>
      <select
        id="case-picker"
        value={activeCaseId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className={cn(
          "h-8 w-full appearance-none rounded-sm border border-rule bg-card py-0 pr-7 pl-2.5",
          "font-mono text-xs font-medium tabular-nums",
          "cursor-pointer transition-colors hover:border-rule-strong",
        )}
      >
        {cases.map((c) => (
          <option key={c.caseId} value={c.caseId}>
            {c.caseId} · {c.students} cand · {c.passRate}%
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      {active && <span className="sr-only">{active.students} candidates</span>}
    </div>
  )
}
