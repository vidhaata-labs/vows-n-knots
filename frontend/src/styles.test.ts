/// <reference types="node" />
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

// The stylesheet is read as text, since jsdom does not apply it. Vitest runs from the frontend folder.
// These checks keep the pointer rules in place.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8")

describe("pointer cursors", () => {
  it("shows a pointer on buttons, tabs, options and the other clickable roles", () => {
    expect(css).toMatch(/button:not\(:disabled\)[\s\S]*?cursor:\s*pointer/)
    for (const role of ["tab", "radio", "option", "slider"]) {
      expect(css).toContain(`[role="${role}"]`)
    }
    expect(css).toMatch(/a\[href\][\s\S]*?cursor:\s*pointer/)
  })

  it("shows the translucent scrollbar on hover and just after a scroll, and keeps it clear at rest", () => {
    expect(css).toMatch(/\.scroll-translucent:hover,\s*\.scroll-translucent\[data-scrolling\]\s*\{[^}]*scrollbar-color/)
    expect(css).toMatch(/\.scroll-translucent::-webkit-scrollbar-thumb\s*\{\s*background:\s*transparent/)
  })

  it("shows a not-allowed pointer on disabled controls", () => {
    expect(css).toMatch(/button:disabled[\s\S]*?cursor:\s*not-allowed/)
  })

  it("leaves the text cursor on the city search field", () => {
    expect(css).toContain('[role="combobox"]:not(input)')
  })
})
