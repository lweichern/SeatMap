---
name: verify
description: Build/launch/drive recipe for verifying SeatMap (Next.js + Konva hall editor) end-to-end
---

# Verifying SeatMap

## Launch

```bash
npm run dev          # Next 15 dev server on :3000 (background it)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/venues   # 200 when up
```

No Supabase env vars → app runs on the SHARED SERVER STORE (`/api/store`, file `.data/store.json`), with localStorage (`seatmap.v1`) only as fallback. To seed a scenario, `PUT /api/store` with the JSON db (curl or fetch) — seeding localStorage no longer takes effect while the API is reachable. Reset with `PUT` body `null`. All browser contexts share this data (that's the point — cross-device demos).

## Drive (Playwright)

`playwright` is a devDependency; browsers are cached in `~/Library/Caches/ms-playwright`. ESM scripts outside the repo must import `<repo>/node_modules/playwright/index.mjs` (NODE_PATH is ignored for ESM).

Canvas coordinate math: the Konva stage starts at view offset (40,40), zoom 1, default 20 px/m until scale is set. Page coords = canvas bbox + 40 + world px.

**Gotchas that burned a session:**
- Build with `NEXT_DIST_DIR=.next-build npm run build` — it outputs to a separate dir so a running dev server's `.next` is untouched (next.config reads the env var; Vercel is unaffected because it doesn't set it). Never run a bare `npm run build` while dev is up.
- ONE dev server per checkout, ever. Two `next dev` processes share `.next` and corrupt each other (unstyled pages, phantom 404s, `[object Object]` overlays, vendor-chunks errors). The `predev` hook (scripts/ensure-single-dev.mjs) now refuses to start a second one. The USER usually runs the dev server in their terminal — probe against theirs instead of starting your own; check `lsof -nP -iTCP:3000 -sTCP:LISTEN` first.
- Re-measure the canvas bounding box after any toolbar content changes (the "Scale not set" badge disappearing changes toolbar height and shifts the canvas).
- Autosave debounce is 800ms — wait ≥1200ms after the last edit, then wait for the `Saved ✓` text before reading localStorage or reloading.
- Konva fires `dblclick` for any two clicks within 400ms even at distant points — keep ≥450ms between scripted canvas clicks unless deliberately testing double-click behavior.
- Read app state directly: `window.__editor.getState()` (dev-only debug handle on the Zustand store) and `JSON.parse(localStorage.getItem('seatmap.v1'))`.

## Flows worth driving

Create venue → new layout → upload floor plan (PNG; PDF exercises pdfjs rasterize) → Scale tool drag + dialog → walls (clicks + Enter) → entrance (press-drag-release) → stage (drag rect) → tables (click place, drag move, marquee, align, duplicate grid) → wait for `Saved ✓` → reload → inspector stats persist → second layout on same venue inherits scale/walls/entrance with zero tables.
