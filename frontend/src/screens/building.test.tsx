import { render, screen, waitFor, within } from "@testing-library/react"
import { t } from "@/i18n"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { applyProgress, markPhase, startBuild } from "@/lib/building"
import { BuildingScreen } from "@/screens/building"

const PRIORITIES = ["Venue shortlist", "Vendor research"]

function renderScreen(state: ReturnType<typeof startBuild>, handlers: { onRetry?: () => void; onStop?: () => void } = {}) {
  return render(
    <BuildingScreen
      state={state}
      priorities={PRIORITIES}
      onRetry={handlers.onRetry ?? vi.fn()}
      onStop={handlers.onStop ?? vi.fn()}
    />
  )
}

describe("BuildingScreen progress", () => {
  it("shows one tile for each category of the chosen sections, all waiting", () => {
    renderScreen(startBuild(PRIORITIES, 0))
    expect(screen.getByText(t("tile.venues"))).toBeInTheDocument()
    expect(screen.getByText(t("tile.caterers"))).toBeInTheDocument()
    expect(screen.getByText(t("tile.photographers"))).toBeInTheDocument()
    expect(screen.getByText(t("tile.music"))).toBeInTheDocument()
    expect(screen.queryByText(t("tile.budget"))).not.toBeInTheDocument()
    expect(screen.getAllByText(t("tile.waiting"))).toHaveLength(4)
  })

  it("counts searches on the tile as they finish", () => {
    let state = startBuild(PRIORITIES, 0)
    state = applyProgress(state, "task_started", "Venue shortlist", "venue", undefined)
    state = applyProgress(state, "task_finished", "Venue shortlist", "venue", "ok")
    renderScreen(state)
    expect(screen.getByText(t("tile.checked", { done: 1, total: 1 }))).toBeInTheDocument()
  })

  it("says the plan is almost ready while it is being written", () => {
    renderScreen({ ...startBuild(PRIORITIES, 0), phase: "writing" })
    expect(screen.getByText(t("building.almostThere"))).toBeInTheDocument()
  })

  it("has no separate writing step, since the title already says what is happening", () => {
    renderScreen({ ...startBuild(PRIORITIES, 0), phase: "writing" })
    expect(screen.queryByText(/writing your plan/i)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: t("building.title") })).toBeInTheDocument()
  })

  it("puts the keep-open note in the progress status, beside the time left", () => {
    renderScreen(startBuild(PRIORITIES, 0))
    const note = screen.getByText(t("building.keepOpen"))
    expect(note.parentElement).toContainElement(screen.getByText(t("building.threeMinutes")))
  })
})

describe("BuildingScreen finished writing", () => {
  it("shows the bar complete once the plan is ready", () => {
    renderScreen({ ...startBuild(PRIORITIES, 0), phase: "done" })
    expect(screen.getByText("100%")).toBeInTheDocument()
  })
})

describe("BuildingScreen failure", () => {
  it("explains the failure and offers a retry", async () => {
    const onRetry = vi.fn()
    renderScreen(markPhase(startBuild(PRIORITIES, 0), "failed"), { onRetry })
    expect(screen.getByText(t("building.failedTitle"))).toBeInTheDocument()
    expect(
      screen.getByText(t("building.failedAlert"))
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("building.tryAgain") }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe("BuildingScreen stop", () => {
  it("opens our own dialog and keeps building when the couple declines", async () => {
    const onStop = vi.fn()
    renderScreen(startBuild(PRIORITIES, 0), { onStop })

    await userEvent.click(screen.getByRole("button", { name: t("building.stop") }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(t("building.stopTitle"))).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: t("building.keepBuilding") }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(onStop).not.toHaveBeenCalled()
  })

  it("stops the build only when the couple confirms in the dialog", async () => {
    const onStop = vi.fn()
    renderScreen(startBuild(PRIORITIES, 0), { onStop })

    await userEvent.click(screen.getByRole("button", { name: t("building.stop") }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: t("building.stop") }))

    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
