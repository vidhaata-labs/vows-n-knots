import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { WelcomeScreen } from "@/screens/welcome"

describe("WelcomeScreen", () => {
  it("shows the promise and the wait up front", () => {
    render(<WelcomeScreen onStart={() => {}} />)
    expect(screen.getByText(t("welcome.eyebrow"))).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: t("welcome.title") })).toBeInTheDocument()
    expect(screen.getByText(t("welcome.intro"))).toBeInTheDocument()
  })

  it("starts the flow when the couple presses the start button", async () => {
    const onStart = vi.fn()
    render(<WelcomeScreen onStart={onStart} />)
    await userEvent.click(screen.getByRole("button", { name: t("welcome.start") }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
