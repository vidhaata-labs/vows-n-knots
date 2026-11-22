import type { ReactNode } from "react"

import { AppFooter } from "@/components/app/app-footer"
import { AppHeader } from "@/components/app/app-header"

// The page background from the wireframes: the rose photo under a blush veil.
const BACKGROUND = {
  backgroundImage:
    "linear-gradient(rgba(255,246,247,0.86), rgba(255,246,247,0.86)), url(/backgrounds/roses.jpg)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
} as const

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col text-ink" style={BACKGROUND}>
      <AppHeader />
      <div className="flex flex-1 justify-center px-4 pt-6 pb-6 sm:px-6 sm:pt-10">{children}</div>
      <AppFooter />
    </div>
  )
}
