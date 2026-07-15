# SeatMap

Wedding event management platform for **wedding planners**: map the hall once, reuse it per event, auto-allocate tables, QR check-in that works with zero bars, and a live photo wall. See [CLAUDE.md](CLAUDE.md) for the full product spec — and **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** for the illustrated admin → greeter → guest walkthrough.

## Status

**Phase 1 — Hall editor + venue template library: ✅ built and verified end-to-end** (2026-07-12).

Verified via Playwright against the running app: floor plan upload (PNG/JPG/PDF rasterized), drag-to-set scale, wall polylines, entrance + facing, stage, snap-to-grid tables with auto-labels, marquee multi-select, align/distribute/duplicate-grid, debounced autosave, reload persistence, and venue reuse across layouts.

**Phase 2 — Guest import + auto-allocation: ✅ built and verified end-to-end** (2026-07-13).

Verified via Playwright: event creation on a venue layout, messy-header CSV import (fuzzy detection + manual mapping + preview), inline guest editing with search/filters, seating rules UI, worker-based allocator (must-sit/must-not honored, VIPs nearest stage, group clustering, capacity respected, party sizes counted), drag-to-override, and locked guests surviving re-allocation.

**Phase 3 — QR generation + invite export: ✅ built and verified end-to-end** (2026-07-13).

Verified via Playwright: HMAC-signed stateless guest tokens (cross-checked against an independent implementation, stable across re-exports), A4 PDF QR sheet with cut lines (names rendered via canvas so Chinese names print correctly), and per-guest PNG ZIP with sanitised filenames.

**Phase 4 — Offline greeter PWA: ✅ built and verified end-to-end** (2026-07-13).

The CLAUDE.md acceptance test passed literally: event cached to IndexedDB ("✅ Ready for offline — N guests cached"), airplane mode on, 50 guests checked in via locally-HMAC-verified tokens, duplicate scan warns, forged token rejected, walk-in added, check-in undone, app reloaded while offline (service worker shell), wifi restored → all 52 outbox ops auto-synced idempotently into the planner DB with an append-only check-in log.

**Phase 5 — Guest view (table + 3D map): ✅ built and verified end-to-end** (2026-07-13).

Verified via Playwright on a phone viewport: `/g/{token}` resolves and HMAC-verifies statelessly, TABLE number enormous with plain-language directions ("Right in the middle of the hall, near the stage"), procedural 3D hall (React Three Fiber — glowing pulsing gold table, camera fly-in, animated dashed path from the entrance, DOM billboard labels so no font fetch can blank the scene), 2D SVG fallback (`?2d=1` or no WebGL) with the same highlight, and friendly errors for invalid/orphaned tokens. Never a blank screen.

**Phase 6 — Photos: ✅ built and verified end-to-end** (2026-07-13).

Verified via Playwright across three surfaces at once: guest upload with client-side resize (3000px PNG → 17KB WebP), tiered moderation (AI verdict via `/api/moderate` — Gemini 2.5 Flash when `GEMINI_API_KEY` is set, fail-open to the human queue otherwise), live feed shows AI-passed photos immediately, ballroom screen (`/screen/[eventId]`) shows **only** human-approved photos with Ken Burns + crossfade and a local cache against wifi blips, rejected photos vanish from the feed but stay in the couple's unfiltered ZIP album.

**All six CLAUDE.md phases are complete.**

**Hall Editor v2 (HALL_EDITOR.md port): ✅ built and verified** (2026-07-13). Replaces the Phase 1 editor: shape system (round/banquet/square/oval + buffet *service* kind with DB-enforced NULL seats), scale-gated 4-step rail, rectangle-room + trace wall tools, door-as-a-gap (2D render, 3D mesh and pathfinding grid), registration desk in the foyer, grid tool (drag → R×C ghost → row/serpentine/column numbering), A* walking routes desk→door→table with a retry ladder (red "NO WALKABLE ROUTE" — never a silent straight line), desk-to-every-table validation pass, and a live 3D preview (canvas-sprite labels, chafing-dish buffets, route discs with a landing brightness wave, camera that never moves on edits). The guest view renders the SAME `lib/scene-builder` scene with the same route. All 8 acceptance criteria verified via Playwright; 100 unit tests.

v2 AR-lite compass wayfinding remains the designated next step per CLAUDE.md.

## Stack

Next.js 15 (App Router, TS) · react-konva editor canvas · Zustand · Tailwind v4 · Supabase (Postgres/Auth/Storage) · Vitest.

## Development

```bash
npm install
npm run dev     # http://localhost:3000 → /venues
npm test        # unit tests (geometry, layout ops, store, repo)
npm run build
```

Without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app persists to localStorage (dev/demo mode). With them it uses Supabase; apply `supabase/migrations/0001_init.sql` first.

**All geometry is stored in metres** (origin: floor plan top-left). Pixels exist only at render time.
