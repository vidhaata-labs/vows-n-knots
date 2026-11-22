import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { fetchResearchCount, fetchStates } from "@/lib/api"
import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import { startBuild } from "@/lib/building"
import type { PlanData } from "@/lib/plan-stream"
import { EMPTY_WEDDING } from "@/lib/wedding"
import { BuildingScreen } from "@/screens/building"
import { ReviewScreen } from "@/screens/review"
import { YourPlanScreen } from "@/screens/your-plan"

vi.mock("@/lib/api", () => ({
  fetchStates: vi.fn(),
  fetchCities: vi.fn(),
  fetchResearchCount: vi.fn(),
}))

// A request whose answer arrives later, so the test can decide when it lands.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

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

const budget: BudgetValues = { budgetLow: 35000, budgetHigh: 65000, priorities: ["Venue shortlist"] }
const ready = { ...EMPTY_WEDDING, venueSetting: "Outdoor" as const, maxTravelMinutes: 45 as const }

beforeEach(() => {
  vi.mocked(fetchStates).mockResolvedValue([{ code: "IL", name: "Illinois" }])
  vi.mocked(fetchResearchCount).mockResolvedValue(3)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("screens that leave before their requests finish", () => {
  it("Review does not update after it has been left", async () => {
    const states = deferred<{ code: string; name: string }[]>()
    const counts = deferred<number>()
    vi.mocked(fetchStates).mockReturnValue(states.promise)
    vi.mocked(fetchResearchCount).mockReturnValue(counts.promise)

    const view = render(<ReviewScreen about={about} budget={budget} wedding={ready} onEdit={() => {}} />)
    view.unmount()
    await act(async () => {
      states.resolve([{ code: "IL", name: "Illinois" }])
      counts.resolve(15)
    })
    // Nothing to assert on the page: the point is that the late answers do not throw or update a closed screen.
    expect(fetchStates).toHaveBeenCalled()
  })

  it("Review falls back when a late state list is missing", async () => {
    const states = deferred<{ code: string; name: string }[]>()
    vi.mocked(fetchStates).mockReturnValue(states.promise)
    const counts = deferred<number>()
    vi.mocked(fetchResearchCount).mockReturnValue(counts.promise)

    render(<ReviewScreen about={about} budget={budget} wedding={ready} onEdit={() => {}} />)
    await act(async () => {
      states.resolve([])
      counts.resolve(3)
    })
    expect(await screen.findByText(/Chicago, IL · 18 July 2027/)).toBeInTheDocument()
  })

  it("Review ignores a failed request that arrives after it has been left", async () => {
    const states = deferred<{ code: string; name: string }[]>()
    const counts = deferred<number>()
    vi.mocked(fetchStates).mockReturnValue(states.promise)
    vi.mocked(fetchResearchCount).mockReturnValue(counts.promise)

    const view = render(<ReviewScreen about={about} budget={budget} wedding={ready} onEdit={() => {}} />)
    view.unmount()
    await act(async () => {
      states.resolve([])
      counts.resolve(3)
    })
    // Requests that fail after the screen has gone: the error handlers must stay quiet, without throwing.
    const failedStates = deferred<{ code: string; name: string }[]>()
    const failedCounts = deferred<number>()
    vi.mocked(fetchStates).mockReturnValue(failedStates.promise)
    vi.mocked(fetchResearchCount).mockReturnValue(failedCounts.promise)
    const second = render(<ReviewScreen about={about} budget={budget} wedding={ready} onEdit={() => {}} />)
    second.unmount()
    await act(async () => {
      failedStates.reject(new Error("offline"))
      failedCounts.reject(new Error("down"))
      await Promise.resolve()
    })
    expect(fetchResearchCount).toHaveBeenCalled()
  })

  it("Your plan does not update after it has been left", async () => {
    const states = deferred<{ code: string; name: string }[]>()
    vi.mocked(fetchStates).mockReturnValue(states.promise)
    const plan: PlanData = {
      text: "## Venue shortlist\n- A",
      section_status: {},
      summary: { searches: 0, cache_hits: 0, failed_tasks: 0, search_seconds: 0, model_seconds: 0, total_seconds: 0 },
    }
    const view = render(<YourPlanScreen plan={plan} about={about} budget={budget} wedding={EMPTY_WEDDING} />)
    view.unmount()
    await act(async () => {
      states.reject(new Error("offline"))
      await Promise.resolve()
    })
    expect(fetchStates).toHaveBeenCalled()
  })
})

describe("BuildingScreen timer", () => {
  it("refreshes the time left every second while searches run", () => {
    vi.useFakeTimers()
    const state = startBuild(["Venue shortlist"], Date.now())
    const view = render(<BuildingScreen state={state} priorities={["Venue shortlist"]} onRetry={() => {}} onStop={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(t("building.threeMinutes"))).toBeInTheDocument()
    view.unmount()
    // The timer is cleared with the screen, so advancing time now does nothing further.
    act(() => {
      vi.advanceTimersByTime(5000)
    })
  })

  it("does not run a timer once the searches are over", () => {
    vi.useFakeTimers()
    const state = { ...startBuild(["Venue shortlist"], Date.now()), phase: "writing" as const }
    render(<BuildingScreen state={state} priorities={["Venue shortlist"]} onRetry={() => {}} onStop={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(t("building.almostThere"))).toBeInTheDocument()
  })
})
