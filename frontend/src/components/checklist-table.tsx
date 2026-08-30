import type { ChecklistRow } from "@/engine"
import type { Verification } from "@/api"
import { Empty, Figure, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"
import { cn } from "@/lib/utils"

/** How far through a list the office has got, at a glance. */
function Progress({ done, total }: { done: number; total: number }) {
  const complete = done === total
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted print:hidden">
        <span
          className={cn("block h-full transition-[width] duration-300", complete ? "bg-seal" : "bg-ochre")}
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </span>
      <span
        className={cn(
          "font-mono text-[0.6875rem] tabular-nums",
          complete ? "text-seal" : "text-muted-foreground",
        )}
      >
        {done} of {total} checked
      </span>
    </span>
  )
}

export function ChecklistTable({
  title,
  rule,
  cite,
  listName,
  rows,
  verifications,
  canVerify,
  onOpenStudent,
  onToggleVerify,
}: {
  title: string
  rule: string
  cite: string
  listName: string
  rows: ChecklistRow[]
  verifications: Map<string, Verification>
  canVerify: boolean
  onOpenStudent: (studentId: string) => void
  onToggleVerify: (studentId: string, listName: string, verified: boolean) => void
}) {
  const done = rows.filter((r) => verifications.has(`${r.id}|${listName}`)).length

  return (
    <Sheet cite={cite}>
      <SheetHead
        title={title}
        count={rows.length}
        note={rule}
        actions={canVerify && rows.length > 0 ? <Progress done={done} total={rows.length} /> : undefined}
      />

      {rows.length === 0 ? (
        <Empty>Nobody in this case was caught by this rule. Nothing to check.</Empty>
      ) : (
        <Ruled minWidth="48rem" stickyHead>
          <thead>
            <tr>
              {canVerify && (
                <Th align="center" className="w-12">
                  <span className="print:hidden">✓</span>
                  <span className="hidden print:inline">Initial</span>
                </Th>
              )}
              <Th>Candidate</Th>
              <Th>Subject</Th>
              <Th>Detail</Th>
              <Th align="right">GPA</Th>
              <Th>Why it is on this list</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const verification = verifications.get(`${r.id}|${listName}`)
              return (
                <Tr key={`${r.id}-${r.subject}`} verified={!!verification}>
                  {canVerify && (
                    <Td align="center">
                      <input
                        type="checkbox"
                        checked={!!verification}
                        onChange={(e) => onToggleVerify(r.id, listName, e.target.checked)}
                        aria-label={`Mark ${r.name} as hand-checked`}
                        title={
                          verification
                            ? `Checked by ${verification.verifiedBy} on ${new Date(verification.verifiedAt).toLocaleString()}`
                            : "Mark as hand-checked"
                        }
                        className="size-4 cursor-pointer accent-[var(--seal)] print:hidden"
                      />
                      {/* On paper the tick is made by hand, so leave a box for it. */}
                      <span className="hidden size-3.5 border border-foreground print:inline-block" />
                    </Td>
                  )}
                  <Td>
                    <button
                      type="button"
                      onClick={() => onOpenStudent(r.id)}
                      className="text-left font-medium underline-offset-4 hover:underline"
                    >
                      {r.name}
                    </button>
                    <p className="font-mono text-[0.6875rem] text-muted-foreground">
                      {r.id} · {r.class}
                    </p>
                    {verification && (
                      <p className="mt-0.5 font-mono text-[0.6875rem] text-seal">
                        checked by {verification.verifiedBy}
                      </p>
                    )}
                  </Td>
                  <Td className="text-xs">{r.subject}</Td>
                  <Td>
                    <Figure tone="muted" className="text-xs">
                      {r.detail}
                    </Figure>
                  </Td>
                  <Td align="right">
                    <Figure tone={r.letter === "F" ? "oxide" : "ink"}>
                      {r.gpa}{" "}
                      <span className={r.letter === "F" ? "font-semibold" : "text-muted-foreground"}>
                        {r.letter}
                      </span>
                    </Figure>
                  </Td>
                  <Td className="max-w-[22rem] text-xs leading-relaxed text-muted-foreground">
                    {r.reason}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Ruled>
      )}
    </Sheet>
  )
}
