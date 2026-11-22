import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Option<T extends string> = { value: T; label: string }

// Two-option pill toggle from the Doop Segmented component: coral outline, coral fill when chosen.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: [Option<T>, Option<T>]
  ariaLabel: string
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={0}
      value={value}
      onValueChange={(next) => {
        // Radix sends "" when the chosen option is clicked again; keep the current choice.
        if (next) onChange(next as T)
      }}
      aria-label={ariaLabel}
      className="overflow-hidden rounded-full border border-accent"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-auto rounded-none px-4 py-2 text-[length:var(--text-label)] font-normal text-ink data-[state=on]:bg-accent data-[state=on]:text-white"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
