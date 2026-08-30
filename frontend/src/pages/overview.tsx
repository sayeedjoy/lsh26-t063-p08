import { ErrorState, LoadingState, PageHead } from "@/App"
import { api } from "@/api"
import { CaseSummaryBlocks } from "@/components/case-summary"
import { Mark, Sheet } from "@/components/ledger"
import { SavedSheets } from "@/components/saved-sheets"
import { StudentTable } from "@/components/student-table"
import { useAsync } from "@/hooks/use-async"

/**
 * The audit's finding, reduced to one line at the head of the roll.
 *
 * The full examination has its own page. This is the endorsement a reader
 * needs before trusting anything below it: the roll was checked, and here is
 * how many of its candidates the rules had to work hard for.
 */
function AuditStrip({ caseId, onOpenAudit }: { caseId: string; onOpenAudit: () => void }) {
  const { data } = useAsync(() => api.audit(caseId), [caseId])
  if (!data) return null

  const met = data.criteria.filter((c) => c.pass).length

  return (
    <Sheet className={data.pass ? "border-seal/40" : "border-oxide/40"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Mark tone={data.pass ? "seal" : "oxide"}>
          {data.pass ? "roll examined" : "roll short"}
        </Mark>
        {/* `min-w` rather than `min-w-0`: without a floor the sentence just
            squeezes into a ribbon beside the button instead of wrapping under
            it, which is what a wrapping flex row is for. */}
        <p className="min-w-[15rem] flex-1 text-xs leading-relaxed text-muted-foreground">
          {met} of {data.criteria.length} criteria met.{" "}
          <span className="font-mono tabular-nums text-foreground">
            {data.hardEdgeStudents.length}
          </span>{" "}
          candidates sit on a hard edge — the cases the rules had to be right about.
        </p>
        <button
          type="button"
          onClick={onOpenAudit}
          className="h-7 shrink-0 rounded-sm border border-rule px-2.5 text-xs font-medium transition-colors hover:border-rule-strong hover:bg-accent"
        >
          Open the audit
        </button>
      </div>
    </Sheet>
  )
}

export function OverviewPage({
  caseId,
  onOpenStudent,
  onOpenChecklists,
  onOpenAudit,
  onOpenSheet,
}: {
  caseId: string
  onOpenStudent: (studentId: string) => void
  onOpenChecklists: () => void
  onOpenAudit: () => void
  onOpenSheet: (sheetId: number) => void
}) {
  const { data, error, loading } = useAsync(() => api.caseDetail(caseId), [caseId])

  if (error) return <ErrorState message={error} />
  if (loading && !data) return <LoadingState />
  if (!data) return null

  const { summary } = data

  return (
    <div className="space-y-6">
      <PageHead eyebrow={`Case ${data.caseId}`} title="Candidate roll">
        {summary.students} candidates across {summary.classes.join(" and ")}. {summary.passed}{" "}
        passed, {summary.failed} cancelled by a compulsory failure.
      </PageHead>

      <AuditStrip caseId={caseId} onOpenAudit={onOpenAudit} />
      <CaseSummaryBlocks summary={summary} onOpenChecklists={onOpenChecklists} />
      <StudentTable students={data.results} onOpenStudent={onOpenStudent} />
      <SavedSheets caseId={caseId} onOpenSheet={onOpenSheet} />
    </div>
  )
}
