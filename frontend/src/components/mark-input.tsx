import type { RawMark, SubjectDef, SubjectTrace } from "@/engine"
import { Figure } from "@/components/ledger"
import { cn } from "@/lib/utils"

/** One ruled cell of the mark sheet. Stays usable while empty; clamps to range. */
function MarkCell({
  value,
  max,
  onChange,
  label,
  invalid,
  className,
}: {
  value: number | ""
  max: number
  onChange: (next: number | "") => void
  label: string
  invalid: boolean
  className?: string
}) {
  return (
    <label className={cn("flex flex-col", className)}>
      <span className="label-form border-b border-rule/70 px-2.5 py-1.5">
        {label} <span className="font-mono normal-case opacity-70">/{max}</span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === "") return onChange("")
          const n = Number(raw)
          if (Number.isNaN(n)) return
          onChange(Math.max(0, Math.min(max, Math.trunc(n))))
        }}
        className={cn(
          "h-10 w-full bg-transparent px-2.5 font-mono text-lg tabular-nums outline-none transition-colors",
          invalid && "bg-oxide-soft text-oxide",
        )}
      />
    </label>
  )
}

export function MarkInput({
  subject,
  role,
  value,
  trace,
  onChange,
}: {
  subject: SubjectDef
  role: "compulsory" | "optional"
  value: RawMark
  trace: SubjectTrace | null
  onChange: (next: RawMark) => void
}) {
  const absent = value === "AB"
  const split = typeof value === "object" && value !== null ? value : null
  const plain = typeof value === "number" ? value : ""

  // A failing part is the single most common reason a strong sheet ends in F,
  // so it is marked at the cell, not just in the summary.
  const theoryBad = !!trace?.theoryFailed && !trace.absent
  const practicalBad = !!trace?.practicalFailed

  return (
    <div className={cn("border bg-card", trace?.failed ? "border-oxide/45" : "border-rule")}>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-2.5 py-1.5",
          trace?.failed ? "border-oxide/30 bg-oxide-soft" : "border-rule bg-muted/40",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="heading-register truncate text-sm">{subject.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {subject.code} · {role}
            {subject.practical && " · practical"}
          </p>
        </div>

        {trace && (
          <div className="text-right">
            <Figure
              tone={trace.failed ? "oxide" : "ink"}
              className="block text-lg leading-none font-semibold"
            >
              {trace.gradePoint}
            </Figure>
            <span className="cite">{trace.ruleId}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => onChange(absent ? (subject.practical ? { theory: 0, practical: 0 } : 0) : "AB")}
          aria-pressed={absent}
          title={absent ? "Clear the absent mark" : "Record this subject as absent"}
          className={cn(
            "h-6 shrink-0 rounded-sm border px-2 font-mono text-[0.6875rem] font-medium transition-colors",
            absent
              ? "border-oxide/50 bg-oxide text-card"
              : "border-rule text-muted-foreground hover:border-rule-strong hover:text-foreground",
          )}
        >
          AB
        </button>
      </div>

      {absent ? (
        <p className="px-2.5 py-3 text-xs leading-relaxed text-muted-foreground">
          Absent — grade point 0.{" "}
          {role === "compulsory"
            ? "A compulsory subject at 0 cancels the whole result."
            : "Adds nothing, and puts this candidate on the absent list."}
        </p>
      ) : subject.practical ? (
        <div className="grid grid-cols-2 divide-x divide-rule/70">
          <MarkCell
            label="Theory"
            max={75}
            invalid={theoryBad}
            value={split ? split.theory : ""}
            onChange={(n) => onChange({ theory: n === "" ? 0 : n, practical: split?.practical ?? 0 })}
          />
          <MarkCell
            label="Practical"
            max={25}
            invalid={practicalBad}
            value={split ? split.practical : ""}
            onChange={(n) => onChange({ theory: split?.theory ?? 0, practical: n === "" ? 0 : n })}
          />
        </div>
      ) : (
        <MarkCell
          label="Mark"
          max={100}
          invalid={theoryBad}
          value={plain}
          onChange={(n) => onChange(n === "" ? 0 : n)}
        />
      )}

      {trace && (
        <p
          className={cn(
            "border-t px-2.5 py-1.5 text-[0.6875rem] leading-snug",
            trace.failed ? "border-oxide/30 text-oxide" : "border-rule/70 text-muted-foreground",
          )}
        >
          {trace.reason}
        </p>
      )}
    </div>
  )
}
