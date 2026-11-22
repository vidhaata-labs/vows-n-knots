# Couple Flows: Vows n Knots Frontend

- **Date:** 2026-11-21
- **Status:** Decided in conversation. Awaiting approval before the React project is scaffolded.
- **Persona:** a couple planning their own wedding.
- **Builds on:** [2026-11-21-design-system-design.md](2026-11-21-design-system-design.md) and the backend merged in PR #2.

## Principles

- Plain language for the couple. No planner jargon.
- Nothing hidden. Missing data and waits are said plainly.
- No storage layer. A plan lives in the browser session only.
- No new backend work for layout. Rich presentation is done in the frontend.

## Flows

### 1. Welcome
- One sentence and a "Plan our wedding" button.
- The three-minute wait is stated here, so it's no surprise later.

### 2. About you
- Names (used as the plan's title), state, city, date, guest count, currency.
- **Location:** a state picker, then a searchable city list for that state. Only Census cities can be chosen.
- **Date:** a toggle between "Exact date" and "Month only."
  - Exact date must be later than today.
  - Month only must be the current month or later.
- **Guests:** 10 to 1,000.
- **Currency:** kept on this screen, USD by default.
- **Errors:** shown next to each field before the couple moves on.

### 3. Budget and priorities
- **Budget:** a range slider from $5,000 to $250,000. The midpoint per guest is shown under it.
- **Priorities:** any number of the eight options.
- **Warning:** when more than three are selected, a notice explains that the extra research adds time to the build.

### 4. Your wedding
- **Styles:** chips for the ten styles. Several may be chosen.
- **Dietary needs:** chips for vegetarian, vegan, gluten-free, halal, kosher, or other.
- **Venue setting:** indoor, outdoor, or indoor-outdoor.
- **Maximum travel time:** 30, 45, 60, or 90 minutes.
- **Free text:** traditions and family details, and anything to avoid.
- **Tone:** not shown. The plan uses a warm, practical tone by default.

### 5. Review
- One card per section, each with an "Edit" link back to that step.
- The latency notice appears here too, if more than three priorities are selected.
- One button: "Build our plan."

### 6. Building
- Progress is shown in plain steps, such as "Finding venues" and "Writing your plan." Search queries are never shown.
- **Count:** the number of searches finished out of the total.
- **Failures:**
  - A section with no current figures reads "We couldn't find current figures for this section."
  - If the plan can't be written, the couple sees a message and a "Try again" button.
- **Leaving the page:** the build stops and nothing is kept. The couple is told this before the build starts.

### 7. Your plan
- **Layout (frontend only):**
  - A hero with the couple's names, date, guest count, and budget midpoint.
  - A summary strip with four icon tiles: budget midpoint, venues, estimated total, days to the wedding.
  - Plan sections as cards with icons, with the model's text turned into tables and lists in the frontend.
  - Sources and retrieval dates under each price.
  - Sections without data appear as muted cards that say what's missing.
- **Actions:** download, copy, and start again.
- **Storage:** the plan lives in the browser session only. Closing the tab loses it.

## Backend impacts

1. **Month-only date:** the brief accepts a month as well as a full date. Season and year are derived as they are now.
2. **Structured dietary and venue needs:** the brief takes the chips directly, replacing the keyword matching used now.
3. **Tone:** the synthesis prompt uses a warm, practical tone by default.
4. **Progress detail:** the progress events currently carry the search query and status. Grouping steps by category would need the section name in the events. Open.

Frontend-only items: the three-priority warning, the plan layout, and session storage.

## Open items

1. **Progress grouping:** show a single count and stage (searching, then writing), using the events we have now, or add the section name to the events so the build can show category tiles?
2. **Approval:** approve these flows and the React setup in the design-system doc, so the project can be scaffolded.

## Left to the builder

Component layout inside the flows, copy wording, the exact state of each chip, and how the model's text is split into sections for display.
