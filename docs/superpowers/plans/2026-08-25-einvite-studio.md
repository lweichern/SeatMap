# E-Invite Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A planner page (`/events/[eventId]/einvite`) with six labeled photo drop-slots + a details form + one **Create e-invite** button that turns the guest `/invite` page into the full photo story (hero photo, names collage, her/him red beat, calendar grid, letter, seconds countdown, RSVP deadline).

**Architecture:** `events.invite` jsonb (`InviteConfig`); photos as `resizeImage(f,1200)` data URLs; studio is one client page; guest sections are additive components in `src/components/invite/` that no-op without config (V1 rendering preserved byte-for-byte for config-less events). Spec: `docs/superpowers/specs/2026-08-25-einvite-studio-design.md` (authority).

**Tech Stack:** Next.js 15 client pages, TypeScript, Tailwind v4 + gv-* theme, next/font (Great Vibes), vitest@3, existing `resizeImage`/`HallScene`/reveal system.

## Global Constraints

- Branch `einvite-studio`; `--no-ff` merge at the end; every commit carries `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Mobile-first guest page (390×844, 100svh, IO reveals, ONE pinned section stays the ballroom, reduced-motion instant-show). Studio page is desktop-friendly planner UI (light slate style like menu editor).
- No new deps (Great Vibes comes via next/font/google, zero runtime JS).
- An event with `invite` null/undefined renders the guest page EXACTLY as V1 (guarded sections).
- `SupabaseVenueRepo.saveEvent` upserts raw events — the `events.invite` column must exist live before the studio saves in Supabase mode (controller gates the e2e on it; migration 0004).
- Gates: `npx tsc --noEmit`, `npx vitest run`; controller-only `NEXT_DIST_DIR=.next-build npm run build`. NEVER bare build; ONE dev server; NEVER `git add -A` (landing/, remotion-promo/, reference/ stay untracked).

---

### Task 1: Types, migration, pure helpers (TDD)

**Files:**
- Modify: `src/lib/types.ts` (add `InviteConfig`; `WeddingEvent.invite?: InviteConfig | null` after `menu`)
- Create: `supabase/migrations/0004_invite.sql`; append mirror to `supabase/setup.sql` (column inside `create table events`, after `menu jsonb...` line, PLUS idempotent alter at end)
- Modify: `src/lib/invite.ts` + `src/lib/invite.test.ts`

**Interfaces (binding):**

```ts
// types.ts
export interface InviteConfig {
  bride_name?: string
  groom_name?: string
  rsvp_deadline?: string // ISO date
  letter?: string[]
  red_accent?: boolean
  photos?: {
    hero?: string; bride?: string; groom?: string
    editorial?: string; candid1?: string; candid2?: string
  }
}

// invite.ts additions
export function splitCouple(coupleNames: string): { bride?: string; groom?: string }
// same connector logic as monogram (& / and / 与): two sides → {bride: left, groom: right} trimmed;
// no connector → {}. Refactor the shared splitting out of monogram (monogram behavior unchanged).

export interface CalendarGrid { monthLabel: string; day: number; weeks: (number | null)[][] }
export function calendarGrid(eventDate: string): CalendarGrid | null
// "2026-10-24" → monthLabel "10 / 24" (month/day of the WEDDING), day 24,
// weeks = Monday-first matrix of that month (nulls pad), invalid → null.

export const DEFAULT_LETTER: string[]
// 6 lines, EN, the reference's arc:
// ["Life is a wonderful journey,","and you are the most beautiful part of ours.",
//  "By the time this invitation reaches you,","our wedding will already be counting down.",
//  "A wedding is one of the few true reunions.","Long time no see — see you at our wedding."]

// countdown() gains seconds on the future state:
export type CountdownState =
  | { state: 'future'; days: number; hours: number; minutes: number; seconds: number }
  | { state: 'today' } | { state: 'past' }
```

- [ ] Branch `git checkout main && git checkout -b einvite-studio`; failing tests first (splitCouple: '&'/'and'/'与'/none; calendarGrid: Oct 2026 → first row starts with 4 nulls? verify: 1 Oct 2026 is a Thursday → Monday-first offset 3 nulls then 1..; day circled = 24; monthLabel '10 / 24'; Feb leap year; invalid; countdown seconds decomposition with fixed now; monogram regression suite still green).
- [ ] Migration files (same shape as 0003).
- [ ] Implement; update the existing InviteCountdown consumer minimally IF tsc requires (destructuring) — display changes belong to Task 2.
- [ ] `npx vitest run` all green; `npx tsc --noEmit`; commit `feat: invite config type, calendar/letter/split helpers, countdown seconds`.

---

### Task 2: Guest theme additions + seconds display

**Files:**
- Modify: `src/app/(guest)/layout.tsx` (Great_Vibes via next/font/google → `--font-script`; `.gv-script { font-family: var(--font-script), cursive; }`; feather masks `.gv-feather-b { -webkit-mask-image:linear-gradient(#000 72%, transparent); mask-image:linear-gradient(#000 72%, transparent) } .gv-feather-y { mask 8%..92% both edges }`)
- Modify: `src/components/invite/InviteCountdown.tsx` (tick every 1s — `setInterval(...,1000)` cleared on unmount AND paused via `visibilitychange` (skip setState when hidden); render a fourth Seconds number; layout stays 4-up on 390px)

- [ ] Verify: tsc + vitest; visual smoke deferred to controller. Commit `feat: script font, feathered masks, live seconds`.

---

### Task 3: The Studio page

**Files:**
- Create: `src/app/(planner)/events/[eventId]/einvite/page.tsx`
- Modify: `src/app/(planner)/events/page.tsx` (⋯ menu gains "E-invite studio" → `/events/<id>/einvite`, before "Kitchen sheet")
- Modify: `src/app/(planner)/events/[eventId]/guests/page.tsx` (invite dropdown gains MenuItem "Design the e-invite" hint "Photos + details → the full experience" navigating there — router already imported? use `Link`-style push consistent with file)

**Behavior (binding):**
- Load event (+venue for read-only display). State = `InviteConfig` initialized from `event.invite ?? {}` with `bride_name/groom_name` prefilled via `splitCouple(event.couple_names)` when absent; `letter` prefilled `DEFAULT_LETTER`; plus `startsAt` state from `event.starts_at` (string 'HH:MM' or '').
- Six slot tiles (grid-cols-2 md:grid-cols-3): each a `<label>` drop-zone (`onDrop` + `<input type=file accept="image/*">`) → `resizeImage(f, 1200)` → preview `<img>` cover + ✕ clear. Tile copy EXACTLY:
  - "Hero — the two of you" / "Portrait · opens the invite"
  - "Bride portrait" / "the 'her' moment"
  - "Groom portrait" / "the 'him' moment"
  - "Editorial favourite" / "the invitation line"
  - "Candid 1" / "the letter" · "Candid 2" / "the letter"
- Form fields: Bride's name, Groom's name (text); Ceremony start time (`<input type=time>`); RSVP deadline (`<input type=date>`); The letter (`<textarea rows=6>` joined/split on newline); checkbox "Bold red her/him section" default `red_accent ?? true`.
- Read-only context line: "24 October 2026 · SLF Ballroom — date & venue come from the event".
- **Create e-invite / Update e-invite** button → `saveEvent({...event, invite: cleaned, starts_at: startsAt ? `${event.event_date}T${startsAt}:00` : event.starts_at})` where `cleaned` drops empty strings/arrays/photos. Success panel: "Copy invite link" (same rsvpUrl pattern — signToken 'rsvp' + `/invite/`), "Preview" (window.open same URL), note that the poster lives in the Guests page menu.
- [ ] tsc + vitest + (if a dev server is up) `curl /events/demo-e1/einvite` → 200. Commit `feat: E-invite studio — photo slots, details, create`.

---

### Task 4: Guest page photo-story sections

**Files:**
- Create: `src/components/invite/InviteNames.tsx`, `InviteEditorial.tsx`, `InviteRedDuo.tsx`, `InviteCalendar.tsx`, `InviteLetter.tsx`
- Modify: `src/components/invite/InviteHero.tsx` (optional `photo?: string` + `scriptLine?: boolean` → photo variant: 100svh full-bleed img cover + gv-feather-b, gv-script "We're getting married" over it, names + date at bottom in ivory-on-photo w/ text-shadow; no photo → exactly current markup)
- Modify: `InviteDetails.tsx` (show start time line when `startsAt` prop provided), `InviteRsvp.tsx` (optional `deadline?: string` → "RSVP / by {formatDate(deadline)}" line under the eyebrow), `src/app/(guest)/invite/[token]/page.tsx` (compose per spec order, all new sections gated on config presence)

**Component contracts (binding):**
```ts
<InviteNames bride groom bridePhoto? groomPhoto? />   // offset editorial collage, underlined 'BRIDE / <name>' labels; photos optional
<InviteEditorial photo />                              // rising masked photo + existing overjoyed script line moves here when photo exists
<InviteRedDuo bridePhoto groomPhoto />                 // maroon #7a1e26 blocks, gv-feather-y, gv-script 'her /' 'him /', caption line
<InviteCalendar eventDate backdrop? />                 // calendarGrid(); gold-circled day; monthLabel heading; optional translucent backdrop img
<InviteLetter lines photos={{candid1?,candid2?}} />    // each line its own useReveal reveal; candids alternate small left/right; last line gv-script
```
- Page ordering with config: envelope → Hero(photo) → title greeting → InviteEditorial → InviteNames → InviteRedDuo (if red_accent && both portraits) → InviteCalendar → Countdown → Details(+time) → Ballroom → Menu → InviteLetter → Rsvp(+deadline) → footer. Without config: exact V1 order (assert by keeping the V1 JSX branch intact — a top-level `const cfg = event.invite ?? null` and conditionals).
- [ ] tsc + vitest; commit `feat: /invite photo story — hero photo, names, red duo, calendar, letter, deadline`.

---

### Task 5 (controller): migration gate, e2e, build, final review, merge, deploy

- [ ] USER ACTION: `alter table events add column if not exists invite jsonb;` in the Supabase SQL editor (REST-verify `events?select=invite&limit=1` → 200 before probing).
- [ ] Probe (demo event, restored): generate 3 fixture JPGs via canvas in-page or sharp-less node (solid-color PNGs fine); studio: upload hero+bride+groom via setInputFiles, set names Terry/Ennqi, time 19:00, deadline, Create → success panel; /invite: hero photo present (img src startsWith data:image), names beat, red duo, calendar circled day, letter reveals, seconds ticking (two samples differ), deadline line, ballroom + RSVP still work; config-less regression: second demo? (temporarily null the invite config via REST after, then check V1 render) → restore/reset demo.
- [ ] `npx vitest run`, `NEXT_DIST_DIR=.next-build npm run build`, final whole-branch review (most capable model) + fix loop, merge with dev stopped, push, poll prod.
