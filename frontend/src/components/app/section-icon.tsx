import { Calendar, Camera, Car, Coins, FileText, MapPin, Music, UtensilsCrossed, type LucideIcon } from "lucide-react"

import type { IconKey } from "@/lib/plan-view"

const ICONS: Record<IconKey, LucideIcon> = {
  "map-pin": MapPin,
  coins: Coins,
  calendar: Calendar,
  car: Car,
  utensils: UtensilsCrossed,
  camera: Camera,
  music: Music,
  file: FileText,
}

// The coral icon beside a section title, as in the wireframes.
export function SectionIcon({ icon, className }: { icon: IconKey; className?: string }) {
  const Icon = ICONS[icon]
  return <Icon className={className ?? "size-5 text-accent"} aria-hidden="true" />
}
