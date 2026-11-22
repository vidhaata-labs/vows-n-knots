import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { AppAlert } from "@/components/app/app-alert"
import { AppCard } from "@/components/app/app-card"
import { Button } from "@/components/ui/button"
import { fetchResearchCount, fetchStates } from "@/lib/api"
import { planGaps } from "@/lib/plan-request"
import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import {
  aboutSummary,
  budgetTitle,
  prioritiesSummary,
  reviewNotice,
  weddingSummary,
  weddingTitle,
} from "@/lib/review"
import type { WeddingValues } from "@/lib/wedding"

export type ReviewStep = "about" | "budget" | "wedding"

type ReviewProps = {
  about: AboutYouValues
  budget: BudgetValues
  wedding: WeddingValues
  onEdit: (step: ReviewStep) => void
  onBuild?: () => void
}

// Check your details, from wireframes 7.1 to 7.3 on the Doop canvas.
export function ReviewScreen({ about, budget, wedding, onEdit, onBuild }: ReviewProps) {
  const { t } = useTranslation()
  const [stateName, setStateName] = useState(about.state)
  const [searches, setSearches] = useState<number | null>(null)
  const priorityKey = budget.priorities.join("|")

  useEffect(() => {
    let cancelled = false
    fetchStates()
      .then((states) => {
        const match = states.find((state) => state.code === about.state)
        if (!cancelled) setStateName(match?.name ?? about.state)
      })
      .catch(() => {
        if (!cancelled) setStateName(about.state)
      })
    return () => {
      cancelled = true
    }
  }, [about.state])

  useEffect(() => {
    let cancelled = false
    const priorities = priorityKey ? priorityKey.split("|") : []
    fetchResearchCount(priorities)
      .then((count) => {
        if (!cancelled) setSearches(count)
      })
      .catch(() => {
        if (!cancelled) setSearches(null)
      })
    return () => {
      cancelled = true
    }
  }, [priorityKey])

  const notice = reviewNotice(budget.priorities.length, searches)
  const gaps = planGaps(about, wedding)
  const gapText = gaps.includes("venue") || gaps.includes("travel") ? t("review.gate") : null

  return (
    <div className="grid w-[720px] max-w-full content-start gap-4">
      <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{t("review.title")}</h2>

      <Section label={t("review.sectionAbout")} onEdit={() => onEdit("about")}>
        <AppCard title={about.coupleNames} text={aboutSummary(about, stateName)} />
      </Section>

      <Section label={t("review.sectionBudget")} onEdit={() => onEdit("budget")}>
        <AppCard
          title={budgetTitle(budget, about.currency)}
          text={prioritiesSummary(budget.priorities)}
        />
      </Section>

      <Section label={t("review.sectionWedding")} onEdit={() => onEdit("wedding")}>
        <AppCard title={weddingTitle(wedding)} text={weddingSummary(wedding)} />
      </Section>

      {notice ? <AppAlert>{notice}</AppAlert> : null}

      <p className="text-[length:var(--text-label)] text-muted">{t("review.buildNote")}</p>

      {gapText ? <p className="text-[length:var(--text-label)] text-accent">{gapText}</p> : null}

      <div className="mt-2 flex justify-end">
        <Button type="button" onClick={onBuild} disabled={gaps.length > 0}>
          {t("review.build")}
        </Button>
      </div>
    </div>
  )
}

// A section label with its Edit link on the right, as in the wireframes.
function Section({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-label)] text-muted">{label}</span>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("common.editSection", { section: label })}
          className="text-[length:var(--text-label)] text-accent underline underline-offset-2"
        >
          {t("common.edit")}
        </button>
      </div>
      {children}
    </section>
  )
}
