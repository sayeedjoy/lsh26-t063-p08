import { Fragment } from "react"

import type { StudentResult } from "@/engine"
import { Cite, Figure, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"
import { cn } from "@/lib/utils"

/**
 * The tabulation row itself: what was marked, what was used, what it scored,
 * and which rule decided that. The remark under each row is the register's
 * annotation column — it says in words what the figures did.
 */
export function TraceTable({ student }: { student: StudentResult }) {
  return (
    <Sheet>
      <SheetHead
        title="Subject tabulation"
        count={student.subjects.length}
        note="Every subject as the engine read it. A shaded row is one that cancelled the result."
      />
      <Ruled minWidth="40rem">
        <thead>
          <tr>
            <Th>Subject</Th>
            <Th>Role</Th>
            <Th align="right">Theory</Th>
            <Th align="right">Practical</Th>
            <Th align="right">Mark used</Th>
            <Th align="right">Grade point</Th>
            <Th align="center">Rule</Th>
          </tr>
        </thead>
        <tbody>
          {student.subjects.map((s) => (
            <Fragment key={s.code}>
              <Tr flagged={s.failed} className="border-b-0">
                <Td className="font-medium">
                  {s.name}
                  <span className="ml-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                    {s.code}
                  </span>
                </Td>
                <Td className="text-xs text-muted-foreground">{s.role}</Td>
                <Td align="right">
                  <Figure tone={s.theoryFailed && !s.absent ? "oxide" : "ink"} className="text-xs">
                    {s.theoryDisplay}
                  </Figure>
                </Td>
                <Td align="right">
                  <Figure
                    tone={s.practicalFailed ? "oxide" : s.hasPractical ? "ink" : "muted"}
                    className="text-xs"
                  >
                    {s.practicalDisplay}
                  </Figure>
                </Td>
                <Td align="right">
                  <Figure className="text-xs">{s.totalDisplay}</Figure>
                </Td>
                <Td align="right">
                  <Figure tone={s.failed ? "oxide" : "ink"} className="font-semibold">
                    {s.gradePoint}
                  </Figure>
                </Td>
                <Td align="center">
                  <Cite>{s.ruleId}</Cite>
                </Td>
              </Tr>
              {/* The remark: the same decision, said in words. */}
              <Tr flagged={s.failed}>
                <Td
                  colSpan={7}
                  className={cn(
                    "pt-0 pb-2 pl-3 text-xs leading-relaxed",
                    s.failed ? "text-oxide" : "text-muted-foreground",
                  )}
                >
                  <span aria-hidden className="mr-1.5 font-mono text-rule-strong">
                    ↳
                  </span>
                  {s.reason}
                </Td>
              </Tr>
            </Fragment>
          ))}
        </tbody>
      </Ruled>
    </Sheet>
  )
}
