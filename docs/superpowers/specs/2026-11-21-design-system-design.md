# Design System: Vows n Knots Frontend

- **Date:** 2026-11-21
- **Status:** Draft for approval. Nothing is installed or scaffolded until approved.
- **Canvas:** Vows n Knots (Doop), id `rhwwfz0k7H`
- **Builds on:** the backend merged in PR #2, and the Frontend UX brainstorm (persona: a couple planning their own wedding)

## Intent

A design system that gives the React (Vite) frontend one visual language for the couple's flow: about you, budget and priorities, your wedding, review, the three-minute build, and the finished plan. The look comes from the approved theme, a blush-and-gold wedding invitation style.

## Goals

- One set of tokens for colour, type, spacing and radii, shared by the Doop canvas and the React app.
- A component set that covers the couple's flow, drawn in Doop first, then built in React.
- shadcn/ui as the component base, restyled with our tokens, so the React code stays close to the design.

## Non-goals

- Dark mode. Not part of the theme.
- Components for screens that aren't in the couple's flow.
- Any framework beyond React, Vite, Tailwind CSS and shadcn/ui.

## Anti-goals

- A generic-looking app. If the blush and gold disappear, the design has failed.
- Low contrast. Text and graphics must read on their backgrounds.

## Tokens (canvas, done)

Theme history: the first theme was blush and gold, with Cormorant Garamond and Instrument Sans. It was replaced on 2026-11-21 with white and coral, with Poppins, following the One Page Love reference [Pairio](https://onepagelove.com/pairio). The tokens below are the current theme.

| Role | Token | Value |
|---|---|---|
| Page background | `--color-ground` | #FFFFFF |
| Cards and forms | `--color-surface` | #F6F6F4 |
| Text | `--color-ink` | #111111 |
| Secondary text | `--color-muted` | #6B6B6B |
| Accent | `--color-accent` | #D91E45 (coral red, about 5:1 with white text) |
| Display font | `--font-display` | Poppins |
| Body font | `--font-body` | Poppins |
| Text sizes | `--text-label` 13px, `--text-body` 16px, `--text-h2` 28px, `--text-display` 40px | |
| Spacing | `--spacing-1` 4px, `-2` 8px, `-4` 16px, `-6` 24px, `-8` 32px | |
| Radii | `--radius-md` 8px, `--radius-lg` 16px | |

## Mapping to shadcn/ui

shadcn/ui reads its colours from CSS variables. Our tokens map onto them:

| shadcn variable | Our token |
|---|---|
| `--background` | `--color-ground` |
| `--card` | `--color-surface` |
| `--foreground` | `--color-ink` |
| `--muted-foreground` | `--color-muted` |
| `--primary` | `--color-accent` |

## Components (canvas, done)

Nine components are on the Components page of the canvas. Each has a code path, which is where the React version lives.

| Component | Canvas id | React path |
|---|---|---|
| Button (primary, ghost) | `coqvdzrnjd` | `src/components/ui/button.tsx` (shadcn) |
| Input | `c6po7cz7n7` | `src/components/ui/input.tsx` (shadcn) |
| Tag | `c9c5p57ymr` | `src/components/ui/badge.tsx` (shadcn) |
| Chip | `cjlwisuuju` | `src/components/ui/toggle-group.tsx` (shadcn) |
| Card | `cd1kz6xktd` | `src/components/ui/card.tsx` (shadcn) |
| Alert | `cmb7nmwv2f` | `src/components/ui/alert.tsx` (shadcn) |
| ProgressStep (waiting, running, done) | `cp299qv48y` | `src/components/app/progress-step.tsx` (custom) |
| Stepper | `c4n9dkwp3y` | `src/components/app/stepper.tsx` (custom) |
| Header | `ctibz8gyaa` | `src/components/app/app-header.tsx` (custom) |

Checked on the canvas: Button, Chip (unchecked) and Stepper render as intended.

## Fonts on the canvas (fixed)

The canvas had no web fonts registered, so the previews showed a fallback sans-serif. Each of the nine components now imports Cormorant Garamond and Instrument Sans from Google Fonts at the top of its stylesheet (canvas revision 2). The Button and Header previews were checked and render in the right fonts. The React app loads the same fonts in `index.html`.

## Planned React setup (needs approval)

- Vite with React and TypeScript.
- Tailwind CSS v4 through its Vite plugin.
- shadcn/ui initialised with CSS variables. The variables are set to the mapping above.
- Forms: React Hook Form with Zod.
- Fonts loaded from Google Fonts in `index.html`.
- Tokens kept as CSS custom properties in one file, so the canvas and the code use the same names.

## Open items for the author

1. Approve this design, and the React setup above.
2. Should I fix the canvas fonts now (add a Google Fonts link to each component), or leave the previews as they are?

## Left to the builder

File layout inside `src/`, the exact shadcn component versions, and the form schemas for the couple's flow.
