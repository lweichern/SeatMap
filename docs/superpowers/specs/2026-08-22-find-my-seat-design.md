# Find My Seat — shared entrance QR

**Date:** 2026-08-22 · **Status:** Approved

## Problem

Per-guest QR codes require every guest to keep their personal invite. A
single poster QR at the entrance lets ANY guest self-serve — but a shared
code cannot know who scanned it. This feature identifies the guest with
the least possible friction, then hands off to the existing `/g/[token]`
invitation page for table + 3D wayfinding.

## Decisions made during design

- **Identification stack:** (1) cookie recognition from RSVP, (2) name +
  optional phone last-4 fallback, (3) masked confirm card — never
  auto-commit, (4) multi-candidate picker, (5) "see the greeter" dead-end
  never happens silently.
- **v1 writes NOTHING.** No check-in, no timestamps, no schema change.
  Attendance truth stays at the greeter desk. (A `seen` status can layer
  on with the future attendance dashboard.)
- Poster URL uses a new event-scoped token slot `kiosk` (same HMAC scheme
  as the `rsvp` slot; guest_id = "kiosk").
- On confirm, the page signs the guest's personal token client-side
  (`signToken(eventId, guestId, event.guest_token_secret)` — the same
  pattern the planner UI uses) and navigates to `/g/<token>`.

## Components

### 1. Matching logic — `src/lib/selfid.ts` (pure, unit-tested)

- `normalizeName(s)`: lowercase, trim, strip spaces/punctuation/diacritics.
- `matchGuests(guests, name, last4?) → Guest[]`:
  - candidates where `normalizeName(g.name)` equals — or contains /
    is contained by — `normalizeName(input)`; empty input matches nothing.
  - if `last4` (≥2 digits) given: filter candidates whose phone digits end
    with it; if that filter empties the list, fall back to name-only
    candidates (a wrong digit must not hide an obvious name match).
  - declined guests (`rsvp === 'no'`) excluded.
- `maskPhone(phone) → '••••1234' | null` for the confirm card.

### 2. Cookie recognition

- RSVP page (`/rsvp/[token]`): after a successful `saveGuest`, store
  `localStorage['seatmap.selfid.<eventId>'] = guest.id`.
- `/find` page: on load, if that key exists AND the guest is still on the
  list (and not declined), short-circuit to the confirm card
  ("Welcome back") — no form.

### 3. `/find/[token]` page — `src/app/(guest)/find/[token]/page.tsx`

- Guest-layout ivory theme (same Shell/Flourish language as /g and /rsvp).
- Verify token: `peekToken` → `getEvent` → `verifyToken`, require
  `guest_id === 'kiosk'`; invalid → themed error state.
- States: `loading → recognized | form → confirm(guest) | pick(guests) |
  none → (navigates away on confirm)`.
- Form: name input (required) + "Last 4 digits of your phone (optional)"
  numeric input. Submit runs `matchGuests`.
  - 1 match → confirm card: name, side (Bride's/Groom's/Friend of both),
    party size, masked phone. Buttons: "Yes, show me my seat" / "Not me".
  - 2-5 matches → stacked mini-cards, tap to confirm.
  - 0 or >5 matches → "We couldn't find you — please see the greeter at
    the entrance desk, they'll sort you out in seconds."
- Confirm → sign personal token → `router.push('/g/<tok>')`.
- A guest without a table yet still confirms through to /g (which shows
  "Please see the greeter for your table").

### 4. Planner poster QR

- Guests page "Invite guests ▾" menu gains "Seat-finder poster QR" —
  downloads a PNG QR of `<shareOrigin>/find/<kiosk token>` (same
  qrcode-toDataURL pattern as the invite QR, filename
  `find-my-seat-<slug>.png`).

## Privacy

- Exact-ish match required; no browsable guest list. Masked phone only.
- The kiosk token grants lookup only — the /find page never lists guests
  beyond matched candidates (≤5).
- Honesty note: the ≤5-candidate limit is a UI-level restriction. Like the
  RSVP page, /find loads the event's guest list into the browser via the
  anon repo — a technical user with the poster URL can read it in devtools.
  A data-level fix (server-side match endpoint, guest-scoped RPCs) is the
  production-hardening work already tracked for v2.

## Testing

- Unit (vitest): normalizeName variants (case/space/punct/diacritics),
  matchGuests (exact, contains, last-4 filter + its fallback, declined
  excluded, empty input), maskPhone.
- E2E (Playwright, demo event, restored afterwards): RSVP on a phone
  context → same context scans /find → recognized instantly; fresh
  context → name+digits form → confirm card → lands on /g with TABLE
  visible; ambiguous name (two demo guests) → picker; nonsense name →
  greeter fallback. Poster QR menu item downloads.

## Out of scope (v1)

Any write from /find (check-in / seen), pinyin alias matching,
per-table QRs, rate limiting.
