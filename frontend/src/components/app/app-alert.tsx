import type { ReactNode } from "react"

// Doop component "Alert": surface card with a coral left edge.
export function AppAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border-l-4 border-accent bg-surface px-4 py-4 font-body text-[length:var(--text-body)] text-ink"
    >
      {children}
    </div>
  )
}
