import { useState } from "react"

import { ErrorState, LoadingState, PageHead } from "@/App"
import { api, type Archetype, type AuditCriterion, type CaseAudit } from "@/api"
import { Empty, Figure, Mark, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"
import { useAsync } from "@/hooks/use-async"
import { cn } from "@/lib/utils"

/**
 * Deliverable 1, shown rather than claimed.
 *
 * The brief asks for a roll of a certain shape with a certain number of hard
 * cases in it. Every other page in the register reports what the rules did;
 * this one reports on the roll the rules were run against, and names the
 * candidates who sit on each hard edge — so a judge can click straight from
 * "the engine handles a practical failure" to the candidate it happened to.
 */

/** The four edges, in the order they are worth looking at. */
const EDGES: Array<{ key: Archetype; label: string; cite: string; blurb: string }> = [
  {
    key: "strongAverageFailure",
    label: "Strong average, cancelled",
    cite: "R-13",
    blurb:
      "Averaged 3.50 or better across the six and still publishes 0.00 / F, because one compulsory subject failed. This is the case a plain averaging calculator gets wrong, and the reason the uncancelled average stays on the trace instead of being thrown away.",
  },
  {
    key: "practicalFailPassingTheory",
    label: "Practical failed, theory passed",
    cite: "R-11",
    blurb:
      "Sat the written paper and passed it, then fell below 8 in the practical. The subject fails on the part, not on the total — a subject mark in the seventies still grades zero.",
  },
  {
    key: "weakOptional",
    label: "Optional below the helping point",
    cite: "R-29",
    blurb:
      "The optional subject earned 2.0 or less, so after the deduction it carried nothing into the GPA. It moved no grade — which is precisely why the office is asked to look at it before the result is published.",
  },
  {
    key: "absent",
    label: "Absent in a subject",
    cite: "R-12",
    blurb:
      "AB is not a mark of zero; it is the absence of a mark, and the register never stores it as a number. It grades zero, and in a compulsory subject it cancels the result outright.",
  },
]

const EDGE_SHORT: Record<Archetype, string> = {
  strongAverageFailure: "cancelled",
  practicalFailPassingTheory: "practical",
  weakOptional: "optional",
  absent: "absent",
}

/** Pass and fail are the only two states, so they get the two stamped tones. */
function Verdict({ pass }: { pass: boolean }) {
  return (
    <Mark tone={pass ? "seal" : "oxide"} title={pass ? "Criterion met" : "Criterion not met"}>
      {pass ? "met" : "short"}
    </Mark>
  )
}

function CriteriaSheet({
  title,
  note,
  cite,
  criteria,
}: {
  title: string
  note: string
  cite: string
  criteria: AuditCriterion[]
}) {
  return (
    <Sheet cite={cite}>
      <SheetHead title={title} count={criteria.length} note={note} />
      <Ruled minWidth="34rem">
        <thead>
          <tr>
            <Th className="w-20">Verdict</Th>
            <Th className="w-32">Criterion</Th>
            <Th>What was required</Th>
            <Th>What was found</Th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <Tr key={c.id} flagged={!c.pass}>
              <Td>
                <Verdict pass={c.pass} />
              </Td>
              <Td>
                <span className="cite">{c.id}</span>
              </Td>
              <Td className="text-[0.8125rem] leading-relaxed">{c.description}</Td>
              <Td className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
                {c.detail}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Ruled>
    </Sheet>
  )
}

/** One edge, with the candidates standing on it. */
function EdgeSheet({
  edge,
  students,
  onOpenStudent,
}: {
  edge: (typeof EDGES)[number]
  students: CaseAudit["hardEdgeStudents"]
  onOpenStudent: (studentId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 8
  const shown = expanded ? students : students.slice(0, LIMIT)
  const hidden = students.length - shown.length

  return (
    <Sheet cite={edge.cite} className={students.length === 0 ? "border-oxide/40" : undefined}>
      <SheetHead title={edge.label} count={students.length} note={edge.blurb} />

      {students.length === 0 ? (
        <Empty>
          No candidate in this case sits on this edge — the criterion above is not met.
        </Empty>
      ) : (
        <div className="p-3">
          <p className="label-form mb-2">Candidates on this edge</p>
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpenStudent(s.id)}
                  title={`Open the trace for ${s.name}`}
                  className={cn(
                    "flex items-baseline gap-1.5 rounded-sm border border-rule bg-background px-2 py-1",
                    "text-left transition-colors hover:border-rule-strong hover:bg-accent",
                  )}
                >
                  <span className="text-xs font-medium">{s.name}</span>
                  <Figure tone="muted" className="text-[0.625rem]">
                    {s.id}
                  </Figure>
                  {s.archetypes.length > 1 && (
                    <Mark tone="ochre" title={`On ${s.archetypes.length} edges`}>
                      ×{s.archetypes.length}
                    </Mark>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Show the other {hidden} on this edge
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** The candidates who are hard for more than one reason at once. */
function CompoundSheet({
  students,
  onOpenStudent,
}: {
  students: CaseAudit["hardEdgeStudents"]
  onOpenStudent: (studentId: string) => void
}) {
  const compound = students
    .filter((s) => s.archetypes.length > 1)
    .sort((a, b) => b.archetypes.length - a.archetypes.length || a.id.localeCompare(b.id))

  return (
    <Sheet>
      <SheetHead
        title="Hard for more than one reason"
        count={compound.length}
        note="Candidates where two or more rules fire on the same result. These are the traces worth reading first — nothing in the engine special-cases them, so if the arithmetic holds here it holds everywhere."
      />
      {compound.length === 0 ? (
        <Empty>No candidate in this case sits on more than one edge.</Empty>
      ) : (
        <Ruled minWidth="30rem">
          <thead>
            <tr>
              <Th className="w-24">Roll</Th>
              <Th>Candidate</Th>
              <Th>Edges</Th>
            </tr>
          </thead>
          <tbody>
            {compound.map((s) => (
              <Tr key={s.id} onClick={() => onOpenStudent(s.id)}>
                <Td>
                  <Figure className="text-xs">{s.id}</Figure>
                </Td>
                <Td className="font-medium">{s.name}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {s.archetypes.map((a) => (
                      <Mark key={a} tone="ochre">
                        {EDGE_SHORT[a]}
                      </Mark>
                    ))}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Ruled>
      )}
    </Sheet>
  )
}

export function AuditPage({
  caseId,
  onOpenStudent,
}: {
  caseId: string
  onOpenStudent: (studentId: string) => void
}) {
  const { data, error, loading } = useAsync(() => api.audit(caseId), [caseId])

  if (error) return <ErrorState message={error} />
  if (loading && !data) return <LoadingState />
  if (!data) return null

  const shape = data.criteria.filter((c) => c.id.startsWith("AC1"))
  const edges = data.criteria.filter((c) => c.id.startsWith("AC2"))
  const met = data.criteria.filter((c) => c.pass).length

  return (
    <div className="space-y-5">
      <PageHead eyebrow={`Case ${data.caseId}`} title="Audit of the roll">
        The brief asks for a roll of a particular shape, carrying a particular set of hard cases.
        The register does not take that on trust — it examines the case and reports, and names the
        candidates standing on each edge.
      </PageHead>

      {/* The finding, before any of the working behind it. */}
      <Sheet className={data.pass ? "border-seal/50" : "border-oxide/50"}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-4">
          <div className="min-w-0 max-w-prose">
            <p className="label-form">Deliverable 1 — the roll itself</p>
            <p className="mt-1.5 text-sm leading-relaxed">
              {data.pass ? (
                <>
                  Case <span className="font-mono">{data.caseId}</span> was examined against every
                  criterion below and satisfies all of them. Each hard edge the brief calls for is
                  occupied by a named candidate, and each of those names opens the trace that
                  proves it.
                </>
              ) : (
                <>
                  Case <span className="font-mono">{data.caseId}</span> falls short on{" "}
                  {data.criteria.length - met} of {data.criteria.length} criteria. The rows that
                  failed are marked below. Nothing is hidden and nothing throws — a roll that does
                  not meet the brief is a finding, not a crash.
                </>
              )}
            </p>
          </div>
          <div
            className={cn(
              "shrink-0 border-2 px-5 py-2.5 text-center",
              data.pass ? "border-seal text-seal" : "border-oxide text-oxide",
            )}
          >
            <p className="heading-masthead text-xl">{data.pass ? "Satisfied" : "Short"}</p>
            <p className="cite mt-1">
              {met} of {data.criteria.length} criteria
            </p>
          </div>
        </div>
      </Sheet>

      <CriteriaSheet
        cite="AC1"
        title="The shape of the roll"
        note="Sixty candidates or more, across exactly two classes, each carrying six compulsory subjects and one optional drawn from outside them."
        criteria={shape}
      />

      <CriteriaSheet
        cite="AC2"
        title="The hard edges present"
        note="Eight hard cases or more, with at least one candidate standing on each of the four edges the rules turn on."
        criteria={edges}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {EDGES.map((edge) => (
          <EdgeSheet
            key={edge.key}
            edge={edge}
            students={data.archetypeExamples[edge.key]}
            onOpenStudent={onOpenStudent}
          />
        ))}
      </div>

      <CompoundSheet students={data.hardEdgeStudents} onOpenStudent={onOpenStudent} />
    </div>
  )
}
