# Phase 1 — Hall Editor + Venue Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A planner can upload a floor plan, set real-world scale, draw walls, mark entrance/stage, drag-drop 30 labelled tables in under 5 minutes, and save it all as a reusable venue + layout.

**Architecture:** Next.js 15 App Router with a `(planner)` route group. Editor canvas is `react-konva`; all editor state lives in a Zustand store holding geometry **in metres**; conversion to pixels happens only at render. Persistence goes through a small repository interface — Supabase implementation when env vars exist, localStorage implementation otherwise (so the app runs without credentials in dev). SQL schema ships as a Supabase migration.

**Tech Stack:** Next.js 15 (TS, App Router), react-konva + konva, zustand, Tailwind v4, Vitest, pdfjs-dist (PDF rasterize), @supabase/supabase-js, Dexie later (Phase 4 — not now).

## Global Constraints

- **All geometry persisted in metres, never pixels.** Pixels only at render time.
- Multi-tenant columns (`org_id`) present in schema from day one; RLS policies included in migration.
- Route groups: planner surface lives under `src/app/(planner)/`.
- Tables default: `seats = 10`, `shape = 'round'`, `diameter_m = 1.8`.
- Snap-to-grid: 0.5 m.
- Table labels auto-increment (`1`, `2`, `3`… skipping labels already in use).
- Entrance is required data (`{ x, y, facing_deg }`) — wayfinding anchor for later phases.
- Commit after every task. TDD for all pure logic (geometry, labels, alignment, scale).

---

### Task 1: Scaffold Next.js 15 app + Vitest

**Files:**
- Create: entire `create-next-app` scaffold (TS, Tailwind, App Router, src dir, no ESLint prompt stalls — pass all flags)
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Produces: running dev server; `npm test` runs Vitest.

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --app --src-dir --no-eslint --import-alias "@/*" --use-npm --yes` (run in a temp dir and move contents in if CLI refuses non-empty dir; CLAUDE.md + docs/ + .git already exist)
- [ ] **Step 2:** `npm i konva react-konva zustand @supabase/supabase-js pdfjs-dist && npm i -D vitest @vitest/coverage-v8 jsdom`
- [ ] **Step 3:** Add `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

- [ ] **Step 4:** Add `"test": "vitest run"` to package.json scripts. Run `npm test` → "no test files found" is acceptable at this point; `npm run build` → succeeds.
- [ ] **Step 5:** Commit `chore: scaffold next.js 15 + vitest`

### Task 2: Domain types + geometry core (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/geometry.ts`
- Test: `src/lib/geometry.test.ts`

**Interfaces:**
- Produces:
  - Types: `Wall {x1,y1,x2,y2}`, `Entrance {x,y,facing_deg}`, `Stage {x,y,w,h}`, `VenueTable {id,label,x,y,seats,shape,diameter_m,w_m?,h_m?}`, `Venue`, `VenueTableLayout`.
  - `mToPx(m: number, scalePxPerM: number): number`, `pxToM(px: number, scalePxPerM: number): number`
  - `snapToGrid(m: number, grid?: number): number` (default grid 0.5)
  - `deriveScale(linePx: number, knownMetres: number): number` → px per metre; throws on non-positive input
  - `dist(ax,ay,bx,by): number`

- [ ] **Step 1:** Write failing tests covering: round-trip m↔px, snap 3.26→3.5 / 3.24→3.0, deriveScale(400px, 20m) = 20 px/m, deriveScale throws on 0/negative.
- [ ] **Step 2:** Run `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement `geometry.ts` + `types.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: domain types + metre-based geometry core`

### Task 3: Label auto-increment + alignment/distribution algorithms (TDD)

**Files:**
- Create: `src/lib/layout-ops.ts`
- Test: `src/lib/layout-ops.test.ts`

**Interfaces:**
- Produces:
  - `nextLabel(existing: string[]): string` — smallest positive integer (as string) not already used; ignores non-numeric labels like "VIP-1".
  - `alignTables(tables: VenueTable[], ids: string[], axis: 'x'|'y'): VenueTable[]` — sets selected tables' axis coord to the selection's mean.
  - `distributeTables(tables, ids, axis): VenueTable[]` — even spacing between min and max along the axis.
  - `duplicateGrid(tables, ids, opts: {rows, cols, gapM}): VenueTable[]` — clones selection into a rows×cols grid, fresh ids/labels.

- [ ] **Step 1:** Failing tests: nextLabel(["1","2","VIP-1"]) === "3"; nextLabel([]) === "1"; align sets equal y; distribute produces equal gaps; duplicateGrid produces rows*cols*sel copies with unique labels.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: label auto-increment, align/distribute/duplicate ops`

### Task 4: Supabase schema migration + repository layer

**Files:**
- Create: `supabase/migrations/0001_init.sql` (organizations, users, venues, venue_table_layouts, venue_tables, events, guests, guest_constraints, photos, checkin_log — full CLAUDE.md data model, with RLS on org_id)
- Create: `src/lib/repo/types.ts` (`VenueRepo` interface: `listVenues`, `getVenue`, `saveVenue`, `deleteVenue`, `listLayouts`, `getLayout(withTables)`, `saveLayout(layout, tables)`), `src/lib/repo/local.ts` (localStorage impl), `src/lib/repo/supabase.ts`, `src/lib/repo/index.ts` (`getRepo()` picks supabase if `NEXT_PUBLIC_SUPABASE_URL` set, else local)
- Test: `src/lib/repo/local.test.ts` (with in-memory localStorage shim)

**Interfaces:**
- Produces: `getRepo(): VenueRepo`. All geometry fields in metres, matching Task 2 types.

- [ ] **Step 1:** Failing test: save venue → list contains it; saveLayout with 3 tables → getLayout returns them.
- [ ] **Step 2:** FAIL → implement local repo → PASS.
- [ ] **Step 3:** Write migration SQL + supabase repo impl (not integration-tested without credentials; typed against same interface).
- [ ] **Step 4:** Commit `feat: schema migration + venue repository (supabase/local)`

### Task 5: Editor Zustand store

**Files:**
- Create: `src/stores/editor.ts`
- Test: `src/stores/editor.test.ts`

**Interfaces:**
- Produces: `useEditor` store with state `{ venue, layout, tables, selectedIds, tool ('select'|'wall'|'entrance'|'stage'|'scale'), floorplanUrl, scalePxPerM, dirty }` and actions: `addTable(xM,yM)`, `moveTable(id,xM,yM)` (snaps), `updateTable`, `removeSelected`, `setSelection/toggleSelection`, `addWallPoint/finishWall`, `setEntrance`, `setStage`, `setScale`, `align`, `distribute`, `duplicateGrid`, `loadLayout`, `markSaved`. All coords metres.

- [ ] **Step 1:** Failing tests: addTable auto-labels + snaps; moveTable snaps to 0.5m; removeSelected clears selection; align/distribute delegate correctly.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat: editor zustand store (metre-based)`

### Task 6: Floor plan upload + PDF rasterize + scale-setting UI

**Files:**
- Create: `src/lib/floorplan.ts` (`fileToImageUrl(file): Promise<string>` — images pass through as object URL; PDFs rasterized first-page via pdfjs-dist to canvas → dataURL)
- Create: `src/components/editor/ScaleBar.tsx` (drag a line over the plan, type known distance + unit → `setScale(deriveScale(...))`)

**Interfaces:**
- Consumes: `deriveScale` (Task 2), `useEditor.setScale`.
- Produces: `fileToImageUrl`; `<ScaleDialog>` invoked from toolbar.

- [ ] **Step 1:** Implement `floorplan.ts` (browser-only; no unit test — verified in Task 9 run).
- [ ] **Step 2:** Implement scale UI: while `tool==='scale'`, click-drag draws a line on the canvas; on release, prompt panel for distance in metres; compute and store `scalePxPerM`.
- [ ] **Step 3:** Commit `feat: floor plan upload (png/jpg/pdf) + scale setting`

### Task 7: Konva editor canvas

**Files:**
- Create: `src/components/editor/EditorCanvas.tsx` (dynamic import, `ssr:false`), `src/components/editor/TableNode.tsx`, `src/components/editor/WallsLayer.tsx`, `src/components/editor/EntranceMarker.tsx`, `src/components/editor/StageRect.tsx`

**Interfaces:**
- Consumes: `useEditor`, `mToPx/pxToM/snapToGrid`.
- Produces: full editing surface — background floorplan image, tables draggable (snap on drag-end), click select / shift-click multi-select / marquee select, wall polyline tool (click points, double-click/Enter finishes), entrance placement (click sets position, drag sets facing arrow), stage rect drag-out, delete key removes selection.

- [ ] **Step 1:** Implement components. Tables render as circles (radius `diameter_m/2 * scale`) or rects, label centered, selected = accent stroke.
- [ ] **Step 2:** `npm run build` → succeeds.
- [ ] **Step 3:** Commit `feat: konva hall editor canvas`

### Task 8: Editor page + toolbar + debounced persistence

**Files:**
- Create: `src/app/(planner)/layout.tsx` (nav shell), `src/app/(planner)/venues/page.tsx` (venue library list), `src/app/(planner)/venues/[venueId]/layouts/[layoutId]/page.tsx` (editor page), `src/components/editor/Toolbar.tsx`, `src/components/editor/Inspector.tsx` (selected table props: label, seats, shape, diameter)
- Modify: `src/app/page.tsx` → redirect to `/venues`

**Interfaces:**
- Consumes: `getRepo()`, `useEditor`.
- Produces: `/venues` (create/open venue + layout), editor route wiring store↔repo with 800ms debounced save + "Saved ✓ / Saving…" indicator.

- [ ] **Step 1:** Implement pages + toolbar (tools: select, add table, wall, entrance, stage, scale; actions: align H/V, distribute, duplicate grid, delete; zoom controls).
- [ ] **Step 2:** `npm run build` → succeeds.
- [ ] **Step 3:** Commit `feat: planner venue library + editor page with autosave`

### Task 9: End-to-end verification (acceptance)

- [ ] **Step 1:** `npm run dev`; create venue, upload a generated test floor plan PNG, set scale, draw walls, place entrance + stage, add tables incl. drag/snap/multi-select/align/duplicate-grid.
- [ ] **Step 2:** Reload page → layout persists (local repo). Open second layout for same venue → walls/entrance/scale reused, tables fresh.
- [ ] **Step 3:** `npm test` + `npm run build` green.
- [ ] **Step 4:** Commit any fixes; `docs: mark phase 1 acceptance verified` in README.

## Self-Review

- Spec coverage: upload ✓ (T6), scale ✓ (T2/T6), walls ✓ (T7), entrance ✓ (T7 — required), stage ✓ (T7), drag-drop tables + snap + auto-labels ✓ (T3/T5/T7), multi-select/align/distribute/duplicate ✓ (T3/T7/T8), save venue+layout reusable ✓ (T4/T8), metres-only persistence ✓ (global constraint, enforced in store/repo).
- Later phases (guests, QR, greeter, 3D, photos) intentionally out of scope — schema for them ships in T4 so Phase 2+ builds on stable tables.
