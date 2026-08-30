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
      <section className={cn("sheet border border-rule bg-card", className)}>
        <div className="@container">{children}</div>
      </section>
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
        {/* The container query context sits here and not on the sheet: an
            element with `container-type` stops holding a `position: sticky`
            child in place, and the citation beside this column has to stay
            beside whatever part of a long list is being read. */}
        <div className="@container min-w-0">{children}</div>
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
      {/* A floor rather than `min-w-0`: on a narrow screen the title should
          take the line and send its controls to the next one, not shrink into
          a ribbon of one word per line beside them. */}
      <div className="min-w-[13rem] flex-1">
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
/* The figure band                                                     */
/* ------------------------------------------------------------------ */

export type FigureCell = {
  label: string
  value: ReactNode
  note?: ReactNode
  /** The one figure in a band that is allowed to be oxide: a cancelled count. */
  oxide?: boolean
}

const FIGURE_SIZE = {
  lg: "text-[1.75rem]",
  md: "text-xl",
  sm: "text-lg",
} as const

/**
 * A ruled row of figures across the head of a sheet — the two, three or four
 * numbers a reader takes in before anything else.
 *
 * Every figure in the band sits on one line, which is why the label block
 * reserves two lines' height whether it needs them or not: a band where one
 * caption wraps and the rest do not would step its figures down out of true,
 * and a register that cannot keep a row of totals level is not a register.
 */
export function FigureRow({
  cells,
  size = "md",
  className,
}: {
  cells: FigureCell[]
  size?: keyof typeof FIGURE_SIZE
  className?: string
}) {
  return (
    // Measured against the sheet it sits in rather than the window: the same
    // band of totals appears across a full-width sheet on the trace and inside
    // a 22rem rail on the mark sheet, and only the sheet knows which.
    <dl className={cn("grid grid-cols-2 @md:grid-cols-4", className)}>
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={cn(
            "border-rule px-4 py-3",
            // Ruled into columns at width, and into pairs once it wraps.
            i % 2 === 0 && "border-r",
            i !== cells.length - 1 && "@md:border-r",
            i < cells.length - 2 && "border-b @md:border-b-0",
          )}
        >
          <dt className="label-form flex min-h-[2.2em] items-start">{cell.label}</dt>
          <dd
            className={cn(
              "mt-1 font-mono leading-none font-medium tabular-nums",
              FIGURE_SIZE[size],
              cell.oxide && "text-oxide",
            )}
          >
            {cell.value}
          </dd>
          {cell.note && (
            <p className="mt-1.5 text-[0.6875rem] leading-tight text-muted-foreground">
              {cell.note}
            </p>
          )}
        </div>
      ))}
    </dl>
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
  stickyHead,
  className,
}: {
  children: ReactNode
  minWidth?: string
  /**
   * Hold the column headers at the top of a long sheet.
   *
   * `Th` is `position: sticky`, but a sticky element sticks to its nearest
   * scroll container, and this wrapper is already one — `overflow-x: auto`
   * makes the block scroll on *both* axes, so a header inside it sticks to a
   * box that cannot scroll vertically, which is to say it does not stick at
   * all. Capping the height gives that box something to scroll against, and
   * a leaf of the roll then reads the way the paper does: the column names
   * stay printed at the head while the candidates run under them.
   *
   * The print block in `index.css` releases both the cap and the scroll, so
   * the whole leaf still comes out on paper.
   */
  stickyHead?: boolean
  className?: string
}) {
  return (
    // `relative` is load-bearing: an absolutely-positioned descendant (a
    // `sr-only` label, say) takes its containing block from the nearest
    // positioned ancestor. Without it such a child escapes this scroller and
    // anchors to the page, reserving the table's full width as dead
    // horizontal scroll on narrow screens.
    <div
      className={cn(
        "relative overflow-x-auto",
        stickyHead && "overflow-y-auto max-h-[min(70svh,44rem)]",
      )}
    >
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
        // The bottom rule is drawn as an inset shadow, not a border: on a
        // `border-collapse` table a sticky cell's own border is painted with
        // the row it belongs to and slides away underneath, while a shadow
        // travels with the cell.
        "label-form sticky top-0 z-10 bg-card px-3 py-2 shadow-[inset_0_-1px_0_var(--rule)]",
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
