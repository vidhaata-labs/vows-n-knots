// Doop component "Card": a surface panel with a display title and a muted line of detail.
export function AppCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-surface p-6">
      <h3 className="font-display text-[length:var(--text-h2)] leading-tight font-semibold text-ink">{title}</h3>
      <p className="mt-2 font-body text-[length:var(--text-body)] text-muted">{text}</p>
    </div>
  )
}
