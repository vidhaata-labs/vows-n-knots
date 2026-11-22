import { useTranslation } from "react-i18next"

// Doop component "Header" (ctibz8gyaa). Shown on every screen.
export function AppHeader() {
  const { t } = useTranslation()
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-white/60 bg-white/75 px-4 py-2 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-3 font-display text-[24px] leading-none font-semibold text-ink whitespace-nowrap">
          <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" className="shrink-0">
            <g fill="none" strokeWidth={5} stroke="var(--color-accent)">
              <circle cx="24" cy="32" r="14" />
              <circle cx="40" cy="32" r="14" />
            </g>
          </svg>
          {t("app.brand")}
        </span>
        <span className="whitespace-nowrap rounded-full border border-[rgba(17,17,17,0.12)] px-2 py-[3px] font-body text-[11px] leading-none text-muted">
          {t("app.version")}
        </span>
      </div>
      <span className="whitespace-nowrap font-body text-[11px] text-muted">
        {t("app.poweredBy")} <strong className="font-semibold text-accent">{t("app.vendor")}</strong>
      </span>
    </header>
  )
}
