# HALL_EDITOR.md — Phase 1 Build Spec

> Implements **Phase 1** of `CLAUDE.md`: the venue floor plan editor + live 3D preview.
> A working single-file prototype exists (`hall-editor.html`). This spec is the production
> port. Every decision below was arrived at by hitting the bug first — do not re-litigate
> them, and do not "simplify" the sections marked ⚠️.

---

## What this is

The tool a **wedding planner** uses to map a venue once and reuse it for every event there.
Two outputs:

1. **The plan** — walls, door, registration desk, stage, tables, buffet stations. All in metres.
2. **A 3D view generated from that plan** — no scanning, no assets, no 3D modelling. Extrude
   the same numbers.

The 3D view is what the _guest_ sees on wedding day (`/g/{token}`), with their table
highlighted and a walking route drawn from the registration desk. So the editor and the
guest view render from **the same data via the same geometry functions**.

---

## Stack

- **Next.js 15** App Router, TypeScript
- **react-konva** — 2D canvas editor
- **@react-three/fiber** + **@react-three/drei** — 3D preview
- **Zustand** — editor state, persisted to Supabase on debounce
- **Supabase** — Postgres + Storage

---

## ⚠️ THE ONE RULE

**All geometry is stored in METRES. Never pixels.**

Convert to pixels only at render time (`m2p()` / `p2m()`). The moment someone re-uploads a
floor plan at a different DPI, a pixel-based layout is garbage. This is not negotiable and
it is not a style preference.

Corollary: **the scale calibration step gates everything.** No scale set → the table tools
are disabled. Without it, a "1.8m table" is a circle of arbitrary size and the 3D view is a
cartoon rather than a model.

---

## Data model

```ts
type Shape = "round" | "banquet" | "square" | "oval" | "buffet";
type Kind = "seat" | "service";

// SHAPES is the single registry. Kind is derived from it, never stored separately.
const SHAPES: Record<Shape, { label: string; kind: Kind; defaults: object }> = {
  round: { label: "Round", kind: "seat", defaults: { seats: 10, dia: 1.8 } },
  banquet: {
    label: "Banquet",
    kind: "seat",
    defaults: { seats: 8, len: 2.4, wid: 0.9, rot: 0, ends: true },
  },
  square: {
    label: "Square",
    kind: "seat",
    defaults: { seats: 8, len: 1.5, wid: 1.5, rot: 0, ends: true },
  },
  oval: {
    label: "Oval",
    kind: "seat",
    defaults: { seats: 12, len: 2.6, wid: 1.5, rot: 0 },
  },
  buffet: {
    label: "Buffet",
    kind: "service",
    defaults: { len: 3.0, wid: 0.8, rot: 0 },
  },
};

interface Venue {
  id: string;
  org_id: string;
  name: string; // "Grand Ballroom @ Hilton KL"
  floorplan_url: string;
  scale_px_per_metre: number; // from the calibration drag
  walls: Wall[]; // metres
  door: { x: number; y: number }; // ON a wall. A gap, not a marker. See ⚠️ below.
  door_width_m: number; // default 2.4
  registration: { x: number; y: number } | null; // OUTSIDE the walls, in the foyer
  stage: { x: number; y: number; w: number; h: number } | null;
  floorplan_north_offset_deg: number | null; // for v2 AR. Capture it now, it's one tap.
}

interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} // metres

interface TableObj {
  id: string;
  layout_id: string;
  shape: Shape;
  kind: Kind; // denormalised from SHAPES for query convenience
  label: string; // "12" for seating, "Buffet — Seafood" for service
  x: number;
  y: number; // centre, metres
  rot: number; // degrees, 0 for round
  // seating only
  seats?: number;
  dia?: number; // round
  len?: number;
  wid?: number; // banquet / square / oval / buffet
  ends?: boolean; // banquet/square: seat the short ends?
  locked?: boolean; // pinned; excluded from re-allocation
}
```

**Constraint:** `kind='service'` rows must have `seats IS NULL`. Enforce it in the DB, not
just the app.

---

## Module layout

```
lib/
  table-geometry.ts     ← seatPositions, halfExtent, edgeDist, outerRadius. PURE FUNCTIONS.
  pathfinding.ts        ← buildGrid, solve (A*), stringPull, findPath
  scene-builder.ts      ← builds the R3F scene from Venue + TableObj[]
components/
  hall-editor/
    Canvas2D.tsx        ← react-konva
    Preview3D.tsx       ← R3F
    Rail.tsx            ← the 4-step left panel
    Inspector.tsx       ← selected-object properties
    ShapePicker.tsx
```

**`lib/table-geometry.ts` is the spine.** The 2D canvas, the 3D scene, and the pathfinder
all import from it. They physically cannot disagree about where a chair is. Do not inline
chair-ring maths anywhere else — that is exactly how the prototype's 2D and 3D drifted apart.

---

## Step 1 — Scale calibration

- User drags a line across a known dimension on the uploaded floor plan.
- Modal: "How long is that line?" → metres.
- Derive `scale_px_per_metre = pixel_length / metres`.
- **Gate every downstream tool on this.** Disabled buttons, not silent failure.

---

## Step 2 — Walls

Two tools:

- **Trace** — click each corner, double-click to close the polygon.
- **Rectangle room** — drag a box, get 4 walls. Covers 80% of ballrooms in one gesture.

Snap to 0.5m grid (toggleable).

Once closed, save to the **venue**, not the event. This is the reusable part.

---

## Step 3 — Door, registration desk, stage

### ⚠️ The door is a GAP, not a marker

This is the part most likely to be got wrong. The door must:

1. **Snap onto the nearest wall segment** when placed. Project the click onto each wall
   (clamped 0..1 along the segment), take the nearest. A door floating in open space is a bug.
2. **Be carved out of the wall** — in the 2D render, the 3D mesh, _and the pathfinding
   occupancy grid_. All three.
3. Have a **width** (`door_width_m`, default 2.4).

Without (2), one of two things is true and both are broken: either walls don't block at all
(and routes clip through brick), or walls fully block (and the foyer is unreachable).

```ts
// In buildGrid: rasterise walls as blocked, but SKIP cells inside the door circle.
for (const w of walls) {
  for (each point p along w) {
    if (dist(p, door) < door_width_m/2) continue;   // ← the gap
    blockCellsAround(p, 0.30);
  }
}
// Then explicitly RE-OPEN the doorway. The 0.30m wall thickening above bleeds back in
// from both jambs and can seal a narrow door.
clearCellsWithin(door, door_width_m/2);
```

### Registration desk

Lives **outside the walls**, in the foyer. This is where the guest actually is when they're
told their table, so it's the origin of the walking route.

Optional — if unset, routes start at the door. **Optional features must never be
load-bearing:** `const origin = registration ?? door`.

The occupancy grid's bounds must include it. It's outside the hall, so a bounding box
computed from walls alone will exclude it and A\* will have nowhere to start.

### Stage

Drag a box. Blocks pathfinding. Used later to seed VIP tables (nearest-to-stage).

---

## Step 4 — Tables

### Shape picker

Round / Banquet / Square / Oval / **Buffet (service)**.

### ⚠️ Service objects are a different KIND, not a table with zero seats

A buffet modelled as `seats: 0` leaks into three places and breaks all of them:

- **Table numbering** — a buffet must not consume number 13, or the guest sent to Table 13
  finds a tray of prawns. `nextTableNumber()` walks seating tables only.
- **Capacity totals** — every seat sum goes through `seatsOf(t)`, which returns 0 for service.
  The HUD reads "15 tables · 150 seats · 3 stations". Separate counts, separate things.
- **Allocation** — the Phase 2 allocator would happily seat Auntie Mei at the dessert station.
- **Routing** — guests are never routed _to_ a buffet. Filter the target list.

Service objects **do** still block the pathfinder — but with a **0.35m queuing pad** instead
of the 0.60m chair ring, because there are no chairs, just people standing.

Names come from a free-text field with a datalist of presets: `Buffet — Seafood`,
`Buffet — Vegetarian`, `Buffet — Mains`, `Buffet — Desserts`, `Buffet — Salads`,
`Drinks Bar`, `Cake Table`, `Gift Table`, `Photo Booth`.

### Grid tool — the thing that makes this fast

Placing 30 tables one at a time is a 5-minute chore. Ballroom layouts are grids. So:

- Drag a rectangle → "6 × 5" → 30 tables auto-spaced and auto-numbered.
- **Numbering order** matters and halls genuinely differ: row-by-row, **serpentine**
  (boustrophedon), or column-by-column. Offer all three; let them override any label after.
- Live ghost preview of the grid while dragging, in the selected shape.

Drag-and-drop is then for _adjustment_ — nudging the VIP table nearer the stage, pulling one
away from a pillar. Humans are good at that; grid tools aren't.

### Snapping

0.5m grid, toggleable. **Not optional in practice** — turn it off and everything ends up 3cm
out of alignment, which looks fine in 2D and like garbage in 3D.

### Rotation

0–345° in 15° steps in the inspector. The grid tool offers 0 / 90 / 45 only — those are the
ones planners actually use. A chapel layout is Banquet + 90° + 2 cols × 4 rows.

---

## `lib/table-geometry.ts`

```ts
// Seat positions in WORLD metres + each chair's facing angle.
// Service stations return []. This is the ONLY place chair positions are computed.
export function seatPositions(
  t: TableObj,
): { x: number; y: number; a: number }[] {
  if (t.kind === "service") return [];
  const CH = 0.42; // chair offset from the table edge
  const rot = ((t.rot ?? 0) * Math.PI) / 180;
  const rotate = (x, y) => [
    t.x + x * Math.cos(rot) - y * Math.sin(rot),
    t.y + x * Math.sin(rot) + y * Math.cos(rot),
  ];

  if (t.shape === "round") {
    const r = t.dia! / 2 + CH;
    return range(t.seats!).map((i) => {
      const a = (i / t.seats!) * Math.PI * 2;
      return { x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, a };
    });
  }

  if (t.shape === "oval") {
    // ⚠️ Push each seat out along the ellipse's TRUE SURFACE NORMAL.
    // Naively spacing by angle bunches chairs at the flat ends and gaps at the curves.
    const A = t.len! / 2,
      B = t.wid! / 2;
    return range(t.seats!).map((i) => {
      const th = (i / t.seats!) * Math.PI * 2;
      const px = A * Math.cos(th),
        py = B * Math.sin(th);
      let nx = Math.cos(th) / A,
        ny = Math.sin(th) / B;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const [wx, wy] = rotate(px + nx * CH, py + ny * CH);
      return { x: wx, y: wy, a: Math.atan2(ny, nx) + rot };
    });
  }

  // Rectangular: run seats along the LONG SIDES, optionally cap the ends.
  // `ends: false` is the head-table case — the couple faces the room.
  // Odd seat counts put the extra chair on one long side.
  // ... (see prototype)
}

// Distance from centre to edge along a world-space angle.
// ⚠️ Needed because a 6m banquet table has no meaningful "radius" — a circular stop
// distance would end the walking path a metre out in mid-air.
export function edgeDist(t: TableObj, ang: number): number {
  if (t.shape === "round") return t.dia! / 2;
  const a = ang - ((t.rot ?? 0) * Math.PI) / 180; // into table-local space
  const cx = Math.cos(a),
    cy = Math.sin(a);
  if (t.shape === "oval")
    return 1 / Math.hypot(cx / (t.len! / 2), cy / (t.wid! / 2));
  const tx = Math.abs(cx) < 1e-6 ? Infinity : t.len! / 2 / Math.abs(cx);
  const ty = Math.abs(cy) < 1e-6 ? Infinity : t.wid! / 2 / Math.abs(cy);
  return Math.min(tx, ty); // whichever face the ray exits
}

export const outerRadius = (t: TableObj) => {
  const [hx, hy] = halfExtent(t);
  const ring = t.kind === "service" ? 0.35 : 0.42 + 0.18;
  return Math.hypot(hx, hy) + ring;
};
```

---

## `lib/pathfinding.ts` — walking routes

Guests walk **around** tables, not through them. The route is **desk → door → table**.

```ts
const CELL = 0.3; // metres per grid cell
const CLEAR = 0.25; // walking clearance beyond the chair ring
```

### ⚠️ CLEAR is the number that breaks everything

Do the arithmetic before you touch it. Tables 1.8m Ø, spaced 3.8m centre-to-centre.
Blocked radius = `0.9 + 0.42 + 0.18 + CLEAR`.

- `CLEAR = 0.55` → blocked radius 2.05m → two neighbours project 4.1m into a 3.8m gap →
  **every interior aisle is sealed**. A\* fails for every table in the middle of the grid,
  falls back to a straight line, and the path cuts through six tables. This is the bug that
  cost the most time.
- `CLEAR = 0.25` → blocked radius 1.75m → a real ~1.3m aisle survives.

`CELL = 0.3` (not 0.4) so a narrow aisle survives rasterisation — at coarser cells a 1.3m
gap can quantise to zero depending on where the grid lines fall.

Expose `CLEAR` as a **venue setting**, not a constant. It encodes "how much room does a
person need to squeeze past a seated guest," and a packed Malaysian banquet answers that
differently from a Western sit-down.

### Shape-aware blocking

Rectangles must block as **rotated rounded-rectangles**, not circles.

```ts
// inverse-rotate the test point into table-local space, then:
if (shape === "oval") {
  hit = (lx * lx) / (a * a) + (ly * ly) / (b * b) < 1;
} else {
  // Rounded rect. ⚠️ Square corners over-block the diagonals and seal aisles that are
  // genuinely passable.
  const qx = Math.max(Math.abs(lx) - hx, 0);
  const qy = Math.max(Math.abs(ly) - hy, 0);
  hit = qx * qx + qy * qy < pad * pad;
}
```

### A\*

- 8-directional, Euclidean heuristic.
- **No diagonal corner-cutting.** Block a diagonal move if either orthogonal neighbour is
  blocked — in the real world that gap doesn't exist, and without this the path walks
  through a chair.
- **The goal table does not block itself.** Otherwise A\* can never reach it.

### ⚠️ Retry ladder — never fall back to a straight line silently

A straight line through six tables isn't a degraded answer, it's a _wrong_ answer that looks
like a real one. Failures must be loud.

```ts
for (const [clear, squeeze] of [
  [CLEAR, false],
  [0.12, true],
  [0.02, true],
]) {
  const path = solve(from, toTable, clear);
  if (path) return { path, ok: true, squeeze };
}
return { path: [from, toTable], ok: false, squeeze: false }; // and RENDER IT RED
```

- `ok: false` → trail turns **red**, label reads **"NO WALKABLE ROUTE"**. This is a layout
  bug the planner needs to fix before wedding day.
- `squeeze: true` → **amber**, "tight squeeze". Guests can get there, but they're brushing
  past chairs.

**Validation pass:** run A* from the desk to *every\* seating table on save. Flag the
unreachable ones in the UI. Five-line loop, catches a real class of error.

### String-pulling

Raw grid A\* gives a 40-step staircase. Walk the path and drop every waypoint you can see
past (line-of-sight test against the blocked grid). Turns it into the handful of real turns
a human would actually walk.

### ⚠️ Pin the door before string-pulling

This one is subtle and will bite you. The smoother only tests grid _cells_. A straight line
from the desk to a table can slip diagonally through the single open door cell while
visually cutting the corner **through solid wall**.

Fix: find the path index nearest the door, split there, smooth each leg **independently**,
and force the door coordinate as a hard waypoint between them.

```ts
const di = indexNearest(rawPath, door);
const legA = stringPull(rawPath.slice(0, di + 1), grid);
const legB = stringPull(rawPath.slice(di), grid);
path = [...legA.slice(0, -1), doorPoint, ...legB.slice(1)];
```

### Endpoint

⚠️ Compute the approach angle from the **direction the path actually arrives from** (the
second-to-last waypoint), **not** the straight-line bearing from the origin. When a route
curves around the room, those differ, and using the bearing terminates the trail on the
wrong edge — pointing at nothing.

Stop distance: `edgeDist(table, arrivalAngle) + 0.30`. The dots should visibly touch the
table, not hover a metre off it.

---

## 3D preview

Generated procedurally. **No assets.**

### Camera

- **3/4 isometric.** Not top-down — top-down is a floor plan with extra steps, every table
  is an identical circle, and all depth cues are lost.
- OrbitControls, **polar angle clamped** (~15°–75°) so they can't end up under the floor.
- ⚠️ **Rebuilding the scene must never touch the camera.** Only reframe when the room's
  bounding span actually changes. Otherwise editing a seat count yanks the zoom back to
  default on every keystroke, and the editor feels broken without anyone being able to say why.

### Geometry

| Object            | Mesh                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| Floor             | Plane, extends past the walls to cover the foyer                               |
| Walls             | Boxes, 3m tall, **split around the doorway**                                   |
| Door              | Lintel box above the gap — reads as a doorway, not a hole                      |
| Round table       | Cylinder + centre pedestal                                                     |
| Oval table        | Unit cylinder, `scale(len, 1, wid)`                                            |
| Banquet/Square    | Box + 4 corner legs                                                            |
| Buffet            | Box, stands taller (0.88m), + **chafing dishes** (pan box + half-cylinder lid) |
| Chairs            | Boxes, positioned from `seatPositions()`                                       |
| Stage             | Box                                                                            |
| Registration desk | Box + soft floor glow                                                          |

Chafing dishes are what make a buffet legible as a buffet rather than a long brown table.
Worth the 10 lines.

### Highlight

The guest's table: emissive gold, pulsing (`sin(t)` on `emissiveIntensity`), plus a soft
light shaft above. Everything else muted grey. Buffets are warm brown-red — a third,
clearly non-seating colour.

### ⚠️ Labels: canvas-texture SPRITES, not 3D text

Every table number, plus `STAGE`, `REGISTRATION`, `DOOR`.

Sprites billboard toward the camera, so text is **never edge-on**. Extruded or
plane-mapped text vanishes at exactly the angle you orbit to when trying to read it.

- Render text to an offscreen canvas → `THREE.CanvasTexture` → `THREE.Sprite`.
- `depthTest: false`, `renderOrder: 999` — labels draw **on top of geometry**.
  Counter-intuitive in 3D, but correct: a table number hidden behind a wall is useless.
  Signage should read through obstacles, like a hanging sign in a real ballroom.
- `minFilter/magFilter = LinearFilter` — no mipmaps, keeps small text crisp.
- **Cache textures by content+style.** 24 labels re-rasterised on every keystroke is
  expensive, and you rebuild on every inspector change. Dispose materials on teardown;
  deliberately do **not** dispose cached textures.
- **Polyfill `ctx.roundRect`** — Safari only shipped it in 16.4 and a good share of guests
  are on older iPhones. Guard with `typeof CanvasRenderingContext2D !== 'undefined'`.

Hierarchy: guest's table = large gold badge, floats higher, gentle bob, seat-count subtitle.
Every other table = small muted chip. Scanning a 24-table room, the eye lands on the gold one.

### ⚠️ Walking route render

- Flat **discs on the floor**, not spheres. A 0.08m sphere at a 30m 3/4 camera is a 3-pixel
  dot — invisible. A disc presents its full face to the camera and reads as a footprint.
- Two layers per dot: bright **core** + soft **halo**. The halo makes it read as a light
  rather than a sticker.
- Spacing **0.62m along the curve** — spaced by real distance, not by percentage, so the
  rhythm is constant regardless of route length. Fewer larger dots beat more small ones;
  dense small dots blur into a smudge at distance.
- **Two-colour legs:** foyer walk **teal**, in-hall walk **blue**. The guest sees at a glance
  where the hall begins. Split at the door index.
- **Brightness wave** sweeping desk → table. Dots are _static_; a wave of brightness travels
  through them (runway sequence lights). Squared falloff so it reads as a discrete pulse, not
  a gradient sloshing. It **overshoots and holds** rather than wrapping — a looping wave says
  "track", a landing wave says "destination".
- Resting opacity 0.55 — the path is fully legible even when the wave isn't on it. The wave
  adds _direction_, it isn't what makes the path visible.
- Darken the floor (`#15120F`). Cheapest contrast win available.

---

## Inspector

Select any object → edit label/name, seats, dimensions, rotation. Delete.

⚠️ **Guard against half-typed values.** Clearing a number field to retype leaves it briefly
empty, which parses to `NaN` and poisons the geometry. Ignore any value outside its valid
range until it's a real number:

```ts
const v = parseInt(el.value, 10);
if (!Number.isFinite(v) || v < lo || v > hi) return; // don't commit
```

⚠️ **Every inspector field must trigger a 3D rebuild.** In the prototype, seats updated the
data and the 2D canvas but not the 3D chair ring. Easy to miss, looks like a deep bug.

Service objects show a **name** field, no seats field. Seating tables show seats, no name.

---

## Acceptance criteria

1. Blank PDF → 30-table labelled layout in **under 5 minutes**.
2. Second event at the same venue reuses the walls/door/stage with **zero** re-tracing.
3. Click any table → the walking route re-solves and threads the aisles. **Interior tables
   route correctly, not just perimeter ones.** (If a middle table draws a straight line
   through six others, `CLEAR` is too high — see above.)
4. A boxed-in table renders a **red** path and says NO WALKABLE ROUTE.
5. Set a table to 6 seats → the 3D chair ring immediately shows 6 chairs.
6. Orbit to any angle → every table number is still readable.
7. Editing any field does **not** move the camera.
8. Buffets appear in the 3D view with chafing dishes, have no chairs, consume no table
   numbers, and are excluded from the seat total.

---

## Things NOT to build here

- **No LiDAR / photogrammetry.** Decided in `CLAUDE.md`. A scan still needs a human to label
  "this blob is Table 7."
- **No pathfinding for the 3D fly-in animation.** Straight lerp.
- **No AR.** That's v2, and it's a compass overlay, not WebXR. See `CLAUDE.md`.
- **No PDF table auto-detection yet.** Planners will ask ("the hall's PDF already has 30
  numbered circles"). Hough circles or a Gemini vision call gets 80–90%. But build it later,
  as a _seeding_ step that dumps tables onto the canvas — the manual editor stays the source
  of truth and catches the errors. Never make import the only path.
