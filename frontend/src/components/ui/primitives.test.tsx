import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Toggle, toggleVariants } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

describe("Input, Textarea and Label", () => {
  it("passes props through to the input", () => {
    render(<Input aria-label="guests" type="number" defaultValue="120" className="extra" />)
    const input = screen.getByLabelText("guests")
    expect(input).toHaveAttribute("type", "number")
    expect(input).toHaveValue(120)
    expect(input).toHaveClass("extra")
    expect(input).toHaveAttribute("data-slot", "input")
  })

  it("passes props through to the textarea", () => {
    render(<Textarea aria-label="traditions" placeholder="Traditions" className="extra" />)
    expect(screen.getByLabelText("traditions")).toHaveAttribute("placeholder", "Traditions")
    expect(screen.getByLabelText("traditions")).toHaveClass("extra")
  })

  it("renders a label linked to its control", () => {
    render(
      <>
        <Label htmlFor="city">City</Label>
        <input id="city" />
      </>
    )
    expect(screen.getByLabelText("City")).toBeInTheDocument()
  })
})

describe("Popover", () => {
  it("opens its content from the trigger", async () => {
    render(
      <Popover>
        <PopoverAnchor />
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent align="end" sideOffset={2} className="extra">
          <PopoverHeader>
            <PopoverTitle>Title</PopoverTitle>
            <PopoverDescription>Description</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    )
    expect(screen.queryByText("Description")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(await screen.findByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Title")).toBeInTheDocument()
  })
})

describe("Toggle and ToggleGroup", () => {
  it("reports a change to a single toggle", async () => {
    const onPressedChange = vi.fn()
    render(<Toggle aria-label="Bold" onPressedChange={onPressedChange} variant="outline" size="lg" />)
    await userEvent.click(screen.getByRole("button", { name: "Bold" }))
    expect(onPressedChange).toHaveBeenCalledWith(true)
  })

  it("returns class names for each variant and size", () => {
    expect(toggleVariants({ variant: "outline", size: "sm" })).toContain("border-input")
    expect(toggleVariants({ variant: "default", size: "lg" })).toContain("h-10")
  })

  it("chooses one item in a single group and passes the group's spacing to its items", async () => {
    const onValueChange = vi.fn()
    render(
      <ToggleGroup type="single" spacing={0} variant="outline" size="sm" onValueChange={onValueChange} aria-label="Venue">
        <ToggleGroupItem value="Indoor">Indoor</ToggleGroupItem>
        <ToggleGroupItem value="Outdoor">Outdoor</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(document.querySelector('[data-slot="toggle-group"]')).toHaveAttribute("data-spacing", "0")
    await userEvent.click(screen.getByRole("radio", { name: "Outdoor" }))
    expect(onValueChange).toHaveBeenCalledWith("Outdoor")
  })

  it("lays out a vertical group", () => {
    render(
      <ToggleGroup type="multiple" orientation="vertical" aria-label="Styles">
        <ToggleGroupItem value="Modern">Modern</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(document.querySelector('[data-slot="toggle-group"]')).toHaveAttribute("data-orientation", "vertical")
  })
})

describe("Slider", () => {
  it("draws one thumb per value and reports keyboard changes", () => {
    const onValueChange = vi.fn()
    render(<Slider min={5000} max={250000} step={5000} value={[35000, 65000]} onValueChange={onValueChange} aria-label="Budget" />)
    const thumbs = screen.getAllByRole("slider")
    expect(thumbs).toHaveLength(2)
    fireEvent.keyDown(thumbs[0], { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledWith([40000, 65000])
  })

  it("draws a single thumb when only a default value is given", () => {
    render(<Slider defaultValue={[10]} min={0} max={100} aria-label="Level" />)
    expect(screen.getAllByRole("slider")).toHaveLength(1)
  })

  it("falls back to the range when no value is given", () => {
    render(<Slider min={0} max={100} aria-label="Range" />)
    expect(screen.getAllByRole("slider").length).toBeGreaterThan(0)
  })
})

describe("Select", () => {
  it("chooses an item from the list", async () => {
    const onValueChange = vi.fn()
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="State">
          <SelectValue placeholder="Choose a state" />
        </SelectTrigger>
        <SelectContent>
          <SelectScrollUpButton />
          <SelectGroup>
            <SelectLabel>States</SelectLabel>
            <SelectItem value="IL">Illinois</SelectItem>
            <SelectSeparator />
            <SelectItem value="NY">New York</SelectItem>
          </SelectGroup>
          <SelectScrollDownButton />
        </SelectContent>
      </Select>
    )
    const trigger = screen.getByRole("combobox", { name: "State" })
    expect(trigger).toHaveTextContent("Choose a state")
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("option", { name: "Illinois" }))
    expect(onValueChange).toHaveBeenCalledWith("IL")
  })

  it("shows the chosen item's label on the trigger", () => {
    render(
      <Select defaultValue="IL" open={false}>
        <SelectTrigger aria-label="State size">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="IL">Illinois</SelectItem>
        </SelectContent>
      </Select>
    )
    expect(screen.getByRole("combobox", { name: "State size" })).toHaveTextContent("Illinois")
  })

  it("sizes the small trigger", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Small" size="sm">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    )
    expect(screen.getByRole("combobox", { name: "Small" })).toHaveAttribute("data-size", "sm")
  })
})

describe("Calendar", () => {
  it("reports the day that is clicked", async () => {
    const onSelect = vi.fn()
    render(<Calendar mode="single" defaultMonth={new Date(2027, 6, 1)} onSelect={onSelect} />)
    const grid = screen.getByRole("grid")
    await userEvent.click(within(grid).getByRole("button", { name: /July 18/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toEqual(new Date(2027, 6, 18))
  })

  it("moves to the next month with the arrow button", async () => {
    render(<Calendar mode="single" defaultMonth={new Date(2027, 6, 1)} />)
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByText(/August 2027/)).toBeInTheDocument()
  })

  it("renders a day button on its own", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2027, 6, 1)} components={{ DayButton: CalendarDayButton }} />)
    expect(screen.getByRole("grid")).toBeInTheDocument()
  })
})
