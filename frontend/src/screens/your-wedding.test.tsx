import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { YourWeddingScreen } from "@/screens/your-wedding"
import { EMPTY_WEDDING, type WeddingValues } from "@/lib/wedding"

function renderScreen(initialValues: WeddingValues = EMPTY_WEDDING) {
  const onBack = vi.fn()
  const onNext = vi.fn()
  render(<YourWeddingScreen initialValues={initialValues} onBack={onBack} onNext={onNext} />)
  return { onBack, onNext }
}

describe("YourWeddingScreen", () => {
  it("shows every group of choices with its label", () => {
    renderScreen()
    const labels = [t("wedding.styles"), t("wedding.dietary"), t("wedding.venue"), t("wedding.travel"), t("wedding.traditions")]
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByPlaceholderText(t("wedding.traditionsPlaceholder"))).toBeInTheDocument()
  })

  it("chooses several styles and passes them in the wireframe order on Next", async () => {
    const { onNext } = renderScreen()
    await userEvent.click(screen.getByRole("button", { name: t("style.Garden") }))
    await userEvent.click(screen.getByRole("button", { name: t("style.Modern") }))
    await userEvent.click(screen.getByRole("button", { name: t("dietary.vegan") }))
    await userEvent.click(screen.getByRole("radio", { name: t("venueSetting.Outdoor") }))
    await userEvent.click(screen.getByRole("radio", { name: t("wedding.minutes", { count: 45 }) }))
    await userEvent.type(screen.getByPlaceholderText(t("wedding.traditionsPlaceholder")), "Tea ceremony")
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))

    expect(onNext).toHaveBeenCalledWith({
      styles: ["Modern", "Garden"],
      dietary: ["vegan"],
      venueSetting: "Outdoor",
      maxTravelMinutes: 45,
      traditions: "Tea ceremony",
    })
  })

  it("clears the venue and the travel time when the chosen chip is clicked again", async () => {
    const { onNext } = renderScreen({
      ...EMPTY_WEDDING,
      venueSetting: "Indoor",
      maxTravelMinutes: 30,
    })
    await userEvent.click(screen.getByRole("radio", { name: t("venueSetting.Indoor") }))
    await userEvent.click(screen.getByRole("radio", { name: t("wedding.minutes", { count: 30 }) }))
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ venueSetting: "", maxTravelMinutes: null }))
  })

  it("starts with the given choices selected", () => {
    renderScreen({ ...EMPTY_WEDDING, styles: ["Classic"], dietary: ["halal"], venueSetting: "Outdoor", maxTravelMinutes: 60 })
    expect(screen.getByRole("button", { name: t("style.Classic") })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: t("dietary.halal") })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("radio", { name: t("venueSetting.Outdoor") })).toHaveAttribute("aria-checked", "true")
  })

  it("goes back without submitting", async () => {
    const { onBack, onNext } = renderScreen()
    await userEvent.click(screen.getByRole("button", { name: t("common.back") }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })
})
