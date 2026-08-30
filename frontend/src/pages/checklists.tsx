import { useCallback, useEffect, useMemo, useState } from "react"
import { Printer } from "lucide-react"

import { ErrorState, LoadingState, PageHead } from "@/App"
import { api, type Verification } from "@/api"
import { ChecklistTable } from "@/components/checklist-table"
import { Empty, Figure, Mark, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"
import { useAsync } from "@/hooks/use-async"

const VERIFIER_KEY = "p08.verifier"

const LISTS = [
  {
    listName: "optional",
    title: "Optional subject rule",
    cite: "R-13",
    rule: "The optional subject scored grade point 2.0 or below — including an absent optional — so it adds nothing to the GPA.",
    key: "optional",
  },
  {
    listName: "practical",
    title: "Practical fail",
    cite: "R-11",
    rule: "A numeric practical part came in below 8, which zeroes the whole subject however strong the theory was.",
    key: "practicalFail",
  },
  {
    listName: "absent",
    title: "Absent",
    cite: "R-12",
    rule: "AB was recorded in a subject, compulsory or optional. An absent compulsory subject cancels the result.",
    key: "absent",
  },
] as const

export function ChecklistsPage({
  caseId,
  onOpenStudent,
}: {
  caseId: string
  onOpenStudent: (studentId: string) => void
}) {
  const { data, error, loading } = useAsync(() => api.checklists(caseId), [caseId])

  const [verifier, setVerifier] = useState(() => localStorage.getItem(VERIFIER_KEY) ?? "")
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [canVerify, setCanVerify] = useState(true)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setVerifications(await api.verifications(caseId))
      setCanVerify(true)
    } catch {
      // No database configured — the lists still work, sign-off does not.
      setCanVerify(false)
      setVerifications([])
    }
  }, [caseId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    localStorage.setItem(VERIFIER_KEY, verifier)
  }, [verifier])

  const byKey = useMemo(
    () => new Map(verifications.map((v) => [`${v.studentId}|${v.listName}`, v])),
    [verifications],
  )

  const toggleVerify = async (studentId: string, listName: string, verified: boolean) => {
    setVerifyError(null)
    if (verified && !verifier.trim()) {
      setVerifyError("Enter your name above first — a sign-off has to record who made it.")
      return
    }
    try {
      if (verified) await api.verify(caseId, { studentId, listName, verifiedBy: verifier.trim() })
      else await api.unverify(caseId, studentId, listName)
      await refresh()
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) return <ErrorState message={error} />
  if (loading && !data) return <LoadingState />
  if (!data) return null

  const total = data.optional.length + data.practicalFail.length + data.absent.length

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow={`Case ${caseId}`}
        title="Checking lists"
        actions={
          <>
            {canVerify && (
              <label className="flex flex-col gap-1">
                <span className="label-form">Checked by</span>
                <input
                  value={verifier}
                  onChange={(e) => setVerifier(e.target.value)}
                  placeholder="your name"
                  className="h-7 w-40 rounded-sm border border-rule bg-card px-2 text-xs transition-colors hover:border-rule-strong"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-7 items-center gap-1.5 self-end rounded-sm border border-rule bg-card px-2.5 text-xs font-medium transition-colors hover:border-rule-strong hover:bg-accent"
            >
              <Printer className="size-3.5" />
              Print the lists
            </button>
          </>
        }
      >
        {total} entries the office checks by hand: results decided by the optional rule, a practical
        fail, or an absent mark. One candidate can appear on more than one list.
      </PageHead>

      {verifyError && (
        <p className="border border-oxide/40 bg-oxide-soft px-3 py-2 text-sm text-oxide print:hidden">
          {verifyError}
        </p>
      )}

      {!canVerify && (
        <p className="border border-rule bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground print:hidden">
          Recording who checked each candidate needs a database. Set{" "}
          <code className="rounded-sm bg-card px-1 font-mono">DATABASE_URL</code> to a PostgreSQL
          connection string and the sign-off column appears. The lists themselves work either way,
          and print either way.
        </p>
      )}

      {LISTS.map((list) => (
        <ChecklistTable
          key={list.listName}
          title={list.title}
          rule={list.rule}
          cite={list.cite}
          listName={list.listName}
          rows={data[list.key]}
          verifications={byKey}
          canVerify={canVerify}
          onOpenStudent={onOpenStudent}
          onToggleVerify={toggleVerify}
        />
      ))}

      <Sheet cite="R-29">
        <SheetHead
          title="On more than one list"
          count={data.multiple.length}
          note="Two rules caught the same candidate. Check these first — they are where the lists disagree about why a result looks the way it does."
        />
        {data.multiple.length === 0 ? (
          <Empty>No candidate in this case is on more than one list.</Empty>
        ) : (
          <Ruled minWidth="34rem">
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Lists</Th>
                <Th align="right">GPA</Th>
              </tr>
            </thead>
            <tbody>
              {data.multiple.map((r) => (
                <Tr key={r.id} onClick={() => onOpenStudent(r.id)}>
                  <Td>
                    <span className="font-medium">{r.name}</span>
                    <p className="font-mono text-[0.6875rem] text-muted-foreground">
                      {r.id} · {r.class}
                    </p>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {r.lists.map((l) => (
                        <Mark key={l} tone={l === "absent" ? "oxide" : l === "practical" ? "ochre" : "neutral"}>
                          {l}
                        </Mark>
                      ))}
                    </span>
                  </Td>
                  <Td align="right">
                    <Figure tone={r.letter === "F" ? "oxide" : "ink"}>
                      {r.gpa}{" "}
                      <span className={r.letter === "F" ? "font-semibold" : "text-muted-foreground"}>
                        {r.letter}
                      </span>
                    </Figure>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Ruled>
        )}
      </Sheet>
    </div>
  )
}
