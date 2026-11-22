import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { t } from "@/i18n"
import { CONTROL, CONTROL_INVALID } from "@/components/app/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { currentMonth } from "@/lib/about-you-schema"
import { cn } from "@/lib/utils"

// Month names from en.json, in calendar order (index 0 is January).
const MONTH_KEYS = [
  "months.1", "months.2", "months.3", "months.4", "months.5", "months.6",
  "months.7", "months.8", "months.9", "months.10", "months.11", "months.12",
] as const

const SHORT_MONTH_KEYS = [
  "monthsShort.1", "monthsShort.2", "monthsShort.3", "monthsShort.4", "monthsShort.5", "monthsShort.6",
  "monthsShort.7", "monthsShort.8", "monthsShort.9", "monthsShort.10", "monthsShort.11", "monthsShort.12",
] as const

// "2027-07" -> "July 2027", as in the wireframe (4.3).
export function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number)
  return `${t(MONTH_KEYS[month - 1])} ${year}`
}

// Month-only wedding date. Earlier months can be picked; the screen then shows the wireframe error on Next.
export function MonthPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
}) {
  const [open, setOpen] = useState(false)
  const { t: translate } = useTranslation()
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || Number(currentMonth().slice(0, 4)))
  const minimum = currentMonth()
  const minimumYear = Number(minimum.slice(0, 4))

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setYear(Number(value.slice(0, 4)) || minimumYear)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-haspopup="dialog"
          className={cn(CONTROL, "flex items-center text-left", invalid && CONTROL_INVALID, !value && "text-muted")}
        >
          {value ? formatMonth(value) : translate("about.chooseMonth")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label={translate("about.previousYear")}
            onClick={() => setYear((current) => current - 1)}
            className="flex size-8 items-center justify-center rounded-full text-ink hover:bg-surface disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-body text-[length:var(--text-body)] font-medium text-ink">{year}</span>
          <button
            type="button"
            aria-label={translate("about.nextYear")}
            onClick={() => setYear((current) => current + 1)}
            className="flex size-8 items-center justify-center rounded-full text-ink hover:bg-surface"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SHORT_MONTH_KEYS.map((shortKey, index) => {
            const key = `${year}-${String(index + 1).padStart(2, "0")}`
            const selected = key === value
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                }}
                className={cn(
                  "h-9 rounded-full font-body text-[length:var(--text-label)] text-ink hover:bg-surface",
                  selected && "bg-accent text-white hover:bg-accent"
                )}
              >
                {translate(shortKey)}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
