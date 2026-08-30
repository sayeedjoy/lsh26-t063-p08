import type { StudentResult } from "@/engine"
import { FigureRow, Sheet, SheetHead, type FigureCell } from "@/components/ledger"

/**
 * The arithmetic, step by step, with the rule that authorises each step set in
 * the left margin. The margin is the point: an office checking this can run a
 * finger down the citations and see that every line has a rule behind it.
 */
export function GpaWorking({ student }: { student: StudentResult }) {
  const { gpa } = student

  const totals: FigureCell[] = [
    { label: "Compulsory sum", value: gpa.compulsorySum },
    { label: "Optional adds", value: gpa.optionalContribution },
    {
      label: "Uncancelled average",
      value: gpa.uncancelledGpa,
      note: gpa.capped ? `capped from ${gpa.rawGpa}` : undefined,
    },
    {
      label: "Published",
      value: gpa.publishedGpa,
      oxide: !student.passed,
      note: student.passed ? student.letter : "cancelled",
    },
  ]

  return (
    <Sheet>
      <SheetHead
        title="How the GPA was reached"
        note="Each line names the rule that authorises it. Grade points are held as tenths, so no rounding happens before the final division."
      />

      <ol className="divide-y divide-rule/60">
        {gpa.steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-start">
            <span className="cite border-r border-rule/60 px-3 py-2.5 text-right">
              {step.ruleId}
            </span>
            <span className="px-3 py-2.5 text-sm leading-relaxed">{step.text}</span>
          </li>
        ))}
      </ol>

      <FigureRow cells={totals} size="sm" className="border-t border-rule" />
    </Sheet>
  )
}
