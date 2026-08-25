# E-Invite Studio (V2) — photos in, full invitation out

**Date:** 2026-08-25 · **Status:** Approved (user-directed)
Builds on the live `/invite` V1 and the analyzed reference video
(Hunbei-style photo story: feathered photo masks, script accents, red beat,
calendar grid, letter, seconds countdown, RSVP deadline).

## Problem

The V1 invite is typography-only. Couples expect their photo shoot to BE
the invitation. The planner needs one page: drop labeled photos, fill a
short form, click **Create e-invite** — and the guest-facing `/invite`
becomes the full photo story.

## Data

`events.invite` jsonb (migration `0004_invite.sql` + mirrored in
`supabase/setup.sql`; user runs one ALTER in the SQL editor):

```ts
export interface InviteConfig {
  bride_name?: string        // "Ennqi" — labels + her/him beats
  groom_name?: string        // "Terry"
  rsvp_deadline?: string     // ISO date → "RSVP / by 31 August 2026"
  letter?: string[]          // sign-off letter, one line per entry
  red_accent?: boolean       // her/him beat over the maroon backdrop
  photos?: {
    hero?: string            // data URL (resized)
    bride?: string
    groom?: string
    editorial?: string       // the "overjoyed to invite you" beat
    candid1?: string         // letter section
    candid2?: string
  }
}
```
`WeddingEvent.invite?: InviteConfig | null`. Photos stored as data URLs
resized to ≤1200px long edge via the existing `resizeImage` (jpeg/webp) —
~150-250KB each, ≤ ~1.5MB per event row. (Interim until Supabase Storage;
noted as production-hardening.)

## The Studio — `/events/[eventId]/einvite` (planner)

Linked from the events-page ⋯ menu ("E-invite studio") AND from the
guests page invite dropdown ("Design the e-invite").

Layout (single column, max-w-2xl):
1. **Photo slots** — a 2-col grid of six labeled drop tiles, each stating
   exactly what's expected:
   - **Hero — the two of you** (portrait, full-bleed opener) · required for
     the photo story; everything else optional
   - **Bride portrait** ("her" beat)
   - **Groom portrait** ("him" beat)
   - **Editorial — a favourite shot** (invite-text beat)
   - **Candid 1** and **Candid 2** (the letter section)
   Each tile: drag-drop + click-to-browse (`resizeImage(f, 1200)`),
   preview thumbnail, ✕ to clear. Aspect hints on the tile
   (portrait ~3:4 for hero/bride/groom, any for the rest).
2. **Details form**:
   - Bride's name · Groom's name (prefilled by splitting
     `couple_names` on & / and / 与 when possible)
   - Ceremony start time (writes `event.starts_at`; time input; shown as
     "7 PM" style in the info beat)
   - RSVP deadline (date input → deadline line on the RSVP beat)
   - The letter (textarea, one line per row; prefilled with an
     EN default of the reference's arc: journey → counting down →
     "Long time no see — see you at our wedding")
   - Toggle: "Bold red her/him section" (default on when both portraits set)
   - (Date + venue shown read-only from the event/venue — edited where
     they live, not duplicated.)
3. **Create e-invite** (primary gold button) — saves `invite` jsonb (+
   `starts_at`), then shows success state with **Copy invite link**,
   **Preview** (opens `/invite/<rsvp token>` in a new tab) and the
   existing poster download. Re-entering the page loads the saved config
   for editing (button reads **Update e-invite**).

## Guest page `/invite` — photo-story upgrade

All sections render conditionally; an event with no `invite` config keeps
today's V1 exactly. With config:

- **Script accent font** — `Great_Vibes` via next/font in the (guest)
  layout, exposed as `--font-script` + `.gv-script`; used for the hero
  line, "her /", "him /", letter sign-off, "See you there!".
- **Hero** becomes full-bleed `photos.hero` (100svh, feathered bottom mask
  into ivory) with `gv-script` "We're getting married", the formatted
  date, names at the bottom — envelope opening unchanged before it.
- **Names beat** — "BRIDE / <bride_name> · GROOM / <groom_name>" offset
  editorial collage using bride+groom portraits (falls back to labels-only
  when photos missing; hidden when no names).
- **Editorial beat** — `photos.editorial` rising with a feathered mask +
  the existing "overjoyed" line in script.
- **her / him beat** (when `red_accent` and portraits exist) — maroon
  (#7a1e26) full-bleed blocks, feathered top/bottom, script "her /"
  "him /" labels, caption "Some moments define a lifetime — and this is
  one of them."
- **Calendar beat** — month grid of `event_date`'s month (Mo-Su), wedding
  day circled in gold, "MM / DD" heading, translucent `candid1` behind
  when present.
- **Letter beat** — `letter` lines revealing one-by-one (each line its own
  reveal), candid photos alternating small left/right; sign-off line in
  script.
- **Countdown** gains **seconds** (per-second tick — the section is
  already client-rendered; the reference ticks seconds and it reads alive).
- **Info beat** shows start time when `starts_at` set.
- **RSVP beat** shows "RSVP / by <formatted deadline>" when set (display
  only in V2 — no hard cutoff).
- **Feathered mask utility** — `.gv-feather-b`, `.gv-feather-y` (CSS
  mask-image linear-gradients) in the guest layout THEME.

Ordering: envelope → hero(photo) → title/greeting → editorial → names
collage → her/him red → calendar → countdown → details → ballroom (kept —
our moat) → menu tease → letter → RSVP → sign-off/footer.

## Mobile & motion doctrine

Unchanged from V1: 100svh, native scroll, IO reveals, ONE pinned section
(ballroom), reduced-motion collapses everything, no new libraries. Masks
are pure CSS; per-second countdown pauses on `document.hidden`.

## Testing

- Unit: InviteConfig defaults/merge helper, calendar-grid builder
  (weeks matrix, Monday-first, circled day), deadline formatting,
  bride/groom prefill splitter (reuse monogram's splitting logic).
- E2E (demo event, restored): studio uploads (set 2-3 slots via
  setInputFiles with generated fixtures) → Create → /invite shows hero
  photo, names beat, calendar circled day, letter lines reveal, seconds
  tick, deadline line; event without config still renders V1; planner
  reload shows saved config (Update mode).

## Out of scope

Music, Supabase Storage (noted), wishes wall, per-guest photo
personalization, hard RSVP cutoff enforcement.

## Addendum (2026-08-25): Music + auto-played story

- `InviteConfig.music?: string` (audio data URL or https URL) and
  `InviteConfig.auto_scroll?: boolean` (default true).
- Studio gains: a **Music (optional)** tile — audio file upload (hard cap
  5 MB, hint "MP3 · ≤5 MB · a 60–90s loop is perfect") stored as a data
  URL, or a paste-a-URL input; ✕ clears. A checkbox **"Auto-play the story
  (slow scroll until they touch)"**, default on. cleanConfig must preserve
  `auto_scroll: false` (an explicit off is not "empty").
- Guest `/invite`: when `cfg.music` exists, the envelope tap (user gesture)
  starts a looping `<audio>`; a floating disc toggle (top-right, gold ring,
  ♪, CSS spin while playing; reduced-motion: no spin) pauses/resumes. Music
  keeps playing while scrolling; no autoplay without the tap (browser
  policy), so the sealed envelope shows no audio UI.
- Auto-scroll: ~1.8 s after opening, the page scrolls itself at a gentle
  reading pace (~55 px/s, rAF-driven) and cancels PERMANENTLY on the first
  wheel/touch/pointer/key input; it also stops ~600 px before the document
  end so the RSVP form is reached at rest. Skipped entirely under
  prefers-reduced-motion or when `auto_scroll === false`.
- No migration (jsonb). Known cost: a 5 MB file ≈ 6.8 MB base64 in the
  events row — worsens the listEvents payload backlog item; local-mode
  localStorage quota may reject saves with music (surfaced by the studio's
  save error alert). Storage-bucket follow-up unchanged.
