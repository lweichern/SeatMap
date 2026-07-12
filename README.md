# SeatMap

Wedding event management platform for **wedding planners**: map the hall once, reuse it per event, auto-allocate tables, QR check-in that works with zero bars, and a live photo wall. See [CLAUDE.md](CLAUDE.md) for the full product spec.

## Status

**Phase 1 — Hall editor + venue template library: ✅ built and verified end-to-end** (2026-07-12).

Verified via Playwright against the running app: floor plan upload (PNG/JPG/PDF rasterized), drag-to-set scale, wall polylines, entrance + facing, stage, snap-to-grid tables with auto-labels, marquee multi-select, align/distribute/duplicate-grid, debounced autosave, reload persistence, and venue reuse across layouts.

**Phase 2 — Guest import + auto-allocation: ✅ built and verified end-to-end** (2026-07-13).

Verified via Playwright: event creation on a venue layout, messy-header CSV import (fuzzy detection + manual mapping + preview), inline guest editing with search/filters, seating rules UI, worker-based allocator (must-sit/must-not honored, VIPs nearest stage, group clustering, capacity respected, party sizes counted), drag-to-override, and locked guests surviving re-allocation.

Remaining phases (per CLAUDE.md build order): 3 QR generation + invite export · 4 offline greeter PWA · 5 guest 3D map · 6 photos.

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
