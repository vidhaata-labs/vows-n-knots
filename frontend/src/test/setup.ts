import "@testing-library/jest-dom/vitest"
import "@/i18n"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Vitest runs without globals here, so React Testing Library does not clean up on its own.
// Unmount everything after each test so one test's screen never leaks into the next.
afterEach(() => {
  cleanup()
})

// jsdom lacks some browser APIs that Radix UI and react-day-picker call.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
