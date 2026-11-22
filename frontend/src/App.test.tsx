import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import App from "@/App"
import { t } from "@/i18n"
import { fetchCities, fetchResearchCount, fetchStates } from "@/lib/api"
import { streamPlan, type PlanData, type PlanEvent } from "@/lib/plan-stream"

vi.mock("@/lib/api", () => ({
  fetchStates: vi.fn(),
  fetchCities: vi.fn(),
  fetchResearchCount: vi.fn(),
}))

vi.mock("@/lib/plan-stream", () => ({ streamPlan: vi.fn() }))

const PLAN: PlanData = {
  text: "Intro.\n\n## Venue shortlist\n- Redfield Estate\n- Lakeside Hall",
  section_status: { "Venue shortlist": "ok", "Budget allocation": "ok", "Vendor research": "ok" },
  summary: { searches: 14, cache_hits: 0, failed_tasks: 0, search_seconds: 1, model_seconds: 2, total_seconds: 3 },
}

// The stream the app opens for the current build. Each test decides what it sends.
type Stream = { onEvent: (event: PlanEvent) => void; signal: AbortSignal; finish: () => void }
let streams: Stream[] = []

// By default the build sends progress and then the plan.
function sendPlanAtOnce() {
  vi.mocked(streamPlan).mockImplementation(async (_body, onEvent) => {
    onEvent({ event: "progress", data: { kind: "task_started", section: "Venue shortlist", category: "venue" } })
    onEvent({ event: "progress", data: { kind: "task_finished", section: "Venue shortlist", category: "venue", status: "ok" } })
    onEvent({ event: "progress", data: { kind: "synthesis_started", section: "", category: "" } })
    onEvent({ event: "plan", data: PLAN })
  })
}

// Keeps the stream open, so the test can stop the build or send events itself.
function holdStream() {
  vi.mocked(streamPlan).mockImplementation(
    (_body, onEvent, signal) =>
      new Promise<void>((resolve) => {
        streams.push({ onEvent, signal, finish: resolve })
      })
  )
}

async function goThroughToReview() {
  await userEvent.click(screen.getByRole("button", { name: t("welcome.start") }))
  // The sample couple is filled in on every step, so Next moves straight through.
  for (let step = 0; step < 3; step++) {
    await userEvent.click(await screen.findByRole("button", { name: t("common.next") }))
  }
  await screen.findByRole("heading", { name: t("review.title") })
}

beforeEach(() => {
  streams = []
  vi.mocked(fetchStates).mockResolvedValue([{ code: "IL", name: "Illinois" }])
  vi.mocked(fetchCities).mockResolvedValue([{ id: "1714000", name: "Chicago" }])
  vi.mocked(fetchResearchCount).mockResolvedValue(14)
  sendPlanAtOnce()
})

describe("App flow", () => {
  it("takes the couple from welcome to a finished plan, and back to the start", async () => {
    render(<App />)
    await goThroughToReview()

    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))
    expect(await screen.findByRole("heading", { name: "Amira & Noah" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: "Venue shortlist" }))
    expect(screen.getByText("Redfield Estate")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: t("plan.startAgain") }))
    expect(screen.getByRole("button", { name: t("welcome.start") })).toBeInTheDocument()
  })

  it("sends the chosen answers to the plan stream", async () => {
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))
    await screen.findByRole("heading", { name: "Amira & Noah" })

    const [body] = vi.mocked(streamPlan).mock.calls[0]
    expect(body).toMatchObject({
      couple_name: "Amira & Noah",
      city: "Chicago",
      state: "IL",
      guest_count: 120,
      wedding_date: "2027-07-18",
      venue_setting: "Indoor-outdoor",
      max_travel_minutes: 45,
    })
  })

  it("steps back through the earlier screens", async () => {
    render(<App />)
    await userEvent.click(screen.getByRole("button", { name: t("welcome.start") }))
    await userEvent.click(await screen.findByRole("button", { name: t("common.back") }))
    expect(screen.getByRole("button", { name: t("welcome.start") })).toBeInTheDocument()
  })

  it("moves from budget back to about you, and from wedding back to budget", async () => {
    render(<App />)
    await userEvent.click(screen.getByRole("button", { name: t("welcome.start") }))
    await userEvent.click(await screen.findByRole("button", { name: t("common.next") }))
    await screen.findByRole("heading", { name: t("budget.title") })
    await userEvent.click(screen.getByRole("button", { name: t("common.back") }))
    expect(await screen.findByRole("heading", { name: t("about.title") })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    await userEvent.click(await screen.findByRole("button", { name: t("common.next") }))
    await screen.findByRole("heading", { name: t("wedding.title") })
    await userEvent.click(screen.getByRole("button", { name: t("common.back") }))
    expect(await screen.findByRole("heading", { name: t("budget.title") })).toBeInTheDocument()
  })

  it("lets the couple edit a section from the review screen", async () => {
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("common.editSection", { section: t("review.sectionWedding") }) }))
    expect(await screen.findByRole("heading", { name: t("wedding.title") })).toBeInTheDocument()
  })

  it("does not start the build from review while a gap is open", async () => {
    render(<App />)
    await goThroughToReview()
    // Clearing the venue (by clicking the chosen setting again) closes the build gate.
    await userEvent.click(screen.getByRole("button", { name: t("common.editSection", { section: t("review.sectionWedding") }) }))
    await userEvent.click(await screen.findByRole("radio", { name: t("venueSetting.Indoor-outdoor") }))
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    expect(await screen.findByText(t("review.gate"))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("review.build") })).toBeDisabled()
    expect(streamPlan).not.toHaveBeenCalled()
  })
})

describe("App building", () => {
  it("stops the build when the couple confirms in the dialog, and returns to review", async () => {
    holdStream()
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))

    await userEvent.click(await screen.findByRole("button", { name: t("building.stop") }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: t("building.stopConfirm") }))

    await screen.findByRole("heading", { name: t("review.title") })
    expect(streams[0].signal.aborted).toBe(true)
  })

  it("keeps building when the couple declines to stop", async () => {
    holdStream()
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))

    await userEvent.click(await screen.findByRole("button", { name: t("building.stop") }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: t("building.keepBuilding") }))
    expect(streams[0].signal.aborted).toBe(false)
    expect(screen.getByRole("heading", { name: t("building.title") })).toBeInTheDocument()
  })

  it("offers a retry after the plan fails, and starts a new build", async () => {
    vi.mocked(streamPlan).mockImplementationOnce(async (_body, onEvent) => {
      onEvent({ event: "failed", data: { message: "Writing the plan failed." } })
    })
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))

    expect(await screen.findByRole("heading", { name: t("building.failedTitle") })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("building.tryAgain") }))
    expect(await screen.findByRole("heading", { name: "Amira & Noah" })).toBeInTheDocument()
    expect(streamPlan).toHaveBeenCalledTimes(2)
  })

  it("shows the plan when the stream ends with the plan event", async () => {
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))
    expect(await screen.findByRole("heading", { name: "Amira & Noah" })).toBeInTheDocument()
  })

  it("asks the browser to confirm leaving while the build runs, and not once it has finished", async () => {
    holdStream()
    render(<App />)
    await goThroughToReview()
    await userEvent.click(screen.getByRole("button", { name: t("review.build") }))
    await screen.findByRole("heading", { name: t("building.title") })

    const leaving = new Event("beforeunload", { cancelable: true })
    act(() => {
      window.dispatchEvent(leaving)
    })
    expect(leaving.defaultPrevented).toBe(true)

    // Once the plan arrives, leaving is no longer blocked.
    act(() => {
      streams[0].onEvent({ event: "plan", data: PLAN })
    })
    await screen.findByRole("heading", { name: "Amira & Noah" })
    await waitFor(() => {
      const after = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(after)
      expect(after.defaultPrevented).toBe(false)
    })
  })
})
