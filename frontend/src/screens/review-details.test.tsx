import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { fetchResearchCount, fetchStates } from "@/lib/api"
import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import { EMPTY_WEDDING, type WeddingValues } from "@/lib/wedding"
import { ReviewScreen } from "@/screens/review"

vi.mock("@/lib/api", () => ({
  fetchStates: vi.fn(),
  fetchCities: vi.fn(),
  fetchResearchCount: vi.fn(),
}))

const about: AboutYouValues = {
  coupleNames: "Amira & Noah",
  state: "IL",
  city: "Chicago",
  cityId: "1714000",
  dateMode: "exact",
  exactDate: new Date(2027, 6, 18),
  month: "",
  guestCount: 120,
  currency: "USD",
}

const ready: WeddingValues = { ...EMPTY_WEDDING, venueSetting: "Outdoor", maxTravelMinutes: 45 }

beforeEach(() => {
  vi.mocked(fetchStates).mockResolvedValue([{ code: "IL", name: "Illinois" }])
  vi.mocked(fetchResearchCount).mockResolvedValue(15)
})

describe("ReviewScreen fallbacks", () => {
  it("keeps the state code when the states cannot be loaded", async () => {
    vi.mocked(fetchStates).mockRejectedValue(new Error("offline"))
    render(<ReviewScreen about={about} budget={{ budgetLow: 1, budgetHigh: 2, priorities: [] }} wedding={ready} onEdit={() => {}} />)
    expect(await screen.findByText(/Chicago, IL · 18 July 2027/)).toBeInTheDocument()
  })

  it("keeps the state code when the state is not in the list", async () => {
    vi.mocked(fetchStates).mockResolvedValue([{ code: "NY", name: "New York" }])
    render(<ReviewScreen about={about} budget={{ budgetLow: 1, budgetHigh: 2, priorities: [] }} wedding={ready} onEdit={() => {}} />)
    await waitFor(() => expect(fetchStates).toHaveBeenCalled())
    expect(await screen.findByText(/Chicago, IL · 18 July 2027/)).toBeInTheDocument()
  })

  it("shows the budget notice when the research count cannot be loaded", async () => {
    vi.mocked(fetchResearchCount).mockRejectedValue(new Error("down"))
    const budget: BudgetValues = {
      budgetLow: 35000,
      budgetHigh: 65000,
      priorities: ["Venue shortlist", "Vendor research", "Budget allocation", "Travel logistics"],
    }
    render(<ReviewScreen about={about} budget={budget} wedding={ready} onEdit={() => {}} />)
    expect(await screen.findByText(t("budget.notice", { count: 4 }))).toBeInTheDocument()
  })

  it("shows a month-only date in the summary", async () => {
    const monthOnly: AboutYouValues = { ...about, dateMode: "month", exactDate: undefined, month: "2027-07" }
    render(<ReviewScreen about={monthOnly} budget={{ budgetLow: 1, budgetHigh: 2, priorities: [] }} wedding={ready} onEdit={() => {}} />)
    expect(await screen.findByText(new RegExp(`${t("months.7")} 2027`))).toBeInTheDocument()
  })
})
