import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { t } from "@/i18n"
import { AppAlert } from "@/components/app/app-alert"
import { AppCard } from "@/components/app/app-card"
import { AppFooter } from "@/components/app/app-footer"
import { AppHeader } from "@/components/app/app-header"
import { AppShell } from "@/components/app/app-shell"
import { CHIP_GROUP_CLASS, CHIP_ITEM_CLASS } from "@/components/app/chip"
import { CONTROL, CONTROL_INVALID, Field } from "@/components/app/field"
import { SectionIcon } from "@/components/app/section-icon"
import type { IconKey } from "@/lib/plan-view"

describe("AppHeader", () => {
  it("shows the brand, the version and the vendor credit", () => {
    render(<AppHeader />)
    expect(screen.getByText(t("app.brand"))).toBeInTheDocument()
    expect(screen.getByText(t("app.version"))).toBeInTheDocument()
    expect(screen.getByText(t("app.vendor"))).toBeInTheDocument()
    expect(screen.getByRole("banner")).toBeInTheDocument()
  })
})

describe("AppFooter", () => {
  it("shows the estimates disclaimer", () => {
    render(<AppFooter />)
    expect(screen.getByText(t("app.disclaimer"))).toBeInTheDocument()
  })
})

describe("AppShell", () => {
  it("wraps the page between the header and the footer", () => {
    render(
      <AppShell>
        <p>page body</p>
      </AppShell>
    )
    expect(screen.getByText("page body")).toBeInTheDocument()
    expect(screen.getByText(t("app.brand"))).toBeInTheDocument()
    expect(screen.getByText(t("app.disclaimer"))).toBeInTheDocument()
  })
})

describe("AppCard and AppAlert", () => {
  it("shows a card's title and detail", () => {
    render(<AppCard title="Amira & Noah" text="Chicago, Illinois" />)
    expect(screen.getByRole("heading", { name: "Amira & Noah" })).toBeInTheDocument()
    expect(screen.getByText("Chicago, Illinois")).toBeInTheDocument()
  })

  it("announces an alert to assistive technology", () => {
    render(<AppAlert>Plan copied.</AppAlert>)
    expect(screen.getByRole("alert")).toHaveTextContent("Plan copied.")
  })
})

describe("Field", () => {
  it("labels its control and shows the error as an alert", () => {
    render(
      <Field label="Couple names" htmlFor="names" error="Add your names." className="extra">
        <input id="names" />
      </Field>
    )
    expect(screen.getByLabelText("Couple names")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Add your names.")
  })

  it("shows no alert when there is no error", () => {
    render(
      <Field label="State">
        <select aria-label="state-control" />
      </Field>
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("exports the shared control classes", () => {
    expect(CONTROL).toContain("rounded-md")
    expect(CONTROL_INVALID).toContain("border-accent")
  })
})

describe("chip classes", () => {
  it("marks a chosen chip with the accent fill", () => {
    expect(CHIP_ITEM_CLASS).toContain("data-[state=on]:bg-accent")
    expect(CHIP_GROUP_CLASS).toContain("flex-wrap")
  })
})

describe("SectionIcon", () => {
  it.each<IconKey>(["map-pin", "coins", "calendar", "car", "utensils", "camera", "music", "file"])(
    "draws the %s icon",
    (icon) => {
      const { container } = render(<SectionIcon icon={icon} />)
      expect(container.querySelector("svg")).not.toBeNull()
    }
  )

  it("uses the given class, or the default accent icon size", () => {
    const { container, rerender } = render(<SectionIcon icon="map-pin" className="size-9" />)
    expect(container.querySelector("svg")).toHaveClass("size-9")
    rerender(<SectionIcon icon="map-pin" />)
    expect(container.querySelector("svg")).toHaveClass("size-5")
  })
})
