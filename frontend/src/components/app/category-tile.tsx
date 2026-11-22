import { Camera, Car, Coins, Music, MapPin, UtensilsCrossed, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  "map-pin": MapPin,
  utensils: UtensilsCrossed,
  camera: Camera,
  music: Music,
  car: Car,
  coins: Coins,
}

// Doop component "CategoryTile": one search category, with its icon, name and progress line.
// Searching tiles get a coral border; tiles with no figures get a dashed border.
export function CategoryTile({
  name,
  icon,
  text,
  searching,
  noFigures,
}: {
  name: string
  icon: string
  text: string
  searching: boolean
  noFigures: boolean
}) {
  const Icon = ICONS[icon] ?? Coins
  return (
    <div
      className={cn(
        "grid content-start gap-1.5 rounded-lg bg-surface p-4",
        searching && "border border-accent",
        noFigures && "border border-dashed border-muted"
      )}
    >
      <Icon className="size-5 text-accent" aria-hidden="true" />
      <span className="font-display text-[length:var(--text-body)] font-semibold text-ink">{name}</span>
      <span className="font-body text-[length:var(--text-label)] text-ink">{text}</span>
    </div>
  )
}
