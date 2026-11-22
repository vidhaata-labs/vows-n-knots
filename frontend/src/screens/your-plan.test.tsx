import { render, screen } from "@testing-library/react"
import { t } from "@/i18n"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fetchStates } from "@/lib/api"
import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import type { PlanData } from "@/lib/plan-stream"
import { EMPTY_WEDDING } from "@/lib/wedding"
import { YourPlanScreen } from "@/screens/your-plan"

vi.mock("@/lib/api", () => ({
  fetchStates: vi.fn(),
  fetchResearchCount: vi.fn(),
}))

const about: AboutYouValues = {
  coupleNames: "Amira & Noah",
  state: "IL",
  city: "Chicago",
  cityId: "IL-1714000",
  dateMode: "exact",
  exactDate: new Date(2027, 6, 18),
  month: "",
  guestCount: 120,
  currency: "USD",
}

const budget: BudgetValues = { budgetLow: 35000, budgetHigh: 65000, priorities: ["Venue shortlist", "Budget allocation"] }

const plan: PlanData = {
  text: "Intro for the couple.\n\n## Venue shortlist\n- Redfield Estate\n- Lakeside Hall\n\n## Budget allocation\nTotal about $50,000.",
  section_status: { "Venue shortlist": "ok", "Budget allocation": "no data" },
  summary: { searches: 5, cache_hits: 0, failed_tasks: 0, search_seconds: 1, model_seconds: 2, total_seconds: 3 },
}

beforeEach(() => {
  vi.mocked(fetchStates).mockResolvedValue([{ code: "IL", name: "Illinois" }])
})

function renderPlan(onStartAgain = vi.fn()) {
  render(
    <YourPlanScreen plan={plan} about={about} budget={budget} wedding={EMPTY_WEDDING} onStartAgain={onStartAgain} />
  )
  return { onStartAgain }
}

describe("YourPlanScreen", () => {
  it("shows the model's sections as tabs, with the summary open first", async () => {
    renderPlan()
    expect(screen.getByRole("tab", { name: "Venue shortlist" })).toBeInTheDocument()
    expect(screen.getByText("Intro for the couple.")).toBeInTheDocument()
    expect(screen.queryByText("Redfield Estate")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    expect(screen.getByText("Redfield Estate")).toBeInTheDocument()
    expect(screen.getByText("Lakeside Hall")).toBeInTheDocument()
    expect(screen.queryByText("Intro for the couple.")).not.toBeInTheDocument()
  })

  it("says so plainly in a section that has no current figures", async () => {
    renderPlan()
    await userEvent.click(screen.getByRole("tab", { name: "Budget allocation" }))
    expect(screen.getByText(t("plan.noFigures"))).toBeInTheDocument()
  })

  it("copies the plan and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    renderPlan()

    await userEvent.click(screen.getByRole("button", { name: t("plan.copy") }))

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain("Redfield Estate")
    expect(await screen.findByText(t("plan.copied"))).toBeInTheDocument()
  })

  it("starts again when asked", async () => {
    const { onStartAgain } = renderPlan()
    await userEvent.click(screen.getByRole("button", { name: t("plan.startAgain") }))
    expect(onStartAgain).toHaveBeenCalledTimes(1)
  })
})
