/**
 * The register's parts.
 *
 * Every page in this app is a page of the same book, so the shapes it can be
 * built from live here: the ruled sheet, its citation margin, the column
 * headers, the figures, and the struck total. Nothing below knows anything
 * about grading — it only knows how a register is set.
 */

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

/**
 * A ruled sheet.
 *
 * `cite` puts the governing rule in the left margin, aligned to the top of
 * the block it governs — the way a statute is cited beside the clause that
 * invokes it. The margin is the one structural device this design leans on,
 * so it carries only rule ids and never anything decorative.
 */
export function Sheet({
  cite,
  className,
  children,
}: {
  cite?: string
  className?: string
  children: ReactNode
}) {
  if (!cite) {
    return (
      <section className={cn("sheet border border-rule bg-card", className)}>{children}</section>
    )
  }

  return (
    <section className={cn("sheet border border-rule bg-card", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-[3.75rem_minmax(0,1fr)]">
        <div
          className="border-b border-rule px-3 pt-3 pb-2 sm:border-r sm:border-b-0 sm:pb-3 sm:text-right"
          aria-hidden
        >
          {/* Stays beside whatever part of a long list you are reading. */}
          <span className="cite sm:sticky sm:top-[4.5rem]">{cite}</span>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  )
}

/** A sheet's masthead: what this block is, how many rows, and its controls. */
export function SheetHead({
  title,
  count,
  note,
  actions,
  className,
}: {
  title: ReactNode
  count?: number
  note?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-rule p-3", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="heading-register flex items-baseline gap-2 text-[0.95rem]">
          <span>{title}</span>
          {count !== undefined && (
            <span className="font-mono text-xs font-medium text-muted-foreground">{count}</span>
          )}
        </h3>
        {note && <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">{note}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

/** Any number the office would read off the sheet. Always mono, always tabular. */
export function Figure({
  children,
  className,
  tone = "ink",
}: {
  children: ReactNode
  className?: string
  tone?: "ink" | "oxide" | "seal" | "muted"
}) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        tone === "oxide" && "text-oxide",
        tone === "seal" && "text-seal",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * A figure the register computed and then cancelled: struck through in oxide,
 * with what was actually published written beside it. Both numbers stay
 * readable, because R-13 requires the uncancelled average to remain visible.
 */
export function StruckFigure({
  computed,
  published,
  className,
}: {
  computed: string
  published: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <Figure className="struck">{computed}</Figure>
      <Figure tone="oxide" className="font-semibold">
        {published}
      </Figure>
    </span>
  )
}

/** An inline rule citation, for places with no margin to put it in. */
export function Cite({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("cite rounded-sm bg-muted px-1.5 py-0.5", className)}>{children}</span>
  )
}

/* ------------------------------------------------------------------ */
/* Marks in the margin                                                 */
/* ------------------------------------------------------------------ */

export type Tone = "neutral" | "seal" | "ochre" | "oxide"

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  seal: "bg-seal-soft text-seal",
  ochre: "bg-ochre-soft text-ochre",
  oxide: "bg-oxide-soft text-oxide",
}

/** A short stamped marker — list membership, status, a letter grade. */
export function Mark({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[0.6875rem] leading-tight font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Ruled tables                                                        */
/* ------------------------------------------------------------------ */

/**
 * The ruled table. Columns are separated by hairlines because on a real
 * tabulation sheet they are — the vertical rules are what make a column a
 * column, and they make a wide row of figures far easier to track across.
 */
export function Ruled({
  children,
  minWidth,
  className,
}: {
  children: ReactNode
  minWidth?: string
  className?: string
}) {
  return (
    // `relative` is load-bearing: an absolutely-positioned descendant (a
    // `sr-only` label, say) takes its containing block from the nearest
    // positioned ancestor. Without it such a child escapes this scroller and
    // anchors to the page, reserving the table's full width as dead
    // horizontal scroll on narrow screens.
    <div className="relative overflow-x-auto">
      <table
        style={minWidth ? { minWidth } : undefined}
        className={cn(
          "w-full border-collapse text-sm",
          "[&_td]:border-r [&_td]:border-rule/70 [&_td:last-child]:border-r-0",
          "[&_th]:border-r [&_th]:border-rule/70 [&_th:last-child]:border-r-0",
          className,
        )}
      >
        {children}
      </table>
    </div>
  )
}

/** A column header. `sort` turns it into the control that reorders the sheet. */
export function Th({
  children,
  className,
  align = "left",
  sort,
  onSort,
}: {
  children: ReactNode
  className?: string
  align?: "left" | "right" | "center"
  sort?: "asc" | "desc" | false
  onSort?: () => void
}) {
  const content = (
    <span className="inline-flex items-center gap-1">
      {children}
      {sort !== undefined && (
        <span aria-hidden className={cn("font-mono text-[0.625rem]", !sort && "opacity-25")}>
          {sort === "asc" ? "▲" : sort === "desc" ? "▼" : "▲"}
        </span>
      )}
    </span>
  )

  return (
    <th
      scope="col"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
      className={cn(
        "label-form sticky top-0 z-10 border-b border-rule bg-card px-3 py-2",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="label-form -mx-1 rounded-sm px-1 hover:text-foreground"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  )
}

/** A body row. `flagged` tints the row the way a cancelled entry is marked up. */
export function Tr({
  children,
  className,
  flagged,
  verified,
  onClick,
}: {
  children: ReactNode
  className?: string
  flagged?: boolean
  verified?: boolean
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-rule/60 align-top last:border-b-0",
        onClick && "cursor-pointer",
        onClick && "hover:bg-accent/60",
        flagged && "bg-oxide-soft/50",
        verified && "bg-seal-soft/45",
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Td({
  children,
  className,
  align = "left",
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-3 py-2",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}

/* ------------------------------------------------------------------ */
/* Absence of rows                                                     */
/* ------------------------------------------------------------------ */

/** An empty list is good news here, so say what it means, not that it is empty. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
      <span aria-hidden className="font-mono text-rule-strong">
        ——
      </span>
      {children}
    </p>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-muted", className)} />
}

/** Stand-in for a sheet that is still loading, shaped like the sheet itself. */
export function SheetSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border border-rule bg-card">
      <div className="border-b border-rule p-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-rule/60">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-2.5">
            <Skeleton className={cn("h-3.5 flex-1", i % 2 === 1 && "opacity-70")} />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Turning the page                                                    */
/* ------------------------------------------------------------------ */

export type PageSize = number | "all"

/**
 * The foot of a long sheet.
 *
 * A roll of seventeen hundred candidates is a bound register, not a scroll,
 * so it is read a leaf at a time: which rows you are on, how many there are,
 * and the two controls that turn the leaf. The page size stays adjustable —
 * and can be opened out to the whole roll — because printing a register
 * means printing all of it, not the leaf that happened to be open.
 */
export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  unit = "rows",
  pageSize,
  pageSizes = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  unit?: string
  pageSize: PageSize
  pageSizes?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  className?: string
}) {
  const step = (delta: number) => onPageChange(Math.min(pageCount, Math.max(1, page + delta)))

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule px-3 py-2 print:hidden",
        className,
      )}
    >
      <p className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
        {total === 0 ? `no ${unit}` : `${from}–${to} of ${total} ${unit}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="label-form">Per page</span>
          <select
            value={String(pageSize)}
            onChange={(e) =>
              onPageSizeChange(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="h-7 rounded-sm border border-rule bg-card px-1.5 font-mono text-xs transition-colors hover:border-rule-strong"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="all">All</option>
          </select>
        </label>

        <div className="flex items-center gap-1">
          <PageStep label="Previous page" onClick={() => step(-1)} disabled={page <= 1}>
            ‹
          </PageStep>
          <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
            {page} / {pageCount}
          </span>
          <PageStep label="Next page" onClick={() => step(1)} disabled={page >= pageCount}>
            ›
          </PageStep>
        </div>
      </div>
    </div>
  )
}

function PageStep({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-sm border border-rule bg-card font-mono text-sm leading-none transition-colors",
        disabled ? "cursor-default opacity-40" : "hover:border-rule-strong hover:bg-accent/60",
      )}
    >
      <span aria-hidden>{children}</span>
    </button>
  )
}
