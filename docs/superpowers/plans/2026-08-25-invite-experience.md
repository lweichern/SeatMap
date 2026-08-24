# E-Invite Experience (V1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first `/invite/[token]` page that turns the shared RSVP link into an experience: tap-open envelope → hero with personal greeting → countdown → date/venue actions → scroll-orbit 3D ballroom → menu tease → RSVP finale with confetti.

**Architecture:** Pure helpers in `src/lib/invite.ts` + `src/lib/calendar.ts`; self-contained beat components in `src/components/invite/`; one composing page. Reveal system = one IntersectionObserver hook + CSS classes added to the guest layout THEME. No animation libraries. Spec: `docs/superpowers/specs/2026-08-25-invite-experience-design.md` (the authority on behavior).

**Tech Stack:** Next.js 15 App Router client components, TypeScript, Tailwind v4 + the `(guest)` layout `gv-*` theme, three.js via existing `HallScene`, vitest@3.

## Global Constraints

- Branch `invite-exp`, merged `--no-ff` to `main` at the end. Commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` on every commit.
- MOBILE-FIRST: design at 390×844; `100svh` (never `100vh`) for full-screen beats; tap targets ≥ 44px; safe-area padding on the envelope (`env(safe-area-inset-*)`).
- Motion doctrine (spec): native scroll everywhere; IntersectionObserver reveals; ONE sticky pinned section (ballroom); envelope is tap-driven; everything honors `@media (prefers-reduced-motion: reduce)`.
- No new dependencies. Added client JS beyond existing chunks ≲ 30 KB.
- Token slot: `/invite/<token>` accepts the `rsvp` event slot AND personal guest tokens; `kiosk` slot is rejected. `?to=Name` personalizes the shared link.
- `/rsvp` route stays untouched and working.
- Gates: `npx tsc --noEmit`, `npx vitest run`; controller-only `NEXT_DIST_DIR=.next-build npm run build`. NEVER bare `npm run build`; ONE dev server per checkout (predev guard); NEVER `git add -A` (stage explicit paths — `landing/` and `remotion-promo/` must never be committed).
- Reuse the stationery language: classes `gv-shell`, `gv-display`, `gv-caps`, `gv-rise`, CSS vars `--ink/--ink-soft/--ink-faint/--gold/--gold-soft/--line/--card`, `Flourish` from `@/components/guest/Flourish`. Exemplars: `src/app/(guest)/rsvp/[token]/page.tsx` and `src/app/(guest)/g/[token]/page.tsx`.

---

### Task 1: Pure helpers — `lib/invite.ts` + `lib/calendar.ts` (TDD)

**Files:**
- Create: `src/lib/invite.ts`, `src/lib/calendar.ts`
- Test: `src/lib/invite.test.ts`, `src/lib/calendar.test.ts`
- Modify: `src/app/(guest)/g/[token]/page.tsx` (replace its local `downloadIcs`/`formatDate` with the lib)

**Interfaces (later tasks rely on these exact names):**

```ts
// src/lib/invite.ts
export function monogram(coupleNames: string): string
// "Adam & Eve" → "A·E"; "Adam and Eve" → "A·E"; "小明与小红" → "小·小";
// single name "Adam" → "A". Split on /&|and|与/i surrounded by spaces or CJK 与;
// take the first grapheme ([...s][0]) of each trimmed side, uppercase latin.

export type CountdownState =
  | { state: 'future'; days: number; hours: number; minutes: number }
  | { state: 'today' }
  | { state: 'past' }
export function countdown(eventDate: string, now: Date): CountdownState | null
// eventDate "YYYY-MM-DD" local midnight target; invalid → null.
// same local calendar date → 'today'; now ≥ date+1d → 'past';
// else floor-decompose (date - now) into days/hours/minutes.

export function formatDate(d: string): string
// "2026-09-12" → "12 September 2026" via en-GB; invalid → the raw string.
// (Move the guest page's copy here; guests-page keeps its own local copy — do not touch it in this task.)

// src/lib/calendar.ts
export function buildIcs(ev: { id: string; couple_names: string; event_date: string }, venue: { name: string; address: string }): string | null
// The exact ICS the guest page builds today (all-day, local-parts DTEND) — lift it.
export function downloadIcs(ev: ..., venue: ...): void   // Blob + <a download>, no-op when buildIcs null
export function googleCalUrl(ev: { couple_names: string; event_date: string }, venue: { name: string; address: string }): string | null
// https://calendar.google.com/calendar/render?action=TEMPLATE&text=<enc>&dates=YYYYMMDD/YYYYMMDD(+1, local parts)&location=<enc>
export function wazeUrl(q: string): string      // https://waze.com/ul?q=<enc>&navigate=yes
export function gmapsUrl(q: string): string     // https://www.google.com/maps/search/?api=1&query=<enc>
```

- [ ] **Step 1: Branch** — `git checkout main && git checkout -b invite-exp`
- [ ] **Step 2: Failing tests.** Cover: monogram (& / and / 与 / single / CJK), countdown (future decomposition against a fixed `now`, today, past, invalid), formatDate, buildIcs (DTEND is +1 day across month end, e.g. 2026-09-30 → DTEND 20261001; commas escaped in LOCATION), googleCalUrl dates + encoding, waze/gmaps encoding. Use fixed `new Date('2026-08-25T20:00:00')` style values — never `Date.now()`.
- [ ] **Step 3: RED run** (`npx vitest run src/lib/invite.test.ts src/lib/calendar.test.ts`).
- [ ] **Step 4: Implement both libs.** For `buildIcs`, lift the guest page's `downloadIcs` body verbatim (including the local-parts DTEND comment) and split into build/download.
- [ ] **Step 5: Refactor guest page** to `import { downloadIcs } from '@/lib/calendar'` and `import { formatDate } from '@/lib/invite'`, deleting its local copies. Its call sites keep identical signatures.
- [ ] **Step 6: GREEN** — targeted tests, then `npx vitest run` (all), `npx tsc --noEmit`.
- [ ] **Step 7: Commit** — `feat: invite/calendar pure helpers (monogram, countdown, ICS/GCal/maps URLs)`

---

### Task 2: Reveal system, envelope, hero, particles

**Files:**
- Modify: `src/app/(guest)/layout.tsx` (THEME string additions only)
- Modify: `src/components/guest/Flourish.tsx` (optional `draw` prop)
- Create: `src/components/invite/useReveal.ts`, `src/components/invite/InviteEnvelope.tsx`, `src/components/invite/InviteHero.tsx`, `src/components/invite/InviteParticles.tsx`

**Interfaces:**
```ts
export function useReveal<T extends HTMLElement = HTMLDivElement>(): React.RefObject<T | null>
// SSR-safe. Attaches one module-level IntersectionObserver (threshold .2);
// on first intersection adds class 'gv-io-in' to the element, unobserves.
// Elements start with class 'gv-io' in markup.

<InviteEnvelope monogram="A·E" opened={bool} onOpen={() => void} />
// fixed inset-0 z-40 overlay, 100svh, safe-area padded, ivory card +
// gold wax seal circle (serif monogram), caption 'Tap to open'.
// Tap → adds opening class → CSS flap/slide animation (~1.1s) → calls
// onOpen after transitionend (with a 1.4s setTimeout fallback).
// When opened=true renders null.

<InviteHero coupleNames dateLine greetName={string | null} />
// eyebrow 'Together with their families' (gv-caps gold) → names
// (gv-display italic, text-5xl) → <Flourish draw /> → dateLine →
// greeting paragraph: greetName ? `Dear ${greetName},` prefix bolded.
// All children staggered with gv-rise delays (hero animates on load
// after envelope opens — no IO needed here).

<InviteParticles />
// fixed inset-0 pointer-events-none z-0 canvas; ~18 gold/champagne dots
// (rgba #c9a44a/#d9c48e, r 1.5-3.5) drifting down-left, wrapping;
// requestAnimationFrame paused on document.hidden and when
// matchMedia('(prefers-reduced-motion: reduce)') matches (render nothing).
```

**THEME additions (append inside the existing template string):**
```css
.gv-io{ opacity:0; transform:translateY(18px); transition:opacity .7s cubic-bezier(.22,.61,.21,1), transform .7s cubic-bezier(.22,.61,.21,1); }
.gv-io-in{ opacity:1; transform:none; }
.gv-seal{ /* wax seal: radial-gradient gold circle, inner ring, serif letters */ }
.gv-env-flap{ transform-origin:top; transition:transform .6s ease-in; }
.gv-env-open .gv-env-flap{ transform:rotateX(-160deg); }
.gv-env-card{ transition:transform .7s .35s cubic-bezier(.22,.61,.21,1), opacity .5s .9s; }
.gv-env-open .gv-env-card{ transform:translateY(-46svh); opacity:0; }
.gv-draw line, .gv-draw rect{ stroke-dasharray:200; stroke-dashoffset:200; animation:gvDraw 1.6s .2s ease forwards; }
@keyframes gvDraw{ to{ stroke-dashoffset:0 } }
@media (prefers-reduced-motion: reduce){ .gv-io{ opacity:1; transform:none; transition:none } .gv-draw line,.gv-draw rect{ animation:none; stroke-dashoffset:0 } }
```
(Implementer refines exact envelope markup/classes; the spec beats and reduced-motion behavior are the requirements. Flourish `draw` prop just adds the `gv-draw` class to the svg.)

- [ ] Steps: implement → `npx tsc --noEmit` → `npx vitest run` (no regressions; hooks/components get no unit tests — e2e covers) → commit `feat: invite reveal system, envelope, hero, particles`.

---

### Task 3: Countdown, details, menu tease

**Files:** Create `src/components/invite/InviteCountdown.tsx`, `InviteDetails.tsx`, `InviteMenu.tsx`

**Interfaces:**
```ts
<InviteCountdown eventDate={string} />
// useReveal wrapper; countdown() from lib recomputed every 60s (setInterval,
// cleared on unmount) + on mount; 'future' → three gv-display numbers with
// gv-caps labels (days/hours/minutes); 'today' → 'Today we celebrate 🎉';
// 'past'/null → renders null.

<InviteDetails event={{couple_names,event_date,id}} venue={{name,address}} />
// two stationery cards (rounded-2xl border-(--line) bg-(--card)):
// 1) formatted date + two buttons: 'Google Calendar' (open googleCalUrl in
//    new tab) and 'Apple / .ics' (downloadIcs);
// 2) venue name + address + 'Waze' / 'Google Maps' buttons (wazeUrl/gmapsUrl,
//    target _blank). Buttons: gold-gradient pill style from the RSVP page,
//    min-h 44px.

<InviteMenu menu={MenuItem[]} />
// null when empty. gv-caps gold eyebrow "This evening's menu", first 4
// courses in the roman-numeral centered style (copy the guest page's menu
// markup), first course WITH photo shows it (rounded-2xl, border), then
// '…and more on the night' in gv-display italic. Every block gv-io+useReveal.
```

- [ ] Steps: implement → tsc → vitest (all green) → commit `feat: invite countdown, details, menu tease`.

---

### Task 4: The pinned ballroom orbit

**Files:** Create `src/components/invite/InviteBallroom.tsx` (+ its lazy inner `src/components/invite/BallroomCanvas.tsx`)

**Interfaces:**
```ts
<InviteBallroom scene={HallSceneProps} fallback={ReactNode} />
// OUTER: <section style={{height:'240svh'}}> containing <div className="sticky top-0 h-[100svh] flex items-center justify-center">
//   → gold-framed card (rounded-3xl border-(--line) bg-[#14100a], ~60svh tall, mx-3)
//   → caption below frame: 'Scroll to look around the ballroom' (gv-caps).
// Mounts BallroomCanvas (next/dynamic, ssr:false) only when an IO with
// rootMargin '600px 0px' first fires; before that, and when
// !webglAvailable() (copy the 2-line check from /g page), render `fallback`.
// SCROLL DRIVE: passive scroll listener computes
//   p = clamp((scrollY - sectionTop) / (sectionHeight - viewportH), 0, 1)
// and passes it via a ref/setState throttled with rAF.

// BallroomCanvas { scene: HallSceneProps; progress: number }
// <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{fov:50}}>, <color> bg '#14100a',
// <HallScene {...scene} />. An inner rig useEffect/useFrame positions the camera:
//   const b = sceneBounds(scene); const r = b.span * 0.85
//   azimuth = -0.35*PI + progress * 0.95*PI   // ~170° sweep
//   camera.position.set(b.cx + r*Math.sin(azimuth), b.span*0.55, b.cy + r*Math.cos(azimuth))
//   camera.lookAt(b.cx, 0, b.cy)
// call invalidate() whenever progress changes (frameloop demand = zero idle GPU).
// No OrbitControls, no pointer interaction (scroll IS the interaction).
// prefers-reduced-motion: fixed progress 0.5, no scroll drive.
```

- [ ] Steps: implement → tsc → vitest → commit `feat: invite pinned ballroom orbit (sticky scrub, demand-rendered)`.

---

### Task 5: RSVP finale, confetti, page assembly, wiring

**Files:**
- Create: `src/components/invite/InviteRsvp.tsx`, `src/lib/confetti.ts`, `src/app/(guest)/invite/[token]/page.tsx`
- Modify: `src/app/(planner)/events/[eventId]/guests/page.tsx` (invite link + poster now point at `/invite`)

**Interfaces:**
```ts
// src/lib/confetti.ts
export function burstConfetti(): void
// creates a fixed full-screen canvas, ~120 particles (gold palette
// '#c9a44a','#d9c48e','#8a6a1f','#fffdf6', rects+circles, gravity+drag,
// ~1.8s), removes the canvas when done. No-op under prefers-reduced-motion.

<InviteRsvp event={WeddingEvent} prefill={{ name?: string; phone?: string } | null} />
// Lift the FORM SECTION of src/app/(guest)/rsvp/[token]/page.tsx VERBATIM:
// same state shape, submit() with mergeRsvp + saveGuest + localStorage
// selfid line, dietary disclosure with DietarySteppers tone="light",
// accept/decline pills, same input/label class strings. Differences ONLY:
// (1) prefill seeds name/phone state; (2) on success with attending →
// burstConfetti() before setDone; (3) done state adds the line
// 'Keep this link — on the wedding day it becomes your seat finder.';
// (4) eyebrow heading 'Kindly respond' (gv-caps gold) since the hero
// already introduced the couple.

// page.tsx — 'use client', use(params), useSearchParams for ?to=
// resolve: peekToken → getRepo().getEvent → verifyToken(secret). slot:
//   'kiosk' → invalid state; 'rsvp' → ok, greetName = search.get('to');
//   else → try listGuests find g.id===slot: found → greetName=g.name,
//   prefill {name:g.name, phone:g.phone ?? undefined}; not found → generic.
// Also load venue + getLayout(event.layout_id) for the ballroom scene
// (walls/door/door_width_m/registration/stage/tables, highlightTableId:null,
// route:null, fallbackSpan from venue dims — mirror /g's sceneProps minus highlight/route).
// States: loading (reuse /g loading style, 'Opening your invitation…'),
// invalid (reuse /rsvp invalid copy).
// Assembly (inside <div className="gv-shell">):
//   {!opened && <InviteEnvelope …/>}  — opened from
//     sessionStorage[`invite.opened.${event.id}`], persisted on open;
//     while !opened the content wrapper gets 'h-[100svh] overflow-hidden'.
//   <InviteParticles/> <InviteHero/> <InviteCountdown/> <InviteDetails/>
//   <InviteBallroom scene fallback={<Hall2D {...hallProps}/>}/>
//   <InviteMenu/> <InviteRsvp/> footer wordmark (gv-caps ink-faint 'SEATMAP').
// Guests page wiring: rsvpUrl() path '/rsvp/' → '/invite/'; poster
// instruction stays 'Scan to RSVP'; menu hint for 'Copy invite link' →
// 'The full e-invitation — envelope, countdown, ballroom & RSVP'.
```

- [ ] Steps: implement → tsc → vitest → dev-server compile check (`curl /invite/x` → 200 if a server is up; NEVER start a second one) → commit `feat: /invite — the e-invitation experience (envelope → ballroom → RSVP)`.

---

### Task 6 (controller): E2E, suite, build, final review, merge, deploy

- [ ] Phone-viewport Playwright probe on the demo event (state restored after):
  1. `/invite/<rsvp-token>?to=Uncle%20Lim` → envelope visible, content not scrollable → tap → hero reveals with 'Dear Uncle Lim' → scroll through countdown/details (Waze+GCal hrefs correct) → ballroom canvas mounts without pageerror, progress advances → menu tease → RSVP 'Kelly Invite' party 2 + veg 1 → confetti fires (canvas appears) → done copy → REST cleanup of the guest.
  2. Personal guest token (demo-g2) → greets 陈美玲, form prefilled.
  3. sessionStorage remembers opened on reload; reduced-motion context (`contextOptions.reducedMotion:'reduce'`) renders open + revealed instantly.
  4. Guests page 'Copy invite link' copies an `/invite/` URL.
- [ ] `npx vitest run` (expect ~150+), `npx tsc --noEmit`, `NEXT_DIST_DIR=.next-build npm run build`, `rm -rf .next-build`.
- [ ] Final whole-branch review (most capable model) with review package from merge-base; single fix loop if needed.
- [ ] Merge `--no-ff` (dev server stopped first), push, poll prod for the new `/invite` route, smoke-check.
