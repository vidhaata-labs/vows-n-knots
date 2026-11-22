import { render, screen, waitFor } from "@testing-library/react"
import { t } from "@/i18n"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import { fetchResearchCount, fetchStates } from "@/lib/api"
import { EMPTY_WEDDING, type WeddingValues } from "@/lib/wedding"
import { ReviewScreen, type ReviewStep } from "@/screens/review"

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

const readyWedding: WeddingValues = {
  ...EMPTY_WEDDING,
  venueSetting: "Outdoor",
  maxTravelMinutes: 45,
}

const GATE_MESSAGE = t("review.gate")

beforeEach(() => {
  vi.mocked(fetchStates).mockResolvedValue([{ code: "IL", name: "Illinois" }])
  vi.mocked(fetchResearchCount).mockResolvedValue(15)
})

describe("ReviewScreen build button", () => {
  it("stays disabled, with the reason, until the venue and travel are chosen", () => {
    const budget: BudgetValues = { budgetLow: 35000, budgetHigh: 65000, priorities: ["Venue shortlist"] }
    render(<ReviewScreen about={about} budget={budget} wedding={EMPTY_WEDDING} onEdit={vi.fn()} onBuild={vi.fn()} />)

    expect(screen.getByRole("button", { name: t("review.build") })).toBeDisabled()
    expect(screen.getByText(GATE_MESSAGE)).toBeInTheDocument()
  })

  it("starts the build when every answer is set", async () => {
    const onBuild = vi.fn()
    const budget: BudgetValues = { budgetLow: 35000, budgetHigh: 65000, priorities: ["Venue shortlist"] }
    render(<ReviewScreen about={about} budget={budget} wedding={readyWedding} onEdit={vi.fn()} onBuild={onBuild} />)

    expect(screen.queryByText(GATE_MESSAGE)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))
    expect(onBuild).toHaveBeenCalledTimes(1)
  })
})

describe("ReviewScreen notices", () => {
  it("gives the search count for four priorities once the research plan answers", async () => {
    const budget: BudgetValues = {
      budgetLow: 35000,
      budgetHigh: 65000,
      priorities: ["Venue shortlist", "Vendor research", "Budget allocation", "Travel logistics"],
    }
    render(<ReviewScreen about={about} budget={budget} wedding={readyWedding} onEdit={vi.fn()} />)

    expect(
      await screen.findByText(t("review.searchNotice", { word: t("numbers.4"), searches: 15 }))
    ).toBeInTheDocument()
    expect(fetchResearchCount).toHaveBeenCalledWith(budget.priorities)
  })

  it("shows no priority notice for three priorities", async () => {
    const budget: BudgetValues = {
      budgetLow: 35000,
      budgetHigh: 65000,
      priorities: ["Venue shortlist", "Vendor research", "Budget allocation"],
    }
    render(<ReviewScreen about={about} budget={budget} wedding={readyWedding} onEdit={vi.fn()} />)

    await waitFor(() => expect(fetchStates).toHaveBeenCalled())
    expect(screen.queryByText(/priorities mean/)).not.toBeInTheDocument()
  })
})

describe("ReviewScreen edit links", () => {
  it("sends each Edit link to its own step", async () => {
    const onEdit = vi.fn<(step: ReviewStep) => void>()
    const budget: BudgetValues = { budgetLow: 35000, budgetHigh: 65000, priorities: ["Venue shortlist"] }
    render(<ReviewScreen about={about} budget={budget} wedding={readyWedding} onEdit={onEdit} />)

    const edits = screen.getAllByText(t("common.edit"))
    expect(edits).toHaveLength(3)
    for (const edit of edits) await userEvent.click(edit)
    expect(onEdit.mock.calls.map(([step]) => step)).toEqual(["about", "budget", "wedding"])
  })
})
