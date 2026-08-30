import { ErrorState, LoadingState, PageHead } from "@/App"
import { api, type RuleDoc } from "@/api"
import { Mark, Sheet, SheetHead } from "@/components/ledger"
import { useAsync } from "@/hooks/use-async"

/**
 * The statute book behind every figure in the register. Rule ids sit in the
 * margin, in the same column position they occupy everywhere else in the app,
 * so a citation seen on a trace can be found here by running down the edge.
 */
function RuleList({ rules }: { rules: RuleDoc[] }) {
  return (
    <ol className="divide-y divide-rule/60">
      {rules.map((rule) => (
        <li key={rule.id} className="grid grid-cols-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
          <span className="cite px-4 pt-3 sm:border-r sm:border-rule/60 sm:py-3 sm:text-right">
            {rule.id}
          </span>
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h4 className="heading-register text-sm">{rule.title}</h4>
              {rule.source === "declared" && <Mark tone="ochre">declared assumption</Mark>}
            </div>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {rule.text}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function RulesPage() {
  const { data, error, loading } = useAsync(() => api.rules(), [])

  if (error) return <ErrorState message={error} />
  if (loading && !data) return <LoadingState />
  if (!data) return null

  const brief = data.rules.filter((r) => r.source === "brief")
  const declared = data.rules.filter((r) => r.source === "declared")

  return (
    <div className="max-w-4xl space-y-5">
      <PageHead eyebrow="Applied to every case" title="The rules">
        {data.note}
      </PageHead>

      <Sheet>
        <SheetHead
          title="From the brief"
          count={brief.length}
          note="Stated in the problem itself. These are not ours to change."
        />
        <RuleList rules={brief} />
      </Sheet>

      <Sheet>
        <SheetHead
          title="Declared assumptions"
          count={declared.length}
          note="The brief leaves these gaps open. Each is isolated to one place in the engine — change it there and every downstream grade follows."
        />
        <RuleList rules={declared} />
      </Sheet>
    </div>
  )
}
