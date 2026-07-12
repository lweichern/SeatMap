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

No Supabase env vars → app runs on the localStorage repo (`seatmap.v1` key). Each fresh Playwright browser has empty localStorage — create a venue + layout at the start of every script.

## Drive (Playwright)

`playwright` is a devDependency; browsers are cached in `~/Library/Caches/ms-playwright`. ESM scripts outside the repo must import `<repo>/node_modules/playwright/index.mjs` (NODE_PATH is ignored for ESM).

Canvas coordinate math: the Konva stage starts at view offset (40,40), zoom 1, default 20 px/m until scale is set. Page coords = canvas bbox + 40 + world px.

**Gotchas that burned a session:**
- NEVER run `npm run build` while the dev server is up — it wipes `.next` out from under it and every subsequent request 500s. Build first, then start dev (`rm -rf .next` if it happened).
- Re-measure the canvas bounding box after any toolbar content changes (the "Scale not set" badge disappearing changes toolbar height and shifts the canvas).
- Autosave debounce is 800ms — wait ≥1200ms after the last edit, then wait for the `Saved ✓` text before reading localStorage or reloading.
- Konva fires `dblclick` for any two clicks within 400ms even at distant points — keep ≥450ms between scripted canvas clicks unless deliberately testing double-click behavior.
- Read app state directly: `window.__editor.getState()` (dev-only debug handle on the Zustand store) and `JSON.parse(localStorage.getItem('seatmap.v1'))`.

## Flows worth driving

Create venue → new layout → upload floor plan (PNG; PDF exercises pdfjs rasterize) → Scale tool drag + dialog → walls (clicks + Enter) → entrance (press-drag-release) → stage (drag rect) → tables (click place, drag move, marquee, align, duplicate grid) → wait for `Saved ✓` → reload → inspector stats persist → second layout on same venue inherits scale/walls/entrance with zero tables.
