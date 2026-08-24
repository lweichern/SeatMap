# The E-Invite Experience (V1) — /invite

**Date:** 2026-08-25 · **Status:** Draft for approval
**Design target: mobile-first.** Every decision assumes a phone inside the
WhatsApp/WeChat in-app browser held by guests aged 8 to 80. Desktop just
gets a centered column.

## Problem

The current e-invite is a poster PNG plus a bare form. Couples in this
market expect a "digital wedding card" — an opening moment, motion, story —
and pay RM200–500 for standalone ones. SeatMap already holds every
ingredient (names, date, venue, 3D hall, menu, RSVP), so the experience is
choreography, not new data.

## Decisions made during design

- **One new route `/invite/[token]`** using the existing `rsvp` token slot —
  the link couples already share simply gets a richer page. `/rsvp` keeps
  working unchanged (old printed posters stay valid). Planner "Copy invite
  link" and the invite poster QR start pointing at `/invite`.
- **Personal greeting, two ways:** a personal *guest* token in the same URL
  slot (`/invite/<guest-token>` — resolved via `resolveGuest`, greets by
  name, prefills the RSVP form) or `?to=Name` on the shared link. Neither →
  generic greeting.
- **Motion doctrine:** scroll-*triggered* reveals everywhere (native scroll,
  IntersectionObserver + CSS); exactly **one** pinned moment (the ballroom
  orbit, CSS `position: sticky` — never scroll-jacking); the envelope is
  tap-driven, not scroll-driven. `prefers-reduced-motion` collapses all of
  it to instant-show.
- **No animation libraries.** CSS transforms/transitions, IO, sticky, and
  the existing three.js scene. Added JS budget ≲ 30 KB.
- **No music in V1** (licensing/autoplay pain). V2 with the couple editor.
- **Architecture leaves room for a future scroll-story variant:** every
  beat is a self-contained component in `src/components/invite/`; the page
  is just a composition. A later `/invite` story-mode can recompose the
  same beats with different choreography without rewrites.

## The beats (top to bottom)

### 1. Envelope — `InviteEnvelope`
- Full-screen (`100svh`, safe-area padded) ivory envelope, gold wax seal
  with the couple's initials monogram (derived from `couple_names`), caption
  "Tap to open".
- Tap → CSS 3D flap lift + card slide-up (~1.1 s), then the envelope layer
  fades away and the hero is revealed; page becomes scrollable only after
  opening (no accidental skip).
- `sessionStorage['invite.opened.<eventId>']` so back-navigation doesn't
  re-seal it. Reduced-motion or JS-failure: page renders open.

### 2. Hero — `InviteHero`
- Eyebrow "Together with their families", names in Cormorant italic,
  **self-drawing flourish** (SVG `stroke-dashoffset` animation), formatted
  date line, then the greeting: "Dear **{name}**, we would be honoured…".
- Gold-dust particle canvas behind (single `fixed` canvas, ~18 particles,
  paused on `visibilitychange`, absent under reduced-motion).

### 3. Countdown — `InviteCountdown`
- Live "18 days · 4 hours · 12 minutes" toward `event_date` (midnight,
  local). Past-date state: "Today we celebrate 🎉" (or hidden if > 1 day
  past). Ticks once a minute — no per-second churn.

### 4. Details — `InviteDetails`
- Date card: **Add to calendar** — primary action opens the Google Calendar
  template URL (works inside in-app browsers where `.ics` downloads often
  fail); secondary "Apple / .ics" link downloads the file (helper extracted
  from the guest page into `src/lib/calendar.ts`).
- Venue card: venue name + address, two big buttons — **Waze**
  (`https://waze.com/ul?q=<addr>&navigate=yes`) and **Google Maps**
  (`https://www.google.com/maps/search/?api=1&query=<addr>`). 44 px+ targets.

### 5. Step inside the ballroom — `InviteBallroom` (the one pinned moment)
- A ~240svh container; inside it a `sticky top-0` full-viewport frame with
  the gold-framed 3D card (~60svh). Scroll progress through the container
  maps to camera azimuth: scrolling slowly orbits the hall once (~170°).
- Mobile-safe rendering: `dynamic()` import mounted only when the section
  approaches (IO rootMargin), `dpr` capped at 1.5, `frameloop="demand"`
  with `invalidate()` from a passive scroll listener — near-zero battery
  cost when idle. No WebGL → static `Hall2D` snapshot instead. No route
  highlight (no table yet) — just the dressed hall with stage + tables.
- Caption: "Scroll to look around the ballroom".

### 6. Menu tease — `InviteMenu` (only when `event.menu.length > 0`)
- "This evening's menu" in the roman-numeral stationery style; course names
  + first course photo. A tease, not the full list — ends with "…and more
  on the night".

### 7. RSVP finale — `InviteRsvp`
- The existing form logic verbatim (name/phone/seats/side + dietary
  steppers, `mergeRsvp`, localStorage self-id cookie) restyled into the
  flow; prefilled when a personal guest token was used.
- On accept: **gold confetti burst** (self-written ~40-line canvas helper,
  fires once) + "You're on the guest list!" + "Keep this link — on the
  wedding day it becomes your seat finder."
- Decline path stays graceful (current copy).

### 8. Footer — small SEATMAP wordmark, nothing else.

## Motion & reveal system

- `useReveal()` hook: one IntersectionObserver; observed elements get
  `.gv-io` (start: opacity 0 / translateY 18px) → `.gv-io-in` on ≥20%
  visibility, once. CSS lives in the guest layout `<style>` next to the
  existing `gv-*` classes.
- All animations honor `@media (prefers-reduced-motion: reduce)`.

## Wiring changes

- Guests page invite menu: "Copy invite link" copies `/invite/<rsvp-token>`;
  invite poster QR encodes the same; menu hints updated. `/rsvp/<token>`
  untouched.

## Testing

- Unit (vitest): countdown math (future/today/past), calendar + maps URL
  builders (encoding), greeting resolution (guest token vs `?to=` vs none),
  monogram derivation ("Adam & Eve" → "A·E", CJK names → first chars).
- E2E (Playwright, demo event, phone viewport, state restored): envelope
  tap opens → hero reveals → scroll mounts ballroom canvas (no pageerror)
  → menu tease visible → RSVP with dietary → confetti + done state; personal
  guest-token URL greets by name and prefills; `?to=` greets; reduced-motion
  context renders everything instantly (envelope open).

## Out of scope (V1)

Music; couple photos / story / schedule (V2: `invite` jsonb + planner
editor); wishes wall; per-guest WhatsApp blast tooling; the desktop
scroll-story variant (future recomposition of these same components).
