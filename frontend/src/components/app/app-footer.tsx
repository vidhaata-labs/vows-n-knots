import { useTranslation } from "react-i18next"

// Doop component "Footer" (ccgcpt0igt). Shown on every screen.
export function AppFooter() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-white/60 bg-[rgba(246,246,244,0.75)] px-6 py-1 text-center font-body text-[11px] text-muted">
      {t("app.disclaimer")}
    </footer>
  )
}
