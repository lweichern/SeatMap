# Dietary Capture → Kitchen Sheets

**Date:** 2026-07-18 · **Status:** Approved

## Problem

Every banquet requires the planner to tell the caterer how many special plates
go to which table. Today that data lives in ad-hoc spreadsheets assembled by
phone calls. SeatMap already knows every guest, their party size, and their
table — capturing dietary needs at RSVP time and rolling them up per table
removes the entire manual step.

## Decisions made during design

- **Granularity: seat counts per party.** An RSVP for a party of 4 records
  e.g. `2 vegetarian, 1 halal` — not one tag for the whole party, not named
  sub-guests. Exact plate counts with a short form.
- **Fixed category set for v1:** vegetarian, halal, no beef, child meal, plus
  one free-text allergy note per party. No custom category editing.
- **Export = print-CSS page**, not jsPDF (browser print renders CJK names
  natively; jsPDF cannot — known from the QR-sheet work).

## Data model

`Guest` gains one optional field:

```ts
dietary?: {
  veg?: number      // vegetarian plates
  halal?: number
  no_beef?: number
  child?: number    // child meal
  allergy?: string  // free text, per party
}
```

- Counts are independent of each other; each is capped at `party_size`.
  (A vegetarian guest may also be the halal guest — categories are separate
  requests to the kitchen, not a partition of the party.)
- If `party_size` later shrinks below a count, the UI clamps the displayed
  count and flags the row; stored data is not silently mutated.
- Storage: `guests.dietary jsonb` in Supabase via
  `supabase/migrations/0003_dietary.sql` (single `ALTER TABLE guests ADD
  COLUMN IF NOT EXISTS dietary jsonb`) — also appended to `supabase/setup.sql`
  so fresh installs get it. The localStorage/server-store repo needs no
  migration (schemaless JSON).

## Components

### 1. RSVP form (`/rsvp/[token]`)

- After the party-size picker: a collapsed disclosure, "Any dietary needs?".
- Expanded: one stepper row (− count +) per category, each clamped to
  0…party_size, plus one allergy text input.
- Collapsed by default; a party with no needs never sees the steppers.
- Submitting stores `dietary` on the created/updated guest (omitted when all
  counts are 0 and allergy is empty).

### 2. Guest list (`/events/[eventId]/guests`)

- Each row with dietary data shows compact chips: `🌱2 · ☪1 · 🚫🥩1 · 🧒1`
  and an allergy dot whose title shows the note.
- Clicking the chips (or an "add dietary" affordance on rows without data)
  opens a popover with the same steppers + allergy field, so planners can
  record phone RSVPs and manually added guests.
- Saved through the existing `updateGuest` repo call — no new repo methods.

### 3. Kitchen sheet (`/events/[eventId]/kitchen`)

- Header: event name, date, grand totals line — total pax, plates per
  category, count of allergy notes. This is the caterer's banquet order.
- Body: one row per table, ordered by label — seated pax, per-category plate
  counts, allergy notes with guest names. Tables with no special needs still
  appear (kitchen wants full coverage); zero counts render as "—".
- Footer section: unassigned guests with dietary needs, so nothing is lost
  before allocation is final.
- A "Print / save as PDF" button calling `window.print()`; print CSS hides
  the app chrome and paginates cleanly. Linked from the event dashboard.

## Aggregation logic

Pure function in `src/lib/kitchen.ts`:
`buildKitchenSheet(tables, guests) → { totals, rows[], unassigned }` where
each row = `{ tableId, label, pax, counts, allergies: [{ guestName, note }] }`.
Pax = sum of `party_size` of guests assigned to the table. Unit-testable with
no DOM.

## Error handling & edge cases

- Counts > party_size (party shrank): clamp in every display + flag the
  guest row; kitchen sheet uses clamped values.
- Guests without RSVP/dietary: counted in pax, contribute zero plates.
- Demo event: seed 2–3 demo guests with dietary data so the kitchen sheet
  demos instantly.

## Out of scope (v1)

Per-seat named meals, greeter-app visibility of dietary data, custom
category sets, caterer-facing share link.

## Testing

- Unit (vitest): `buildKitchenSheet` rollup, clamping, unassigned bucket,
  omit-empty `dietary` normalization.
- E2E (Playwright, demo event, restored afterwards): RSVP with dietary
  counts → chips visible on guest list → kitchen sheet shows correct
  totals/row; planner popover edit round-trips.
