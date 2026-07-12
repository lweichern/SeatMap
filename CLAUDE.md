# CLAUDE.md — Wedding Event Management Webapp

## Project

A wedding event management platform sold to **wedding planners** (not couples). Planners run multiple events, reuse venue layouts, and need tooling that survives a real ballroom on a real wedding day.

Working name: `SeatMap` (rename freely).

Three core jobs:

1. **Before the event** — planner maps the hall, imports guests, auto-allocates tables, exports QR codes for invites.
2. **On the day** — guests check in via QR, get told their table, and are guided there with a 3D map.
3. **During the event** — guests upload candid photos to a live feed, a moderated ballroom slideshow, and a private album for the couple.

---

## Non-negotiable product decisions

These were argued through already. Do not re-litigate them in code.

| Decision                    | Choice                                                                                                       | Why                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hall capture                | **Floor plan upload + drag-drop table editor**. NOT LiDAR/photogrammetry.                                    | Planners already have PDF floor plans. A 3D scan still needs a human to label "this blob is Table 7", so you pay for the scan and keep the manual step. Halls get re-set for every event — planners need to place 30 tables in 5 minutes. |
| 3D map                      | **Generated from the 2D floor plan data**, not from a scan. Extrude tables into cylinders, walls into boxes. | Free 3D. No scanning hardware, no mesh cleanup.                                                                                                                                                                                           |
| Wayfinding v1               | **3D map with the guest's table highlighted + path from entrance.**                                          | Reliable, works on every phone.                                                                                                                                                                                                           |
| Wayfinding v2               | **AR-lite compass overlay** (see AR section). NOT WebXR.                                                     | iOS Safari does not support WebXR `immersive-ar` at all. ~Half the guests would silently get nothing.                                                                                                                                     |
| Blue-dot indoor positioning | **Explicitly out of scope.**                                                                                 | Web Bluetooth cannot passively read BLE beacons — it needs a per-device pairing dialog. It is impossible in a webapp, full stop. And ±4m accuracy in a room where tables are 2m apart is a dot floating between three tables.             |
| Seating granularity         | **Table level, not seat level.**                                                                             | Malaysian Chinese weddings use round tables of 10. Nobody assigns seat 7.                                                                                                                                                                 |
| QR codes                    | **Pre-issued, unique per guest**, printed/sent with the invite.                                              | Best UX. Walk-ins handled by a greeter-side manual add flow.                                                                                                                                                                              |
| Photo moderation            | **Tiered.** See Photos section.                                                                              | A planner will not put an unmoderated feed on the ballroom screen.                                                                                                                                                                        |
| Offline                     | **The greeter check-in app must work with zero bars.**                                                       | Ballroom wifi is garbage and 200 guests on 4G at once is worse.                                                                                                                                                                           |

---

## Architecture

### Stack

- **Next.js 15** (App Router, TypeScript, RSC where sensible)
- **Supabase** — Postgres, Auth, Storage, Realtime
- **Konva.js** (via `react-konva`) — floor plan editor canvas
- **React Three Fiber** + `@react-three/drei` — 3D hall view
- **Dexie.js** — IndexedDB wrapper for the offline greeter PWA
- **Tailwind** + shadcn/ui
- **Gemini 2.5 Flash** — photo pre-moderation
- Deploy: **Fly.io Singapore** (or Vercel)

### Apps / surfaces

There are **four distinct surfaces**. Build them as separate route groups, they have very different requirements.

```
/app
  /(planner)        # Desktop. Auth'd. Hall editor, guest list, allocation, settings.
  /(greeter)        # Tablet PWA. OFFLINE-FIRST. Check-in scanner. Must never fail.
  /(guest)          # Mobile web. No auth. QR-token based. Table + 3D map + photos.
  /(screen)         # Ballroom projector. Approved photo slideshow. Kiosk mode.
```

---

## Data model

Tables in Supabase. All timestamps `timestamptz`.

### `organizations`

Wedding planner companies. Multi-tenant root.

- `id`, `name`, `created_at`

### `users`

Planner staff. Supabase Auth linked.

- `id`, `org_id`, `email`, `role` (`owner` | `staff`)

### `venues`

**The template library. This is the retention moat.** A planner maps "Grand Ballroom @ Hilton KL" once and reuses it for every event there.

- `id`, `org_id`, `name`, `address`
- `floorplan_url` (Supabase Storage)
- `scale_px_per_metre` (float) — set by the planner dragging a line and typing a known distance
- `width_m`, `height_m`
- `walls` (jsonb) — array of `{ x1, y1, x2, y2 }` in **metres**
- `entrance` (jsonb) — `{ x, y, facing_deg }`. Critical: this is the AR/wayfinding anchor.
- `stage` (jsonb, nullable) — `{ x, y, w, h }`

### `venue_table_layouts`

A saved arrangement of tables for a venue. One venue can have several (e.g. "300 pax", "180 pax").

- `id`, `venue_id`, `name`, `capacity_total`

### `venue_tables`

- `id`, `layout_id`
- `label` (text, e.g. "12", "VIP-1")
- `x`, `y` (**metres**, origin = top-left of floor plan)
- `seats` (int, default 10)
- `shape` (`round` | `rect`)
- `diameter_m` (default 1.8) or `w_m`/`h_m`

> **Store all geometry in metres, never pixels.** Convert at render time. Pixels break the moment someone uploads a floor plan at a different resolution.

### `events`

- `id`, `org_id`, `venue_id`, `layout_id`
- `couple_names` (text, e.g. "Wei Chern & Jia Ling")
- `event_date` (date), `starts_at`
- `photo_mode` (`live_feed` | `moderated_only` | `off`)
- `guest_token_secret` (uuid) — used to sign guest QR tokens

### `guests`

- `id`, `event_id`
- `name`, `phone` (nullable), `email` (nullable)
- `party_size` (int, default 1) — the "+2" case
- `side` (`bride` | `groom` | `both`)
- `group_tag` (text, nullable) — e.g. "Bride's uni friends", "Groom's colleagues". Used by the allocator.
- `is_vip` (bool)
- `table_id` (fk → `venue_tables`, nullable until allocated)
- `qr_token` (text, unique) — the payload encoded in their QR
- `checked_in_at` (timestamptz, nullable)
- `checked_in_by` (fk → users, nullable)

### `guest_constraints`

For the allocator. This is the feature planners will actually pay for.

- `id`, `event_id`
- `guest_a_id`, `guest_b_id`
- `type` (`must_sit_together` | `must_not_sit_together`)

### `photos`

- `id`, `event_id`, `guest_id` (nullable — could be from the couple)
- `storage_path`, `thumb_path`
- `status` (`pending_ai` | `pending_human` | `approved` | `rejected`)
- `ai_flag_reason` (text, nullable)
- `uploaded_at`, `approved_at`, `approved_by`
- `on_screen` (bool) — has it been shown on the ballroom slideshow

### `checkin_log`

Append-only. Written by the greeter app on sync. Never mutated.

- `id`, `event_id`, `guest_id`, `checked_in_at`, `device_id`, `synced_at`

---

## Build order

Build strictly in this order. Each phase must work before the next starts.

### Phase 1 — Hall editor + venue template library

The planner's daily tool. If this is annoying, nothing else matters.

- Upload floor plan image (PNG/JPG/PDF → rasterize first page)
- **Set scale**: user drags a line across a known dimension, types "20" + unit → derive `scale_px_per_metre`
- Draw walls (click-to-place polyline)
- Mark **entrance** (position + facing arrow). Do not skip this — wayfinding depends on it.
- Mark stage (optional)
- Drag-drop round tables onto the canvas. Snap-to-grid (0.5m). Auto-increment labels.
- Multi-select, align, distribute, duplicate row/grid
- Save as a **layout** under a **venue**. Venue is reusable across events.

Use `react-konva`. Keep the canvas state in a Zustand store, persist to Supabase on debounce.

**Acceptance:** a planner can go from a blank PDF to a 30-table labelled layout in under 5 minutes, and reuse that venue for a second event without redoing anything.

### Phase 2 — Guest import + auto-allocation

- CSV/XLSX import. **Planners live in Excel.** Be generous with the parser: fuzzy-match column headers (`Name`/`Guest Name`/`名字`), preview before commit, let them map columns manually if auto-detect fails.
- Guest list table view: search, filter by side/group/VIP, inline edit, bulk tag.
- **Auto-allocation** — the money feature. This is the part of the job planners hate.

**Allocation algorithm (v1, greedy + local search):**

```
1. Hard constraints first:
   - must_sit_together pairs → merge into groups
   - group_tag → treat as a soft cluster
   - party_size → a guest with party_size 3 consumes 3 seats
2. Seed:
   - VIPs → tables nearest the stage (sort tables by distance to stage.x/y)
   - Place largest groups first (best-fit-decreasing bin packing into tables of `seats`)
3. Local search (hill climbing, ~2000 iterations):
   - Score = (broken must_not_sit_together * -1000)
           + (group_tag members at same table * +10)
           + (VIP distance to stage penalty)
           + (table fill efficiency)
   - Randomly swap two guests between tables, keep if score improves
4. Never break a hard constraint. If unsatisfiable, surface it clearly.
```

Do this **client-side in a Web Worker** — it's fast enough for 300 guests and gives instant re-run when the planner tweaks something.

**The planner must be able to override any allocation by dragging a guest to another table.** Locked guests are pinned and excluded from re-allocation.

### Phase 3 — QR generation + invite export

- Generate `qr_token` per guest: signed payload `{ event_id, guest_id }` HMAC'd with `event.guest_token_secret`. Stateless verification.
- QR encodes: `https://app.example.com/g/{qr_token}`
- **Export**: PDF sheet of QR codes (name + QR, cut lines), and a ZIP of individual PNGs named `{guest_name}.png` so the planner can drop them into invite designs / WhatsApp them individually.

### Phase 4 — Greeter PWA (offline check-in) ⚠️ CRITICAL PATH

**This is the thing that must never fail.** If it goes down, there is a queue of 200 people at the door of someone's wedding.

- Installable PWA. Tablet-oriented UI. Big touch targets.
- **On event load, cache EVERYTHING to IndexedDB via Dexie:** full guest list, all `qr_token`s, the full table layout, the venue geometry. Do this over wifi _before_ the doors open. Show an explicit "✅ Ready for offline — 247 guests cached" state.
- Scan guest QR with device camera (`@zxing/browser` or `html5-qrcode`).
- **Verify the token locally** — it's HMAC'd, no network needed. Look up the guest in IndexedDB.
- Show, instantly and huge: **guest name → TABLE 12**. Loud, unmissable typography.
- Write check-in to a local IndexedDB outbox.
- **Background sync** to Supabase when connectivity returns. Idempotent — use `guest_id` as the dedupe key, the server takes `MIN(checked_in_at)`.
- **Manual flows the greeter needs:**
  - Search by name/phone (the uncle who lost his QR)
  - **Walk-in add** — new guest, assign to any table with space. This will happen at every single wedding.
  - Undo check-in
- Show live occupancy: which tables are filling, which are empty.

**Acceptance:** put the tablet in airplane mode. Scan 50 guests. Nothing breaks. Turn wifi back on. All 50 appear in the planner dashboard.

> **Why the greeter device and not the guest's phone:** the guest's QR is just an image, it works offline. But if the _guest_ has to load a URL to check in and the ballroom has no signal, the page never loads and the whole system is dead. Putting the critical path on one controlled, pre-cached device removes that failure mode entirely. The guest's phone becomes a nice-to-have.

### Phase 5 — Guest view (table + 3D map)

Route: `/g/{qr_token}`. No auth. Mobile-first.

- Verify token → resolve guest → show:
  - **TABLE 12** at the top. Enormous. This alone solves 90% of the problem.
  - Plain-language directions: "Back-right of the hall, near the stage."
  - **3D hall map** below.
- **3D map (React Three Fiber):**
  - Build the scene _procedurally from `venue_tables` + `walls`_. No 3D assets, no scanning.
  - Floor plane, extruded wall boxes, tables as cylinders (`CylinderGeometry`, radius = `diameter_m / 2`).
  - **The guest's table glows** — emissive gold, gentle pulse. Everything else muted grey.
  - Table labels as `<Html>` billboards (drei) or `Text` from `troika-three-text`.
  - Camera: start at a 3/4 isometric view over the whole hall, then a smooth `lerp` fly-in to frame the guest's table. This is the "wow" moment — get the easing right.
  - Draw a **path from `venue.entrance` to the guest's table** — a simple tube/line with an animated dash flowing along it. Straight-line-with-a-bend is fine; do not build a pathfinder for a ballroom.
  - `OrbitControls` — but constrain polar angle so they can't get lost under the floor.
- Graceful degradation: if the 3D fails to load (old phone, no WebGL), fall back to a 2D top-down SVG of the same data. Same table still highlighted. Never show a blank screen.
- Photo tab.

### Phase 6 — Photos

Three tiers, distinct trust levels:

| Surface                      | Source              | Moderation                                                                                                  |
| ---------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Live feed** (in guest app) | All uploads         | AI pre-filter only. Auto-approved if clean. Feels alive, low risk.                                          |
| **Ballroom screen**          | Approved queue only | AI filter → **human taps ✓** on a tablet. A planner will not risk their client on an unmoderated projector. |
| **Couple's album**           | Everything          | Unfiltered. Downloadable as a ZIP after the event.                                                          |

- Upload from `/g/{qr_token}` → camera or gallery.
- **Queue uploads in IndexedDB**, background-sync when signal returns. Guest sees "Uploading… will send when you're back online." They won't notice the delay.
- Client-side resize before upload (max 2000px long edge, WebP). Ballroom 4G cannot carry 12MP originals from 200 phones.
- **AI pre-moderation:** on upload, call Gemini 2.5 Flash with the image → structured JSON `{ safe: bool, reason: string }`. Flag nudity, violence, and obviously non-wedding junk (screenshots, memes). Set `status`.
  - `safe` → `pending_human` (eligible for screen) and immediately visible in the live feed
  - `unsafe` → `rejected`, silently hidden from the live feed, still visible to the couple in their private album
- **Moderation queue** for the planner: grid of `pending_human`, tap ✓ / ✗. Must be a 20-second-per-photo job, not a chore.
- **`/(screen)` route:** fullscreen kiosk slideshow. Pulls `approved` photos via Supabase Realtime — new approved photos appear within seconds. Ken Burns pan/zoom, crossfade, couple's names + hashtag in the corner. Runs on the planner's laptop, **wired ethernet if at all possible**, with a local cache of the last N approved photos so a wifi blip doesn't blank the projector mid-dinner.

---

## v2 — AR wayfinding (build only after Phases 1–6 ship)

### What NOT to build

**Do not use WebXR `immersive-ar`.**

- **iOS Safari does not support it. At all. Not behind a flag.** Roughly half of Malaysian wedding guests are on iPhone, and they skew toward exactly the guests the planner cares most about. A feature that silently doesn't exist for half the room is worse than no feature.
- Even on Android, you'd still have to solve **localization**: WebXR's coordinate origin is "wherever the session started" — it has no idea where that is in your ballroom. You'd need printed AprilTag/QR markers on pillars to anchor it.
- Realistic cost: 3–4 weeks, Android-only, and then a planner opens it on their iPhone and asks why it doesn't work.

**Do not use BLE beacons for blue-dot positioning.** Web Bluetooth requires a user-initiated pairing dialog per device — a webapp physically cannot passively scan for beacons. It is not a cost question, it is impossible. And even natively, ±4m accuracy in a room with 2m table spacing puts the dot between three tables.

### What to build instead — AR-lite compass overlay

Works on 100% of phones. ~1 week. 80% of the demo impact.

- **Camera feed** via `getUserMedia({ video: { facingMode: 'environment' } })`. Works on iOS and Android.
- **Localization comes free from the QR scan.** The guest's check-in QR is at a known point — `venue.entrance` — with a known `facing_deg`. When they open AR right after check-in, you know where they are and which way they're pointing. **This is why `venue.entrance` is required in Phase 1.**
- **Rotation only** via `DeviceOrientationEvent` (`webkitCompassHeading` on iOS, `alpha` on Android; request permission on iOS 13+ with `DeviceOrientationEvent.requestPermission()`).
- Overlay a large 3D arrow (Three.js on a transparent canvas over the video) pointing toward `bearing(entrance → table)`.
- Text: **"Table 12 — 18m ahead, slightly left."**
- **No position tracking. No SLAM. No dead reckoning.** The arrow is a compass bearing, not a tracked object. Do not try to make it stick to the floor — it will drift and look broken.
- Always show the table number and the 3D map as a fallback below the AR view. AR is the sizzle; the number is the product.

**Accept the limitation and design around it:** as the guest walks, the bearing goes stale. That's fine — over 20m in a ballroom, the initial bearing plus "you can see the table numbers on the stands" is enough. Do not chase accuracy you cannot have.

---

## Standing engineering rules

- **All geometry in metres.** Convert to pixels only at render. Never persist pixels.
- **The greeter app is the critical path.** Every architectural decision defers to "does this still work in airplane mode?" If a feature can't be cached, it doesn't belong in the greeter app.
- **Idempotent sync.** Check-ins may be submitted multiple times from a flaky connection. Server dedupes on `guest_id`, keeps earliest timestamp.
- **Guest routes are unauthenticated** and gated purely by the HMAC'd `qr_token`. Rate limit them. A token grants read access to _that guest's_ row and write access to photos for that event only. Enforce with Supabase RLS, not app logic.
- **Multi-tenant from day one.** RLS on `org_id` everywhere. Planners will run concurrent events.
- **Never show a blank screen to a guest.** WebGL failed? Show the 2D SVG. Photos won't load? Show the table number. There is always a fallback that still tells them where to sit.
- Client-side compress every image before upload.
- Mobile-first for `/(guest)`. Desktop-first for `/(planner)`. Tablet-first for `/(greeter)`. Projector/kiosk for `/(screen)`. These are genuinely different, do not build one responsive layout and hope.

---

## Priority framing

Three things do three different jobs. Know which is which:

- **Constraint-based auto-allocation** → the feature planners _pay_ for. It removes the part of their job they hate.
- **Venue template library** → the feature that stops them _churning_ after one event.
- **3D map** → the feature that _sells the demo_.

Build all three. Do not let the demo feature eat the paying features' time. And do not let AR eat any of them.
