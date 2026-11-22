import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CONTROL, CONTROL_INVALID } from "@/components/app/field"
import { cn } from "@/lib/utils"

// Exact wedding date, shown as "18 July 2027" as in the wireframes.
// Earlier days can be picked; the screen then shows the wireframe error on Next.
export function ExactDatePicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: Date | undefined
  onChange: (value: Date | undefined) => void
  invalid: boolean
}) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const longDate = new Intl.DateTimeFormat(t("locale.date"), { day: "numeric", month: "long", year: "numeric" })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-haspopup="dialog"
          className={cn(CONTROL, "flex items-center text-left", invalid && CONTROL_INVALID, !value && "text-muted")}
        >
          {value ? longDate.format(value) : t("about.chooseDate")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(day) => {
            onChange(day)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
