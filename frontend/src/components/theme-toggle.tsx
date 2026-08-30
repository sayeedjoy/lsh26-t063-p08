import { Monitor, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match system", Icon: Monitor },
] as const

/**
 * The theme control was previously a bare `d` keypress with nothing on screen
 * to say so. Three explicit states, visible, plus the shortcut in the tooltip.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Colour scheme"
      className="flex items-center rounded-sm border border-rule bg-card p-px"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={`${label}${value === "dark" ? " · press D" : ""}`}
          className={cn(
            "flex size-6 items-center justify-center rounded-[2px] transition-colors",
            theme === value
              ? "bg-seal text-seal-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" strokeWidth={2} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
