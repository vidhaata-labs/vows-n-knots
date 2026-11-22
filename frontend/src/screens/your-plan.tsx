import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { AppAlert } from "@/components/app/app-alert"
import { SectionIcon } from "@/components/app/section-icon"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchStates } from "@/lib/api"
import type { AboutYouValues } from "@/lib/about-you-schema"
import { formatMoney, midpointPerGuest, type BudgetValues } from "@/lib/budget"
import { parsePlan, iconFor, priorityFor, venueCount, type Block, type PlanSection } from "@/lib/plan-view"
import type { PlanData } from "@/lib/plan-stream"
import type { WeddingValues } from "@/lib/wedding"
import { formatMonth } from "@/components/app/month-picker"

const DAY_MS = 24 * 60 * 60 * 1000
// How long a card's scrollbar stays visible after a scroll.
const SCROLLBAR_SHOW_MS = 800

type YourPlanProps = {
  plan: PlanData
  about: AboutYouValues
  budget: BudgetValues
  wedding: WeddingValues
  onStartAgain?: () => void
}

// Your plan, from wireframes 9.1 to 9.4 on the Doop canvas.
// The page fits the window: the heading, actions and summary tiles stay put, and the tab content scrolls.
export function YourPlanScreen({ plan, about, budget, wedding, onStartAgain }: YourPlanProps) {
  const { t } = useTranslation()
  const longDate = new Intl.DateTimeFormat(t("locale.date"), { day: "numeric", month: "long", year: "numeric" })
  const [stateName, setStateName] = useState(about.state)
  const [copied, setCopied] = useState(false)
  const sections = useMemo(() => parsePlan(plan.text), [plan.text])

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

  const guests = about.guestCount
  const midpoint = (budget.budgetLow + budget.budgetHigh) / 2
  const venues = venueCount(sections)
  const daysToGo =
    about.exactDate === undefined
      ? null
      : Math.round((startOfDay(about.exactDate) - startOfDay(new Date())) / DAY_MS)
  const dateText =
    about.dateMode === "exact" && about.exactDate
      ? longDate.format(about.exactDate)
      : formatMonth(about.month)

  function download() {
    const blob = new Blob([plan.text], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "wedding-plan.md"
    link.click()
    URL.revokeObjectURL(url)
  }

  function copy() {
    navigator.clipboard
      .writeText(plan.text)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    // The window height less the shell's header, footer and padding, so only the tab content scrolls.
    <main className="flex h-[calc(100dvh-9.5rem)] min-h-[28rem] w-full min-w-0 flex-col gap-4">
      {copied ? <AppAlert>{t("plan.copied")}</AppAlert> : null}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <p className="text-[length:var(--text-label)] tracking-[0.08em] text-accent uppercase">{t("plan.yourPlan")}</p>
          <h1 className="font-display text-[28px] leading-[1.1] font-semibold sm:text-[length:var(--text-display)]">
            {about.coupleNames}
          </h1>
          <p className="text-[length:var(--text-body)] text-muted">
            {t("plan.meta", { city: about.city, state: stateName, date: dateText, count: guests })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={download}>
            {t("plan.download")}
          </Button>
          <Button type="button" variant="ghost" onClick={copy}>
            {t("plan.copy")}
          </Button>
          <Button type="button" onClick={onStartAgain}>
            {t("plan.startAgain")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile
          icon="coins"
          label={t("plan.budgetMidpoint")}
          value={t("plan.perGuest", {
            amount: formatMoney(midpointPerGuest(budget.budgetLow, budget.budgetHigh, guests), about.currency),
          })}
          note={t("plan.fromRange")}
        />
        <SummaryTile
          icon="map-pin"
          label={t("plan.venues")}
          value={venues === null ? t("plan.seeBelow") : t("plan.shortlisted", { count: venues })}
          note={t("plan.withinTravel", { minutes: wedding.maxTravelMinutes ?? "—" })}
        />
        <SummaryTile
          icon="coins"
          label={t("plan.estimatedTotal")}
          value={formatMoney(midpoint, about.currency)}
          note={t("plan.midpointOfRange")}
        />
        <SummaryTile
          icon="calendar"
          label={t("plan.daysToGo")}
          value={daysToGo === null ? "—" : t("plan.days", { count: daysToGo })}
          note={about.exactDate ? t("plan.until", { date: longDate.format(about.exactDate) }) : t("plan.monthOnly")}
        />
      </div>

      {sections.length > 0 ? (
        <Tabs defaultValue={sections[0].id} className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList>
            {sections.map((section) => (
              <TabsTrigger key={section.id} value={section.id}>
                <SectionIcon icon={iconFor(section.title)} className="size-4 shrink-0 text-accent" />
                {section.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="flex min-h-0 flex-1 flex-col">
              <PlanSectionView section={section} plan={plan} />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </main>
  )
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function SummaryTile({ icon, label, value, note }: { icon: "coins" | "map-pin" | "calendar"; label: string; value: string; note: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[length:var(--text-label)] text-muted">
        <SectionIcon icon={icon} className="size-3.5 text-accent" />
        {label}
      </div>
      <p className="font-display text-[length:var(--text-body)] leading-tight font-semibold text-ink">{value}</p>
      <p className="text-[length:var(--text-label)] text-muted">{note}</p>
    </div>
  )
}

// One section of the plan. A section the research found nothing for shows a muted note instead.
function PlanSectionView({ section, plan }: { section: PlanSection; plan: PlanData }) {
  const { t } = useTranslation()
  const hideScrollbar = useRef<number | undefined>(undefined)
  const priority = priorityFor(section.title)
  const noData = priority !== null && plan.section_status[priority] === "no data"

  useEffect(() => () => window.clearTimeout(hideScrollbar.current), [])

  // The scrollbar shows for a moment after each scroll; the CSS also shows it while the card is hovered.
  function showScrollbar(card: HTMLElement) {
    card.setAttribute("data-scrolling", "")
    window.clearTimeout(hideScrollbar.current)
    hideScrollbar.current = window.setTimeout(() => card.removeAttribute("data-scrolling"), SCROLLBAR_SHOW_MS)
  }

  if (noData) {
    return (
      <section className="rounded-lg border border-dashed border-muted p-5">
        <h2 className="font-display text-[length:var(--text-title)] leading-tight font-semibold text-ink">{section.title}</h2>
        <p className="mt-2 text-[length:var(--text-content)] text-muted">{t("plan.noFigures")}</p>
      </section>
    )
  }

  return (
    // The card is the scroll container, so its rounded corners frame the scrollbar. The heading stays pinned at the top.
    <section
      onScroll={(event) => showScrollbar(event.currentTarget)}
      className="scroll-translucent flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto rounded-lg bg-surface px-5 pb-5"
    >
      <header className="sticky top-0 z-10 -mx-5 flex items-center gap-3 bg-surface px-5 pt-5 pb-2">
        <SectionIcon icon={iconFor(section.title)} className="size-5 shrink-0 text-accent" />
        <h2 className="font-display text-[length:var(--text-title)] leading-tight font-semibold text-ink">{section.title}</h2>
      </header>
      {section.blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </section>
  )
}

// Headings sit at the title and sub-heading sizes; the text beneath them is the smaller content size.
function BlockView({ block }: { block: Block }): ReactNode {
  if (block.kind === "p") {
    return <p className="wrap-anywhere text-[length:var(--text-content)] leading-normal text-muted">{block.text}</p>
  }
  if (block.kind === "h3") {
    return <h3 className="font-display text-[length:var(--text-body)] font-semibold text-ink">{block.text}</h3>
  }
  if (block.kind === "ul") {
    return (
      <ul className="min-w-0 list-disc space-y-1 pl-5 text-[length:var(--text-content)] text-ink">
        {block.items.map((item, index) => (
          <li key={index} className="wrap-anywhere">{item}</li>
        ))}
      </ul>
    )
  }
  // The first two columns (for example the item and its price) stay on one line; the rest wrap.
  // No scrolling of its own: the table sits in the section card, which is the only thing that scrolls.
  return (
    <table className="w-full border-collapse text-left text-ink">
        <thead>
          <tr className="border-b border-ink">
            {block.header.map((cell, index) => (
              <th
                key={index}
                className={`px-2 py-2 text-[length:var(--text-label)] font-semibold text-muted${index < 2 ? " whitespace-nowrap" : ""}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-muted/40">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-2 py-2 align-top text-[length:var(--text-content)]${cellIndex < 2 ? " whitespace-nowrap" : " wrap-anywhere"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
    </table>
  )
}
