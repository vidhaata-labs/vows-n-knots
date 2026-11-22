import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { fetchCities, fetchStates } from "@/lib/api"
import { MESSAGES, type AboutYouValues } from "@/lib/about-you-schema"
import { AboutYouScreen, EMPTY_ABOUT_YOU } from "@/screens/about-you"

vi.mock("@/lib/api", () => ({
  fetchStates: vi.fn(),
  fetchCities: vi.fn(),
  fetchResearchCount: vi.fn(),
}))

const CITIES = [
  { id: "1714000", name: "Chicago" },
  { id: "1714001", name: "Chicago Heights" },
]

const filled: AboutYouValues = {
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

beforeEach(() => {
  vi.mocked(fetchStates).mockResolvedValue([
    { code: "IL", name: "Illinois" },
    { code: "NY", name: "New York" },
  ])
  vi.mocked(fetchCities).mockResolvedValue(CITIES)
})

describe("AboutYouScreen", () => {
  it("shows the step and every field", async () => {
    render(<AboutYouScreen />)
    expect(screen.getByText(t("about.step"))).toBeInTheDocument()
    expect(screen.getByLabelText(t("about.couple"))).toBeInTheDocument()
    expect(screen.getByLabelText(t("about.guests"))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("about.chooseDate") })).toBeInTheDocument()
    await waitFor(() => expect(fetchStates).toHaveBeenCalled())
  })

  it("asks for the required answers when the form is submitted empty", async () => {
    const onNext = vi.fn()
    render(<AboutYouScreen onNext={onNext} />)
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    expect(await screen.findByText(MESSAGES.names)).toBeInTheDocument()
    expect(screen.getByText(MESSAGES.guests)).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it("submits the values when every answer is valid", async () => {
    const onNext = vi.fn()
    render(<AboutYouScreen initialValues={filled} onNext={onNext} />)
    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0]).toMatchObject({ coupleNames: "Amira & Noah", cityId: "1714000", guestCount: 120 })
  })

  it("changes the currency and the exact date before submitting", async () => {
    const onNext = vi.fn()
    render(<AboutYouScreen initialValues={filled} onNext={onNext} />)

    await userEvent.click(screen.getByRole("combobox", { name: t("about.currency") }))
    await userEvent.click(await screen.findByRole("option", { name: "EUR" }))

    await userEvent.click(screen.getByRole("button", { name: "18 July 2027" }))
    const calendar = await screen.findByRole("grid")
    await userEvent.click(within(calendar).getByRole("button", { name: /July 20/ }))

    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0]).toMatchObject({ currency: "EUR" })
    expect(onNext.mock.calls[0][0].exactDate.getDate()).toBe(20)
  })

  it("goes back to the previous step", async () => {
    const onBack = vi.fn()
    render(<AboutYouScreen onBack={onBack} />)
    await userEvent.click(screen.getByRole("button", { name: t("common.back") }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("offers no states or cities when the lists cannot be loaded", async () => {
    vi.mocked(fetchStates).mockRejectedValue(new Error("offline"))
    vi.mocked(fetchCities).mockRejectedValue(new Error("offline"))
    render(<AboutYouScreen initialValues={filled} />)
    await waitFor(() => expect(fetchCities).toHaveBeenCalledWith("IL"))
    await userEvent.click(screen.getByRole("combobox", { name: t("about.state") }))
    expect(screen.queryByRole("option")).not.toBeInTheDocument()
  })

  it("keeps the city field off until a state is chosen", () => {
    render(<AboutYouScreen />)
    expect(screen.getByRole("combobox", { name: t("about.city") })).toBeDisabled()
  })

  it("loads the cities after a state is chosen and accepts a pick from the list", async () => {
    const onNext = vi.fn()
    render(<AboutYouScreen initialValues={{ ...filled, state: "", city: "", cityId: "" }} onNext={onNext} />)

    await userEvent.click(screen.getByRole("combobox", { name: t("about.state") }))
    await userEvent.click(await screen.findByRole("option", { name: "Illinois" }))
    await waitFor(() => expect(fetchCities).toHaveBeenCalledWith("IL"))

    const city = screen.getByRole("combobox", { name: t("about.city") })
    await userEvent.type(city, "Chicago")
    await userEvent.click(await screen.findByRole("button", { name: "Chicago Heights" }))
    expect(city).toHaveValue("Chicago Heights")
  })

  it("explains when typed text matches no city in the state", async () => {
    render(<AboutYouScreen initialValues={{ ...filled, cityId: "" }} />)
    await waitFor(() => expect(fetchCities).toHaveBeenCalledWith("IL"))
    await userEvent.type(screen.getByRole("combobox", { name: t("about.city") }), "Zzz")
    expect(await screen.findByText(t("about.noCityMatch", { state: "Illinois" }))).toBeInTheDocument()
  })

  it("clears the chosen city when the state changes", async () => {
    render(<AboutYouScreen initialValues={filled} />)
    await waitFor(() => expect(fetchCities).toHaveBeenCalledWith("IL"))
    await userEvent.click(screen.getByRole("combobox", { name: t("about.state") }))
    await userEvent.click(await screen.findByRole("option", { name: "New York" }))
    await waitFor(() => expect(fetchCities).toHaveBeenCalledWith("NY"))
    expect(screen.getByRole("combobox", { name: t("about.city") })).toHaveValue("")
  })

  it("switches to a month-only date and reports the month", async () => {
    const onNext = vi.fn()
    render(<AboutYouScreen initialValues={filled} onNext={onNext} />)

    await userEvent.click(screen.getByRole("radio", { name: t("about.monthOnly") }))
    expect(screen.getByRole("button", { name: t("about.chooseMonth") })).toBeInTheDocument()

    // The picker opens on the current year; one step forward gives the next year, in November.
    const nextYear = new Date().getFullYear() + 1
    await userEvent.click(screen.getByRole("button", { name: t("about.chooseMonth") }))
    await userEvent.click(screen.getByRole("button", { name: t("about.nextYear") }))
    await userEvent.click(screen.getByRole("button", { name: t("monthsShort.11") }))

    await userEvent.click(screen.getByRole("button", { name: t("common.next") }))
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0]).toMatchObject({ dateMode: "month", month: `${nextYear}-11` })
  })

  it("starts from the empty answers", () => {
    expect(EMPTY_ABOUT_YOU).toMatchObject({ coupleNames: "", state: "", dateMode: "exact", currency: "USD" })
  })
})
