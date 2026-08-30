import type { StudentResult } from "@/engine"
import { Figure, Sheet, SheetHead } from "@/components/ledger"
import { cn } from "@/lib/utils"

/**
 * The arithmetic, step by step, with the rule that authorises each step set in
 * the left margin. The margin is the point: an office checking this can run a
 * finger down the citations and see that every line has a rule behind it.
 */
export function GpaWorking({ student }: { student: StudentResult }) {
  const { gpa } = student

  const totals = [
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

      <dl className="grid grid-cols-2 border-t border-rule sm:grid-cols-4">
        {totals.map((total, i) => (
          <div
            key={total.label}
            className={cn(
              "border-rule px-3 py-2.5",
              i % 2 === 0 && "border-r",
              i === 1 && "sm:border-r",
              i === 2 && "sm:border-r",
              i < 2 && "border-b sm:border-b-0",
            )}
          >
            <dt className="label-form">{total.label}</dt>
            <dd className="mt-1">
              <Figure
                tone={total.oxide ? "oxide" : "ink"}
                className={cn("text-lg font-medium", total.oxide && "font-semibold")}
              >
                {total.value}
              </Figure>
              {total.note && (
                <span className="ml-1.5 text-[0.6875rem] text-muted-foreground">{total.note}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Sheet>
  )
}
