import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Shared control look from the wireframes: 44px, 8px radius, surface fill, muted border.
// Invalid fields get a 2px coral border. Focus adds a coral border and a soft ring.
export const CONTROL =
  "h-11 w-full rounded-md border border-muted bg-surface px-4 font-body shadow-none focus-visible:ring-0 text-[length:var(--text-body)] text-ink outline-none transition-shadow focus:border-2 focus:border-accent focus:shadow-[0_0_0_4px_rgba(217,30,69,0.18)]"

export const CONTROL_INVALID = "border-2 border-accent"

type FieldProps = {
  label: string
  htmlFor?: string
  error?: string
  className?: string
  children: ReactNode
}

// Label, control and error text, as in the Doop wireframes (label, control, then error).
export function Field({ label, htmlFor, error, className, children }: FieldProps) {
  return (
    <div className={cn("grid content-start gap-1.5 text-[length:var(--text-label)]", className)}>
      <label htmlFor={htmlFor} className="text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[length:var(--text-label)] text-accent">
          {error}
        </p>
      ) : null}
    </div>
  )
}
