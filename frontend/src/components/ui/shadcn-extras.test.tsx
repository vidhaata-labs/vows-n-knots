import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { AlertDialog, AlertDialogContent, AlertDialogMedia, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

describe("AlertDialogMedia", () => {
  it("renders an icon slot inside the dialog", async () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogMedia>
            <span>media icon</span>
          </AlertDialogMedia>
        </AlertDialogContent>
      </AlertDialog>
    )
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(await screen.findByText("media icon")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="alert-dialog-media"]')).not.toBeNull()
  })
})

describe("SelectContent positions", () => {
  it("opens beside the trigger for popper placement", async () => {
    render(
      <Select>
        <SelectTrigger aria-label="Currency">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
    )
    await userEvent.click(screen.getByRole("combobox", { name: "Currency" }))
    expect(await screen.findByRole("option", { name: "USD" })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="select-content"]')).toHaveAttribute("data-align-trigger", "false")
  })
})

describe("Calendar options", () => {
  it("shows week numbers when asked", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2027, 6, 1)} showWeekNumber />)
    expect(document.querySelectorAll("tbody th, tbody td[role='rowheader']").length).toBeGreaterThan(0)
  })

  it("offers month and year dropdowns when the caption layout asks for them", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2027, 6, 1)} captionLayout="dropdown" />)
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0)
  })

  it("hides the days from the neighbouring months when asked", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2027, 6, 1)} showOutsideDays={false} />)
    expect(screen.getByRole("grid")).toBeInTheDocument()
  })
})
