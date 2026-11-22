import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { CategoryTile } from "@/components/app/category-tile"
import { Segmented } from "@/components/app/segmented"

describe("Segmented", () => {
  const options: [{ value: "exact"; label: string }, { value: "month"; label: string }] = [
    { value: "exact", label: "Exact date" },
    { value: "month", label: "Month only" },
  ]

  it("reports a newly chosen option", async () => {
    const onChange = vi.fn()
    render(<Segmented value="exact" onChange={onChange} options={options} ariaLabel="Wedding date type" />)
    await userEvent.click(screen.getByRole("radio", { name: "Month only" }))
    expect(onChange).toHaveBeenCalledWith("month")
  })

  it("keeps the current choice when the chosen option is clicked again", async () => {
    const onChange = vi.fn()
    render(<Segmented value="exact" onChange={onChange} options={options} ariaLabel="Wedding date type" />)
    await userEvent.click(screen.getByRole("radio", { name: "Exact date" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("marks the current choice as on", () => {
    render(<Segmented value="month" onChange={() => {}} options={options} ariaLabel="Wedding date type" />)
    expect(screen.getByRole("radio", { name: "Month only" })).toHaveAttribute("data-state", "on")
    expect(screen.getByRole("radio", { name: "Exact date" })).toHaveAttribute("data-state", "off")
  })
})

describe("CategoryTile", () => {
  it("shows the name and the progress line", () => {
    render(<CategoryTile name="Venues" icon="map-pin" text="3 of 5 checked" searching={false} noFigures={false} />)
    expect(screen.getByText("Venues")).toBeInTheDocument()
    expect(screen.getByText("3 of 5 checked")).toBeInTheDocument()
  })

  it("gets a coral border while searching", () => {
    const { container } = render(
      <CategoryTile name="Caterers" icon="utensils" text="Searching" searching noFigures={false} />
    )
    expect(container.firstChild).toHaveClass("border-accent")
  })

  it("gets a dashed border when there are no figures", () => {
    const { container } = render(
      <CategoryTile name="Music" icon="music" text="No current figures" searching={false} noFigures />
    )
    expect(container.firstChild).toHaveClass("border-dashed")
  })

  it("falls back to a coin icon for an unknown icon name", () => {
    const { container } = render(
      <CategoryTile name="Budget" icon="not-an-icon" text="Waiting" searching={false} noFigures={false} />
    )
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it.each(["map-pin", "utensils", "camera", "music", "car", "coins"])("draws the %s icon", (icon) => {
    const { container } = render(
      <CategoryTile name="Name" icon={icon} text="Waiting" searching={false} noFigures={false} />
    )
    expect(container.querySelector("svg")).not.toBeNull()
  })
})
