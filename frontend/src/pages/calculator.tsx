import { useCallback, useEffect, useMemo, useState } from "react"
import { Trash2 } from "lucide-react"

import { evaluateStudent, type RawMark, type StudentResult } from "@/engine"

import { ErrorState, LoadingState, PageHead } from "@/App"
import { api, type SavedCalculation, type StudentInput } from "@/api"
import { GpaWorking } from "@/components/gpa-working"
import { Empty, Figure, Ruled, Sheet, SheetHead, Td, Th, Tr } from "@/components/ledger"
import { MarkInput } from "@/components/mark-input"
import { PublishedResult } from "@/components/published-result"
import { useAsync } from "@/hooks/use-async"
import { cn } from "@/lib/utils"

/** A pass-level starting point, so the sheet opens on something meaningful. */
const startingMark = (practical: boolean): RawMark => (practical ? { theory: 50, practical: 18 } : 65)

const controlClass =
  "h-8 w-full rounded-sm border border-rule bg-card px-2 text-sm transition-colors hover:border-rule-strong"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-form">{label}</span>
      {children}
    </label>
  )
}

export function CalculatorPage({ caseId }: { caseId: string }) {
  const { data: caseData, error, loading } = useAsync(() => api.caseDetail(caseId), [caseId])

  const [name, setName] = useState("New candidate")
  const [klass, setKlass] = useState("Class 9")
  const [optional, setOptional] = useState<string | null>(null)
  const [marks, setMarks] = useState<Record<string, RawMark>>({})

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedCalculation[] | null>(null)
  const [dbAvailable, setDbAvailable] = useState(true)

  const optionalChoices = useMemo(
    () => (caseData ? caseData.subjects.filter((s) => !caseData.compulsory.includes(s.code)) : []),
    [caseData],
  )

  // Seed the sheet once the case — and therefore its subject list — is known.
  useEffect(() => {
    if (!caseData) return
    const firstOptional = optionalChoices[0]?.code ?? null
    setOptional(firstOptional)
    const seeded: Record<string, RawMark> = {}
    for (const code of caseData.compulsory) {
      const subject = caseData.subjects.find((s) => s.code === code)!
      seeded[code] = startingMark(subject.practical)
    }
    if (firstOptional) {
      const subject = caseData.subjects.find((s) => s.code === firstOptional)!
      seeded[firstOptional] = startingMark(subject.practical)
    }
    setMarks(seeded)
    setKlass(caseData.summary.classes[0] ?? "Class 9")
  }, [caseData, optionalChoices])

  const refreshSaved = useCallback(async () => {
    try {
      setSaved(await api.listCalculations())
      setDbAvailable(true)
    } catch {
      setDbAvailable(false)
      setSaved(null)
    }
  }, [])

  useEffect(() => {
    void refreshSaved()
  }, [refreshSaved])

  const setMark = (code: string, next: RawMark) => setMarks((m) => ({ ...m, [code]: next }))

  const changeOptional = (code: string) => {
    if (!caseData) return
    setMarks((m) => {
      const next = { ...m }
      if (optional) delete next[optional]
      const subject = caseData.subjects.find((s) => s.code === code)!
      next[code] = startingMark(subject.practical)
      return next
    })
    setOptional(code)
  }

  /**
   * Computed in the browser with the very same engine the server runs, so this
   * is not a preview of the answer — it is the answer. Saving re-evaluates
   * server-side and must produce an identical result.
   */
  const result: StudentResult | null = useMemo(() => {
    if (!caseData || !optional) return null
    const ready =
      caseData.compulsory.every((c) => marks[c] !== undefined) && marks[optional] !== undefined
    if (!ready) return null
    try {
      return evaluateStudent(
        { case_id: caseData.caseId, subjects: caseData.subjects, compulsory: caseData.compulsory },
        { id: "PREVIEW", name: name || "Unnamed", class: klass, optional, marks },
      )
    } catch {
      return null
    }
  }, [caseData, optional, marks, name, klass])

  const traceFor = (code: string) => result?.subjects.find((s) => s.code === code) ?? null

  const onSave = async () => {
    if (!caseData || !optional) return
    setSaving(true)
    setSaveError(null)
    try {
      const student: StudentInput = {
        id: `ADHOC-${Date.now()}`,
        name: name || "Unnamed",
        class: klass,
        optional,
        marks,
      }
      await api.saveCalculation(caseData.caseId, student)
      await refreshSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const loadSaved = (row: SavedCalculation) => {
    setName(row.studentName)
    setKlass(row.studentClass)
    setOptional(row.optionalCode)
    setMarks(row.marks)
  }

  const removeSaved = async (id: number) => {
    try {
      await api.deleteCalculation(id)
      await refreshSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) return <ErrorState message={error} />
  if (loading && !caseData) return <LoadingState />
  if (!caseData || !optional) return null

  return (
    <div className="space-y-5">
      <PageHead eyebrow={`Case ${caseId} · rules and subjects`} title="Grade a mark sheet">
        Type a sheet and watch each rule fire. Grade points, the working and the letter update as
        you type, using the engine that graded {caseData.caseId}.
      </PageHead>

      <Sheet>
        <SheetHead title="Candidate" note="Who this sheet belongs to, and which fourth subject they sat." />
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={controlClass} />
          </Field>
          <Field label="Class">
            <select value={klass} onChange={(e) => setKlass(e.target.value)} className={controlClass}>
              {caseData.summary.classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Optional (fourth) subject">
            <select
              value={optional}
              onChange={(e) => changeOptional(e.target.value)}
              className={controlClass}
            >
              {optionalChoices.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Sheet>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section>
            <h3 className="label-form mb-2">Six compulsory subjects</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {caseData.compulsory.map((code) => {
                const subject = caseData.subjects.find((s) => s.code === code)!
                return (
                  <MarkInput
                    key={code}
                    subject={subject}
                    role="compulsory"
                    value={marks[code] ?? 0}
                    trace={traceFor(code)}
                    onChange={(next) => setMark(code, next)}
                  />
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="label-form mb-2">Optional subject</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MarkInput
                subject={caseData.subjects.find((s) => s.code === optional)!}
                role="optional"
                value={marks[optional] ?? 0}
                trace={traceFor(optional)}
                onChange={(next) => setMark(optional, next)}
              />
            </div>
          </section>
        </div>

        {/* The result follows you down the sheet. */}
        <div className="space-y-3 lg:sticky lg:top-[4.25rem] lg:self-start">
          {result && (
            <>
              <PublishedResult student={result} />

              <button
                type="button"
                onClick={onSave}
                disabled={saving || !dbAvailable}
                className={cn(
                  "h-9 w-full rounded-sm text-sm font-medium transition-colors",
                  "bg-seal text-seal-foreground hover:bg-seal/90",
                  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                )}
              >
                {saving ? "Saving…" : dbAvailable ? "Save this sheet" : "Saving needs a database"}
              </button>

              {!dbAvailable && (
                <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                  Keeping a history needs a database. Set{" "}
                  <code className="rounded-sm bg-muted px-1 font-mono">DATABASE_URL</code> to a
                  PostgreSQL connection string. Grading itself never touches one.
                </p>
              )}
              {saveError && <p className="text-[0.6875rem] text-oxide">{saveError}</p>}

              <details className="border border-rule bg-card">
                <summary className="label-form cursor-pointer px-3 py-2 select-none hover:text-foreground">
                  Show the arithmetic
                </summary>
                <div className="border-t border-rule">
                  <GpaWorking student={result} />
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {dbAvailable && saved && (
        <Sheet>
          <SheetHead
            title="Saved sheets"
            count={saved.length}
            note="Stored with the full trace. Open one to load it back into the form."
          />
          {saved.length === 0 ? (
            <Empty>No sheet saved yet. Grade one above and save it to keep it here.</Empty>
          ) : (
            <Ruled minWidth="38rem">
              <thead>
                <tr>
                  <Th>Candidate</Th>
                  <Th>Case</Th>
                  <Th align="right">GPA</Th>
                  <Th>Saved</Th>
                  <Th align="right" className="w-16 print:hidden">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {saved.map((row) => (
                  <Tr key={row.id} flagged={!row.passed}>
                    <Td>
                      <button
                        type="button"
                        onClick={() => loadSaved(row)}
                        className="text-left font-medium underline-offset-4 hover:underline"
                      >
                        {row.studentName}
                      </button>
                      <p className="font-mono text-[0.6875rem] text-muted-foreground">
                        {row.studentClass} · {row.optionalCode}
                      </p>
                    </Td>
                    <Td>
                      <Figure tone="muted" className="text-xs">
                        {row.caseId}
                      </Figure>
                    </Td>
                    <Td align="right">
                      <Figure tone={row.passed ? "ink" : "oxide"} className="font-medium">
                        {row.gpa}{" "}
                        <span className={row.passed ? "text-muted-foreground" : "font-semibold"}>
                          {row.letter}
                        </span>
                      </Figure>
                    </Td>
                    <Td>
                      <Figure tone="muted" className="text-[0.6875rem]">
                        {new Date(row.createdAt).toLocaleString()}
                      </Figure>
                    </Td>
                    <Td align="right" className="print:hidden">
                      <button
                        type="button"
                        onClick={() => removeSaved(row.id)}
                        title={`Delete the saved sheet for ${row.studentName}`}
                        className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-oxide-soft hover:text-oxide"
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Ruled>
          )}
        </Sheet>
      )}
    </div>
  )
}
