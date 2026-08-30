import type { CaseSummary, LetterGrade } from "@/engine"
import { Figure, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"
import { cn } from "@/lib/utils"

/** Best grade first. F is last because it is not a grade so much as a verdict. */
const LETTER_ORDER: LetterGrade[] = ["A+", "A", "A-", "B", "C", "D", "F"]

/** Grade is ordinal, so the ramp is too: strongest ink at the top of the scale. */
function letterFill(letter: LetterGrade, index: number) {
  if (letter === "F") return "var(--oxide)"
  const strength = 100 - index * 13
  return `color-mix(in oklab, var(--seal) ${strength}%, var(--card))`
}

/**
 * The figure band across the head of the sheet — one ruled row of the four
 * numbers the office reads first.
 */
function FigureBand({ summary }: { summary: CaseSummary }) {
  const entries = [
    { label: "Candidates", value: String(summary.students), note: summary.classes.join(" · ") },
    { label: "Passed", value: String(summary.passed), note: `${summary.passRate}% of the roll` },
    {
      label: "Cancelled",
      value: String(summary.failed),
      note: "a compulsory subject failed",
      oxide: summary.failed > 0,
    },
    { label: "Average GPA", value: summary.averageGpa, note: "passed candidates only" },
  ]

  return (
    <Sheet>
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {entries.map((entry, i) => (
          <div
            key={entry.label}
            className={cn(
              "border-rule px-4 py-3",
              // Ruled into columns, and into two rows once it wraps on mobile.
              i % 2 === 0 && "border-r sm:border-r",
              i === 1 && "sm:border-r",
              i === 2 && "sm:border-r",
              i < 2 && "border-b sm:border-b-0",
            )}
          >
            <dt className="label-form">{entry.label}</dt>
            <dd
              className={cn(
                "mt-1 font-mono text-[1.75rem] leading-none font-medium tabular-nums",
                entry.oxide && "text-oxide",
              )}
            >
              {entry.value}
            </dd>
            <p className="mt-1.5 text-[0.6875rem] leading-tight text-muted-foreground">{entry.note}</p>
          </div>
        ))}
      </dl>
    </Sheet>
  )
}

function GradeSpread({ summary }: { summary: CaseSummary }) {
  const max = Math.max(1, ...LETTER_ORDER.map((l) => summary.gradeSpread[l]))

  return (
    <Sheet cite="R-13">
      <SheetHead
        title="Grade spread"
        note="How the roll distributes across the letter scale. F is a cancelled result, not a low one."
      />
      <div className="space-y-2 p-4">
        {LETTER_ORDER.map((letter, i) => {
          const count = summary.gradeSpread[letter]
          const share = summary.students ? (count / summary.students) * 100 : 0
          return (
            <div key={letter} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-7 shrink-0 font-mono text-xs font-semibold tabular-nums",
                  letter === "F" && "text-oxide",
                )}
              >
                {letter}
              </span>
              <div className="h-5 min-w-0 flex-1 border border-rule/60 bg-muted/50">
                <div
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${(count / max) * 100}%`,
                    background: letterFill(letter, i),
                  }}
                />
              </div>
              <Figure className="w-8 shrink-0 text-right text-xs">{count}</Figure>
              <Figure tone="muted" className="w-12 shrink-0 text-right text-[0.6875rem]">
                {share.toFixed(1)}%
              </Figure>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function PerClass({ summary }: { summary: CaseSummary }) {
  return (
    <Sheet>
      <SheetHead title="By class" note="The same roll, split the way the school is." />
      <Ruled>
        <thead>
          <tr>
            <Th>Class</Th>
            <Th align="right">Candidates</Th>
            <Th align="right">Passed</Th>
            <Th align="right">Cancelled</Th>
            <Th align="right">Average GPA</Th>
          </tr>
        </thead>
        <tbody>
          {summary.byClass.map((c) => (
            <Tr key={c.class}>
              <Td className="font-medium">{c.class}</Td>
              <Td align="right">
                <Figure>{c.students}</Figure>
              </Td>
              <Td align="right">
                <Figure>{c.passed}</Figure>
              </Td>
              <Td align="right">
                <Figure tone={c.failed > 0 ? "oxide" : "muted"}>{c.failed}</Figure>
              </Td>
              <Td align="right">
                <Figure className="font-medium">{c.averageGpa}</Figure>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Ruled>
    </Sheet>
  )
}

function ChecklistCounts({
  summary,
  onOpenChecklists,
}: {
  summary: CaseSummary
  onOpenChecklists: () => void
}) {
  const { checklistCounts: counts } = summary
  const entries = [
    { label: "Optional rule", value: counts.optional },
    { label: "Practical fail", value: counts.practicalFail },
    { label: "Absent", value: counts.absent },
    { label: "On two or more", value: counts.multiple },
  ]

  return (
    <Sheet cite="R-29">
      <SheetHead
        title="Pending checks"
        note="Candidates whose result was decided by a rule the office checks by hand."
        actions={
          <button
            type="button"
            onClick={onOpenChecklists}
            className="h-7 rounded-sm border border-rule px-2.5 text-xs font-medium transition-colors hover:border-rule-strong hover:bg-accent"
          >
            Open the lists
          </button>
        }
      />
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {entries.map((entry, i) => (
          <div
            key={entry.label}
            className={cn(
              "border-rule px-4 py-3",
              i % 2 === 0 && "border-r",
              i === 1 && "sm:border-r",
              i === 2 && "sm:border-r",
              i < 2 && "border-b sm:border-b-0",
            )}
          >
            <dt className="label-form">{entry.label}</dt>
            <dd className="mt-1 font-mono text-xl leading-none tabular-nums">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  )
}

export function CaseSummaryBlocks({
  summary,
  onOpenChecklists,
}: {
  summary: CaseSummary
  onOpenChecklists: () => void
}) {
  return (
    <div className="space-y-4">
      <FigureBand summary={summary} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <GradeSpread summary={summary} />
        <div className="space-y-4">
          <PerClass summary={summary} />
          <ChecklistCounts summary={summary} onOpenChecklists={onOpenChecklists} />
        </div>
      </div>
    </div>
  )
}
