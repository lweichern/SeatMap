# Hall Editor v2 Implementation Plan (HALL_EDITOR.md port)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 venue editor with the HALL_EDITOR.md production spec: shape system with service kind, door-as-gap, registration desk, A* walking routes with retry ladder, and a live 3D preview that shares geometry with the guest view.

**Architecture:** `lib/table-geometry.ts` is the spine (pure, TDD) — 2D canvas, 3D scene, and pathfinder all import from it. `lib/pathfinding.ts` (pure, TDD) builds the occupancy grid (door gap carved + re-opened), runs 8-dir A* with a retry ladder, string-pulls with the door pinned. `lib/scene-builder.tsx` exports `<HallScene>` used by BOTH the editor's Preview3D and `/g/{token}`. New `components/hall-editor/` replaces `components/editor/`.

**Tech Stack:** existing (Konva, R3F, Zustand). No new deps.

## Global Constraints (verbatim from spec)

- All geometry in METRES; convert only at render (`m2p`/`p2m`).
- Scale calibration gates every downstream tool (disabled buttons).
- Door: snaps onto nearest wall, is a GAP in 2D render + 3D mesh + occupancy grid, width `door_width_m` default 2.4.
- Registration optional, never load-bearing: `origin = registration ?? door`; grid bounds must include it.
- Service kind: `seats IS NULL` (DB constraint), no table numbers, excluded from seat totals/allocation/routing targets, blocks pathfinder with 0.35m pad (vs 0.42+0.18 chair ring).
- Pathfinding: `CELL = 0.3`, `CLEAR = 0.25` default but a venue setting; shape-aware rounded-rect blocking; no diagonal corner-cutting; goal table doesn't block itself; retry ladder [CLEAR, 0.12 squeeze, 0.02 squeeze] → red "NO WALKABLE ROUTE" fallback, never silent.
- String-pull per-leg with the door pinned as a hard waypoint; endpoint from ARRIVAL angle, stop at `edgeDist + 0.30`.
- 3D: 3/4 iso camera, polar clamp, camera never moves on rebuild (reframe only when span changes); canvas-texture SPRITE labels (depthTest false, cached by content+style, roundRect polyfill); route = flat disc core+halo at 0.62m spacing, teal foyer leg / blue hall leg, brightness wave that lands and holds; floor #15120F.
- Inspector: NaN guards (ignore out-of-range), every field triggers 3D rebuild, service shows name (datalist presets) not seats.
- Grid tool: drag rect → R×C ghost in selected shape → auto-numbered rows/serpentine/cols; rotation 0/90/45.
- Oval seats pushed along TRUE surface normal; banquet/square seats on long sides with optional `ends` (head-table case `ends:false`); odd count → extra on one long side.

---

### Task 1: Data model + registry + repo/migration compile-through
`types.ts`: `SHAPES` registry, `Shape`, `Kind`, `TableObj` (alias `VenueTable = TableObj`), Venue gains `door`, `door_width_m`, `registration`, `floorplan_north_offset_deg`, `clear_m`; drops `entrance`. `seatsOf(t)` + `nextTableNumber(tables)` (seating only) in layout-ops. Local repo `read()` migrates old dbs (entrance→door, diameter_m→dia, rect→banquet). Rewrite `0001_init.sql` venue/table columns + `check (kind <> 'service' or seats is null)` (schema never deployed — rewrite beats a fake migration chain). Update allocate/greeter/directions fixtures + code to `dia`/`kind` and `door ?? registration` landmarks. All tests green.

### Task 2: `lib/table-geometry.ts` (TDD)
`seatPositions` (round even ring; oval true-normal; banquet/square long-sides + ends + odd-extra; service []), `halfExtent`, `edgeDist` (round/oval/rect ray-exit), `outerRadius` (ring 0.6 seat / 0.35 service), `footprint` for 2D/3D sizing. Tests: counts, ends on/off, odd counts, oval normal distance ≥ naive, edgeDist along/rot axes, service empty.

### Task 3: `lib/pathfinding.ts` (TDD)
`buildGrid(venue, tables, {clear, goalId})` — bounds include registration+door+tables+walls +1m pad; wall rasterise 0.30m thick skipping door circle then `clearCellsWithin(door)`; rounded-rect/ellipse table blocking (pad = ring + clear); stage blocks; goal excluded. `solve` A* 8-dir no corner cut. `stringPull` LOS. `findPath(venue, tables, targetId)` → retry ladder → door-pinned smoothing → arrival-angle endpoint → `{path, ok, squeeze, doorIndex}`. Tests: interior table ok, waypoints near door, boxed-in → ok:false, tight → squeeze, no cell of final path blocked, endpoint within edgeDist+0.45 of table edge.

### Task 4: editor store + 2D canvas + rail + inspector + shape picker + grid tool
New `stores/editor.ts` (tools: select/calibrate/wall/room/door/registration/stage/place/grid; snap toggle; gridOrder; routeTargetId; scale gating; wall polygon CLOSES on dblclick; door snap via nearest-wall projection). `components/hall-editor/Canvas2D.tsx` (floorplan, walls w/ visible door gap, registration, stage, tables per shape + chair dots from seatPositions, ghost grid, route polyline, red ring on unreachable), `Rail.tsx` (4 steps + validation list), `ShapePicker.tsx`, `Inspector.tsx` (guards, rot 15°, ends, datalist names). Store unit tests: gating, room rect → 4 walls, door snaps to wall, grid numbering orders, service naming skips numbers.

### Task 5: `lib/scene-builder.tsx` + Preview3D
`<HallScene venue tables highlightTableId route>`: floor past walls, wall boxes SPLIT at door + lintel, meshes per spec table (buffet chafing dishes), chairs from seatPositions, stage, registration glow, sprite labels (`lib/labels.ts` texture cache + roundRect polyfill), route discs (two legs, wave), gold pulsing highlight. `Preview3D.tsx`: camera reframe only on span change, polar clamp. Editor page rewired: rail | 2D | right column (3D + inspector); autosave; route re-solve on selection; save-time validation pass.

### Task 6: guest view port
`/g/{token}` renders `<HallScene>` with `findPath` route (origin registration ?? door). Hall2D fallback updated (door gap, registration, shapes). Old `components/editor/*` + `components/guest/Hall3D.tsx` deleted.

### Task 7: E2E acceptance (Playwright)
Criteria 1–8 from the spec: 30-table grid < 5min flow, venue reuse, interior-table route threads aisles, boxed-in red route, seat-count edit updates 3D chairs, labels readable at any orbit (sprites), camera steady while editing, buffet has chafing dishes/no chairs/no number/excluded from seat totals. Merge.
