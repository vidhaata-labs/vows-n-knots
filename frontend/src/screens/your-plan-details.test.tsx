import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { fetchStates } from "@/lib/api"
import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import type { PlanData } from "@/lib/plan-stream"
import { EMPTY_WEDDING } from "@/lib/wedding"
import { YourPlanScreen } from "@/screens/your-plan"

vi.mock("@/lib/api", () => ({
  fetchStates: vi.fn(),
  fetchCities: vi.fn(),
  fetchResearchCount: vi.fn(),
}))

const exactAbout: AboutYouValues = {
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

const budget: BudgetValues = { budgetLow: 35000, budgetHigh: 65000, priorities: ["Venue shortlist"] }

// Covers a heading, a sub-heading, a paragraph, a list, a table and a section with no data.
const RICH_PLAN: PlanData = {
  text: [
    "Intro for the couple.",
    "",
    "## Venue shortlist",
    "Three options near downtown.",
    "### Redfield Estate",
    "- Capacity for 150 guests",
    "- Garden terrace",
    "",
    "| Option | Price |",
    "|---|---|",
    "| Redfield | $650 a day |",
    "",
    "## Florals",
    "Nothing current.",
  ].join("\n"),
  section_status: { "Venue shortlist": "ok" },
  summary: { searches: 3, cache_hits: 0, failed_tasks: 0, search_seconds: 1, model_seconds: 2, total_seconds: 3 },
}

beforeEach(() => {
  vi.mocked(fetchStates).mockResolvedValue([{ code: "IL", name: "Illinois" }])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("YourPlanScreen sections", () => {
  it("draws sub-headings, paragraphs, lists and tables from the plan text", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    expect(screen.getByRole("heading", { level: 3, name: "Redfield Estate" })).toBeInTheDocument()
    expect(screen.getByText("Three options near downtown.")).toBeInTheDocument()
    expect(screen.getByText("Capacity for 150 guests")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)

    const table = screen.getByRole("table")
    expect(within(table).getByRole("columnheader", { name: "Option" })).toBeInTheDocument()
    expect(within(table).getByRole("cell", { name: "$650 a day" })).toBeInTheDocument()
  })

  it("shows a section without a priority as a normal tab", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Florals" }))
    // "Florals" has no priority behind it, so it is shown as a normal section, not muted.
    expect(screen.getByRole("heading", { name: "Florals" })).toBeInTheDocument()
    expect(screen.getByText("Nothing current.")).toBeInTheDocument()
  })

  it("shows a muted section when the research for its priority failed", () => {
    const plan: PlanData = {
      ...RICH_PLAN,
      text: "## Venue shortlist\nNo venues found.",
      section_status: { "Venue shortlist": "no data" },
    }
    render(<YourPlanScreen plan={plan} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    expect(screen.getByText(t("plan.noFigures"))).toBeInTheDocument()
    expect(screen.queryByText("No venues found.")).not.toBeInTheDocument()
  })

  it("shows one section at a time and switches with the tabs", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    expect(screen.getByText("Intro for the couple.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    expect(screen.getByRole("heading", { level: 3, name: "Redfield Estate" })).toBeInTheDocument()
    expect(screen.queryByText("Intro for the couple.")).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Venue shortlist" })).toHaveAttribute("aria-selected", "true")
  })

  it("says See below for venues when the plan has no venue list", () => {
    const plan: PlanData = { ...RICH_PLAN, text: "## Budget allocation\nAbout $50,000." }
    render(<YourPlanScreen plan={plan} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    expect(screen.getByText(t("plan.seeBelow"))).toBeInTheDocument()
  })

  it("counts the venues in the venue list", () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    // The venue section lists two places, so the summary counts two.
    expect(screen.getByText(t("plan.shortlisted", { count: 2 }))).toBeInTheDocument()
  })
})

describe("YourPlanScreen summary for a month-only date", () => {
  it("shows the month, has no countdown, and notes the month only", async () => {
    const monthOnly: AboutYouValues = { ...exactAbout, dateMode: "month", exactDate: undefined, month: "2027-07" }
    render(<YourPlanScreen plan={RICH_PLAN} about={monthOnly} budget={budget} wedding={EMPTY_WEDDING} />)
    // The state name loads from the API, so the heading shows the full name once it arrives.
    expect(await screen.findByText(`Chicago, Illinois · ${t("months.7")} 2027 · 120 guests`)).toBeInTheDocument()
    expect(screen.getByText(t("plan.monthOnly"))).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})

describe("YourPlanScreen layout", () => {
  it("puts the actions beside the couple's names, above the tabs", () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    const name = screen.getByRole("heading", { level: 1, name: "Amira & Noah" })
    const download = screen.getByRole("button", { name: t("plan.download") })
    const tablist = screen.getByRole("tablist")
    // Actions come after the name in the page, and before the tab list.
    expect(name.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(download.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("scrolls inside the section card, not the page or the tab panel", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    const card = screen.getByRole("heading", { level: 2, name: "Venue shortlist" }).closest("section") as HTMLElement
    expect(card).toHaveClass("overflow-y-auto", "rounded-lg", "scroll-translucent")
    expect(screen.getByRole("tabpanel")).not.toHaveClass("overflow-y-auto")
  })

  it("shows the card's scrollbar after a scroll, then lets it go clear again", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    const card = screen.getByRole("heading", { level: 2, name: "Venue shortlist" }).closest("section") as HTMLElement
    expect(card).not.toHaveAttribute("data-scrolling")
    fireEvent.scroll(card)
    expect(card).toHaveAttribute("data-scrolling")
    await waitFor(() => expect(card).not.toHaveAttribute("data-scrolling"), { timeout: 2000 })
  })

  it("restarts the scrollbar timer when the card scrolls again", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    const card = screen.getByRole("heading", { level: 2, name: "Venue shortlist" }).closest("section") as HTMLElement
    fireEvent.scroll(card)
    fireEvent.scroll(card)
    expect(card).toHaveAttribute("data-scrolling")
  })

  it("keeps the section heading pinned at the top of the scrolling card", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    const heading = screen.getByRole("heading", { level: 2, name: "Venue shortlist" })
    expect(heading.closest("header")).toHaveClass("sticky", "top-0")
  })

  it("gives the table no scrollbar of its own: the section card is the only scrolling part", async () => {
    const plan: PlanData = {
      ...RICH_PLAN,
      text: "## Budget allocation\n| Category | Allocation | Notes |\n|---|---|---|\n| Venue | $20,000 | A note |",
      section_status: {},
    }
    render(<YourPlanScreen plan={plan} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Budget allocation" }))
    const table = screen.getByRole("table")
    expect(table.closest(".overflow-x-auto")).toBeNull()
    const card = table.closest("section") as HTMLElement
    expect(card).toHaveClass("overflow-x-hidden", "overflow-y-auto")
  })

  it("keeps the first two table columns on one line and lets the rest wrap", async () => {
    const plan: PlanData = {
      ...RICH_PLAN,
      text: "## Budget allocation\n| Category | Allocation | Notes |\n|---|---|---|\n| Venue | $20,000 | Includes the deposit and the setup crew |",
      section_status: {},
    }
    render(<YourPlanScreen plan={plan} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Budget allocation" }))
    const [category, allocation, notes] = within(screen.getByRole("table")).getAllByRole("cell")
    expect(category).toHaveClass("whitespace-nowrap")
    expect(allocation).toHaveClass("whitespace-nowrap")
    expect(notes).not.toHaveClass("whitespace-nowrap")
    expect(notes).toHaveClass("wrap-anywhere")
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Allocation" })).toHaveClass("whitespace-nowrap")
  })

  it("sets section titles larger than the content beneath them", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    const title = screen.getByRole("heading", { level: 2, name: "Venue shortlist" })
    const content = screen.getByText("Three options near downtown.")
    expect(title).toHaveClass("text-[length:var(--text-title)]")
    expect(content).toHaveClass("text-[length:var(--text-content)]")
    expect(screen.getByRole("heading", { level: 3, name: "Redfield Estate" })).toHaveClass("text-[length:var(--text-body)]")
  })

  it("shows the summary values at the body size, not the title size", () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    expect(screen.getByText(t("plan.perGuest", { amount: "$417" }))).toHaveClass("text-[length:var(--text-body)]")
    expect(screen.getByText(t("plan.shortlisted", { count: 2 }))).toHaveClass("text-[length:var(--text-body)]")
  })
})

describe("YourPlanScreen actions", () => {
  it("downloads the plan as a Markdown file", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:plan")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("button", { name: t("plan.download") }))

    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe("text/markdown")
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:plan")
  })

  it("does not confirm a copy that the browser refused", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    })
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    await userEvent.click(screen.getByRole("button", { name: t("plan.copy") }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    expect(screen.queryByText(t("plan.copied"))).not.toBeInTheDocument()
  })

  it("loads the state name for the heading", async () => {
    render(<YourPlanScreen plan={RICH_PLAN} about={exactAbout} budget={budget} wedding={EMPTY_WEDDING} />)
    expect(await screen.findByText("Chicago, Illinois · 18 July 2027 · 120 guests")).toBeInTheDocument()
    expect(fetchStates).toHaveBeenCalled()
  })
})
