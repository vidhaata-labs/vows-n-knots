import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

// Welcome, from wireframe 3.1 on the Doop canvas: one sentence, the start button, and the wait stated up front.
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="grid w-[1088px] max-w-full grid-cols-1 items-center gap-8 py-6 sm:grid-cols-[1.2fr_1fr] sm:gap-16 sm:py-12">
      <div className="grid gap-6">
        <p className="text-[length:var(--text-label)] tracking-[0.08em] text-accent uppercase">{t("welcome.eyebrow")}</p>
        <h1 className="font-display text-[32px] leading-[1.1] font-semibold sm:text-[length:var(--text-display)]">
          {t("welcome.title")}
        </h1>
        <p className="max-w-[520px] text-[length:var(--text-body)] leading-normal text-muted">
          {t("welcome.intro")}
        </p>
        <div>
          <Button type="button" onClick={onStart}>
            {t("welcome.start")}
          </Button>
        </div>
      </div>

      <div className="grid h-[240px] place-items-center rounded-lg bg-surface sm:h-[440px]">
        <svg viewBox="0 0 64 64" width="200" height="200" aria-hidden="true">
          <g fill="none" strokeWidth={4} stroke="var(--color-accent)">
            <circle cx="24" cy="32" r="14" />
            <circle cx="40" cy="32" r="14" />
          </g>
        </svg>
      </div>
    </div>
  )
}
