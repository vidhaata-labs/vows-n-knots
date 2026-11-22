// Doop component "Chip": a pill option. Selected chips are filled in the accent colour.
// Used with the shadcn ToggleGroup, in multi-select (styles, dietary) or single-select (venue, travel) groups.
export const CHIP_ITEM_CLASS =
  "h-auto rounded-full border border-muted bg-transparent px-4 py-1 font-body text-[length:var(--text-label)] font-normal text-ink hover:bg-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"

export const CHIP_GROUP_CLASS = "flex flex-wrap gap-2.5"
