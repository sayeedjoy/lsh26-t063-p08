import type { StudentResult } from "@/engine"
import { Cite, Mark } from "@/components/ledger"
import { cn } from "@/lib/utils"

/**
 * What goes on the result sheet.
 *
 * This is the one place the design raises its voice. A cancelled result is
 * drawn the way a register records one: the figure the arithmetic produced is
 * struck through in oxide, and the published `0.00` is written beside it.
 * Both stay legible on purpose — R-13 requires the uncancelled average to
 * remain visible, and it is the number that explains the verdict.
 */
export function PublishedResult({
  student,
  className,
}: {
  student: StudentResult
  className?: string
}) {
  const { gpa } = student
  const cancelled = !student.passed

  return (
    <section
      className={cn(
        "border bg-card",
        cancelled ? "border-oxide/45" : "border-rule",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-4 py-2",
          cancelled ? "border-oxide/30 bg-oxide-soft" : "border-rule bg-muted/40",
        )}
      >
        <span className={cn("label-form", cancelled && "text-oxide")}>
          {cancelled ? "Result cancelled" : "Published result"}
        </span>
        <Cite className={cn(cancelled && "bg-oxide/10 text-oxide")}>R-13</Cite>
      </div>

      <div className="p-4">
        {cancelled ? (
          <>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
              <div>
                <p className="label-form">Arithmetic gave</p>
                <p className="struck mt-1 font-mono text-[2.5rem] leading-none tabular-nums">
                  {gpa.uncancelledGpa}
                </p>
              </div>
              <div>
                <p className="label-form text-oxide">Published</p>
                <p className="mt-1 flex items-baseline gap-2 font-mono leading-none text-oxide tabular-nums">
                  <span className="text-[2.5rem] font-semibold">0.00</span>
                  <span className="text-2xl font-semibold">F</span>
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-rule pt-3 text-sm leading-relaxed">
              Cancelled by{" "}
              <strong className="font-semibold text-oxide">
                {student.failingSubjects.join(", ")}
              </strong>
              . A compulsory subject at grade point 0 cancels the whole result, however high the
              rest of the sheet is.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <p className="font-mono text-[3rem] leading-none font-medium tabular-nums">
                {student.gpaValue}
              </p>
              <p className="heading-register text-2xl">{student.letter}</p>
            </div>
            {gpa.capped && (
              <p className="mt-3 border-t border-rule pt-3 text-sm text-muted-foreground">
                The arithmetic gave{" "}
                <span className="font-mono tabular-nums">{gpa.rawGpa}</span>; the scale stops at
                5.00, so that is what is published.
              </p>
            )}
          </>
        )}

        {(student.flags.optional || student.flags.practicalFail || student.flags.absent) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <span className="label-form">Checking lists</span>
            {student.flags.optional && <Mark>optional rule</Mark>}
            {student.flags.practicalFail && <Mark tone="ochre">practical fail</Mark>}
            {student.flags.absent && <Mark tone="oxide">absent</Mark>}
          </div>
        )}
      </div>
    </section>
  )
}
