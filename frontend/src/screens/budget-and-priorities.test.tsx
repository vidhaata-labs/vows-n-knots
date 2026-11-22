import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { BudgetPrioritiesScreen, EMPTY_BUDGET } from "@/screens/budget-and-priorities"
import type { BudgetValues } from "@/lib/budget"

function renderScreen(initialValues: BudgetValues = EMPTY_BUDGET, handlers: { onBack?: () => void; onNext?: (v: BudgetValues) => void } = {}) {
  const onBack = handlers.onBack ?? vi.fn()
  const onNext = handlers.onNext ?? vi.fn()
  render(
    <BudgetPrioritiesScreen
      guestCount={120}
      currency="USD"
      initialValues={initialValues}
      onBack={onBack}
      onNext={onNext}
    />
  )
  return { onBack, onNext }
}

describe("BudgetPrioritiesScreen", () => {
  it("shows the step, the total and the per-guest figure", () => {
    renderScreen({ budgetLow: 35000, budgetHigh: 65000, priorities: [] })
    expect(screen.getByText(t("budget.step"))).toBeInTheDocument()
    expect(screen.getByText("$35,000 to $65,000")).toBeInTheDocument()
    // Midpoint 50,000 over 120 guests is about $417 a guest.
    expect(screen.getByText(t("budget.perGuest", { amount: "$417" }))).toBeInTheDocument()
  })

  it("moves the budget with the keyboard and passes the new range on Next", async () => {
    const { onNext } = renderScreen({ budgetLow: 35000, budgetHigh: 65000, priorities: [] })
    const [low] = screen.getAllByRole("slider")
    fireEvent.keyDown(low, { key: "ArrowRight" })
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    expect(onNext).toHaveBeenCalledWith({ budgetLow: 40000, budgetHigh: 65000, priorities: [] })
  })

  it("chooses priorities, keeps them in order, and warns above three", async () => {
    const { onNext } = renderScreen()
    await userEvent.click(screen.getByRole("button", { name: t("priority.travel") }))
    await userEvent.click(screen.getByRole("button", { name: t("priority.venue") }))
    await userEvent.click(screen.getByRole("button", { name: t("priority.vendor") }))
    expect(screen.queryByText(t("budget.notice", { count: 3 }))).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("priority.timeline") }))
    expect(screen.getByText(t("budget.notice", { count: 4 }))).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ priorities: ["Venue shortlist", "Vendor research", "Timeline", "Travel logistics"] })
    )
  })

  it("starts with the chosen priorities selected", () => {
    renderScreen({ budgetLow: 5000, budgetHigh: 250000, priorities: ["Budget allocation"] })
    expect(screen.getByRole("button", { name: t("priority.budget") })).toHaveAttribute("aria-pressed", "true")
  })

  it("goes back without changing anything", async () => {
    const { onBack, onNext } = renderScreen()
    await userEvent.click(screen.getByRole("button", { name: t("common.back") }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })
})
