import { useEffect, useState } from "react"

import { api, type SavedCalculation } from "@/api"
import { Figure, Mark, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"

/**
 * Sheets the office typed itself, shown at the foot of the roll.
 *
 * They are kept in their own band rather than folded into the roll above, and
 * the reason is the whole persistence design: every published grade is
 * recomputed from the dataset at boot, so the case figures, the audit and the
 * checking lists all describe the supplied roll and nothing else. Merging a
 * typed sheet into that roll would make the count on this page disagree with
 * the count the API, the audit and the export all report.
 *
 * So the register does what a real one does with a late entry: it writes it on
 * the same page, below the ruled roll, and marks it as an addition.
 */
export function SavedSheets({
  caseId,
  onOpenSheet,
}: {
  caseId: string
  onOpenSheet: (sheetId: number) => void
}) {
  const [rows, setRows] = useState<SavedCalculation[] | null>(null)

  // Deliberately not `useAsync`: with no database this returns 503, and a
  // missing database is not an error worth showing on the roll — it just means
  // there are no saved sheets to show.
  useEffect(() => {
    let live = true
    api
      .listCalculations()
      .then((all) => live && setRows(all.filter((r) => r.caseId === caseId)))
      .catch(() => live && setRows(null))
    return () => {
      live = false
    }
  }, [caseId])

  if (!rows || rows.length === 0) return null

  return (
    <Sheet>
      <SheetHead
        title="Saved sheets"
        count={rows.length}
        note="Sheets typed into the mark sheet and kept. They are graded by the same engine as the roll above, but they are additions to it — the case figures, the audit and the checking lists describe the supplied roll only. Open one to load it back into the form."
      />
      <Ruled minWidth="38rem">
        <thead>
          <tr>
            <Th>Candidate</Th>
            <Th>Class</Th>
            <Th align="right">GPA</Th>
            <Th>Letter</Th>
            <Th>Saved</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.id} flagged={!row.passed} onClick={() => onOpenSheet(row.id)}>
              <Td>
                <span className="font-medium">{row.studentName}</span>{" "}
                <Mark tone="ochre" title="Typed into the mark sheet, not part of the supplied roll">
                  added
                </Mark>
                <p className="font-mono text-[0.6875rem] text-muted-foreground">
                  optional {row.optionalCode}
                </p>
              </Td>
              <Td className="text-[0.8125rem]">{row.studentClass}</Td>
              <Td align="right">
                <Figure tone={row.passed ? "ink" : "oxide"} className="font-medium">
                  {row.gpa}
                </Figure>
              </Td>
              <Td>
                <Figure tone={row.passed ? "ink" : "oxide"} className="font-semibold">
                  {row.letter}
                </Figure>
              </Td>
              <Td>
                <Figure tone="muted" className="text-[0.6875rem]">
                  {new Date(row.createdAt).toLocaleString()}
                </Figure>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Ruled>
    </Sheet>
  )
}
