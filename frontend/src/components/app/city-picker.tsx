import { useState, type KeyboardEvent } from "react"

import { t } from "@/i18n"
import { Input } from "@/components/ui/input"
import { CONTROL, CONTROL_INVALID } from "@/components/app/field"
import type { CityOption } from "@/lib/api"
import { cn } from "@/lib/utils"

export const CITY_RESULT_LIMIT = 50

// Cities whose name contains the query, in the order given. An empty query lists the first cities.
export function filterCities(cities: CityOption[], query: string): CityOption[] {
  // Typeahead: names that start with what the couple typed, as in the wireframe (4.6).
  const needle = query.trim().toLowerCase()
  const matches = needle ? cities.filter((city) => city.name.toLowerCase().startsWith(needle)) : cities
  return matches.slice(0, CITY_RESULT_LIMIT)
}

// Searchable city list from the wireframes (4.6). Only Census cities can be chosen:
// typing alone never sets a city, and a choice must come from the list.
export function CityPicker({
  id,
  cities,
  query,
  onQueryChange,
  selectedId,
  onPick,
  invalid,
  disabled,
}: {
  id: string
  cities: CityOption[]
  query: string
  onQueryChange: (query: string) => void
  selectedId: string
  onPick: (city: CityOption) => void
  invalid: boolean
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = filterCities(cities, query)

  function pick(city: CityOption) {
    onPick(city)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      pick(results[Math.min(active, results.length - 1)])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="grid gap-1.5">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-results`}
        autoComplete="off"
        disabled={disabled}
        placeholder={disabled ? t("about.cityNeedsState") : t("about.cityPlaceholder")}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(CONTROL, invalid && CONTROL_INVALID)}
      />
      {open && results.length > 0 ? (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="max-h-60 overflow-auto rounded-md border border-muted bg-surface"
        >
          {results.map((city, index) => (
            <li key={city.id} role="option" aria-selected={city.id === selectedId}>
              <button
                type="button"
                // Keep focus in the input so the list stays open until a city is picked.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(city)}
                className={cn(
                  "block w-full border-t border-muted px-4 py-2 text-left font-body text-[length:var(--text-body)] text-ink first:border-t-0",
                  index === active && "bg-accent/[.08]"
                )}
              >
                {city.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
