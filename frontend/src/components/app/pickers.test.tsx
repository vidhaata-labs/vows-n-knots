import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { t } from "@/i18n"
import { CITY_RESULT_LIMIT, CityPicker, filterCities } from "@/components/app/city-picker"
import { ExactDatePicker } from "@/components/app/exact-date-picker"
import { MonthPicker, formatMonth } from "@/components/app/month-picker"
import type { CityOption } from "@/lib/api"

const CITIES: CityOption[] = [
  { id: "1", name: "Chicago" },
  { id: "2", name: "Chicago Heights" },
  { id: "3", name: "Naperville" },
]

describe("filterCities", () => {
  it("matches names that start with the typed text, ignoring case and spaces", () => {
    expect(filterCities(CITIES, "  chic ").map((city) => city.name)).toEqual(["Chicago", "Chicago Heights"])
  })

  it("lists the first cities for an empty query", () => {
    expect(filterCities(CITIES, "")).toHaveLength(3)
  })

  it("caps the number of results", () => {
    const many = Array.from({ length: CITY_RESULT_LIMIT + 10 }, (_, index) => ({ id: String(index), name: `Town ${index}` }))
    expect(filterCities(many, "")).toHaveLength(CITY_RESULT_LIMIT)
  })
})

describe("CityPicker", () => {
  function renderPicker(overrides: Partial<Parameters<typeof CityPicker>[0]> = {}) {
    const props = {
      id: "city",
      cities: CITIES,
      query: "",
      onQueryChange: vi.fn(),
      selectedId: "",
      onPick: vi.fn(),
      invalid: false,
      disabled: false,
      ...overrides,
    }
    render(<CityPicker {...props} />)
    return props
  }

  it("asks for a state first when the state is not chosen", () => {
    renderPicker({ disabled: true })
    expect(screen.getByRole("combobox")).toBeDisabled()
    expect(screen.getByPlaceholderText(t("about.cityNeedsState"))).toBeInTheDocument()
  })

  it("passes typed text up and opens the list", async () => {
    const props = renderPicker()
    await userEvent.type(screen.getByRole("combobox"), "C")
    expect(props.onQueryChange).toHaveBeenLastCalledWith("C")
    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })

  it("picks a city with the mouse and closes the list", async () => {
    const props = renderPicker({ query: "Chi" })
    await userEvent.click(screen.getByRole("combobox"))
    await userEvent.click(screen.getByRole("button", { name: "Chicago" }))
    expect(props.onPick).toHaveBeenCalledWith(CITIES[0])
  })

  it("moves through the list with the arrow keys and picks with Enter", async () => {
    const props = renderPicker()
    const input = screen.getByRole("combobox")
    await userEvent.click(input)
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" }) // stops at the last result
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "ArrowUp" }) // stops at the first result
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(props.onPick).toHaveBeenCalledWith(CITIES[1])
  })

  it("closes on Escape and ignores keys while closed", async () => {
    const props = renderPicker()
    const input = screen.getByRole("combobox")
    fireEvent.keyDown(input, { key: "Enter" }) // closed: nothing picked
    expect(props.onPick).not.toHaveBeenCalled()
    await userEvent.click(input)
    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("closes when the field loses focus", async () => {
    renderPicker()
    const input = screen.getByRole("combobox")
    await userEvent.click(input)
    expect(screen.getByRole("listbox")).toBeInTheDocument()
    fireEvent.blur(input)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("marks the chosen city and the invalid state", async () => {
    renderPicker({ query: "Chi", selectedId: "1", invalid: true })
    await userEvent.click(screen.getByRole("combobox"))
    const options = screen.getAllByRole("option")
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("combobox")).toHaveClass("border-accent")
  })

  it("shows nothing when no city matches", async () => {
    renderPicker({ query: "Zzz" })
    await userEvent.click(screen.getByRole("combobox"))
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })
})

describe("ExactDatePicker", () => {
  it("asks for a date when none is chosen", () => {
    render(<ExactDatePicker id="exact" value={undefined} onChange={() => {}} invalid={false} />)
    expect(screen.getByRole("button", { name: t("about.chooseDate") })).toHaveClass("text-muted")
  })

  it("shows the chosen date in the wireframe format", () => {
    render(<ExactDatePicker id="exact" value={new Date(2027, 6, 18)} onChange={() => {}} invalid />)
    const trigger = screen.getByRole("button", { name: "18 July 2027" })
    expect(trigger).toHaveClass("border-accent")
    expect(trigger).not.toHaveClass("text-muted")
  })

  it("opens the calendar and reports the picked day", async () => {
    const onChange = vi.fn()
    render(<ExactDatePicker id="exact" value={new Date(2027, 6, 18)} onChange={onChange} invalid={false} />)
    await userEvent.click(screen.getByRole("button", { name: "18 July 2027" }))
    const calendar = await screen.findByRole("grid")
    await userEvent.click(within(calendar).getByRole("gridcell", { name: "20" }).querySelector("button") ?? within(calendar).getByRole("button", { name: /20/ }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toBeInstanceOf(Date)
  })
})

describe("formatMonth", () => {
  it("turns YYYY-MM into the month name and year", () => {
    expect(formatMonth("2027-07")).toBe(`${t("months.7")} 2027`)
  })
})

describe("MonthPicker", () => {
  it("asks for a month when none is chosen", () => {
    render(<MonthPicker id="month" value="" onChange={() => {}} invalid={false} />)
    expect(screen.getByRole("button", { name: t("about.chooseMonth") })).toHaveClass("text-muted")
  })

  it("opens on the chosen year and moves between years", async () => {
    render(<MonthPicker id="month" value="2027-07" onChange={() => {}} invalid={false} />)
    await userEvent.click(screen.getByRole("button", { name: `${t("months.7")} 2027` }))
    expect(screen.getByText("2027")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("about.nextYear") }))
    expect(screen.getByText("2028")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: t("about.previousYear") }))
    await userEvent.click(screen.getByRole("button", { name: t("about.previousYear") }))
    expect(screen.getByText("2026")).toBeInTheDocument()
  })

  it("opens on the current year when no month is chosen yet", async () => {
    render(<MonthPicker id="month" value="" onChange={() => {}} invalid={false} />)
    await userEvent.click(screen.getByRole("button", { name: t("about.chooseMonth") }))
    expect(screen.getByText(String(new Date().getFullYear()))).toBeInTheDocument()
  })

  it("reports the picked month as YYYY-MM and closes", async () => {
    const onChange = vi.fn()
    render(<MonthPicker id="month" value="" onChange={onChange} invalid={false} />)
    await userEvent.click(screen.getByRole("button", { name: t("about.chooseMonth") }))
    await userEvent.click(screen.getByRole("button", { name: t("monthsShort.7") }))
    expect(onChange).toHaveBeenCalledWith(`${new Date().getFullYear()}-07`)
  })

  it("closes without choosing and reopens on the chosen year", async () => {
    const onChange = vi.fn()
    render(<MonthPicker id="month" value="2027-07" onChange={onChange} invalid={false} />)
    await userEvent.click(screen.getByRole("button", { name: `${t("months.7")} 2027` }))
    await userEvent.click(screen.getByRole("button", { name: t("about.nextYear") }))
    await userEvent.keyboard("{Escape}")
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: `${t("months.7")} 2027` }))
    expect(screen.getByText("2027")).toBeInTheDocument()
  })

  it("shows the invalid border on a chosen month that the form rejects", () => {
    render(<MonthPicker id="month" value="2026-01" onChange={() => {}} invalid />)
    expect(screen.getByRole("button", { name: `${t("months.1")} 2026` })).toHaveClass("border-accent")
  })

  it("marks the chosen month as pressed", async () => {
    render(<MonthPicker id="month" value="2027-07" onChange={() => {}} invalid={false} />)
    await userEvent.click(screen.getByRole("button", { name: `${t("months.7")} 2027` }))
    expect(screen.getByRole("button", { name: t("monthsShort.7") })).toHaveAttribute("aria-pressed", "true")
  })
})
