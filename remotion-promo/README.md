# SeatMap promo (Remotion)

A 20s, 9:16 motion-graphics short recreating the "scan QR → walk to your table" wow-moment.
No footage needed — everything is animated in code. Made for TikTok / Reels / Xiaohongshu.

## Preview & edit live
```bash
npm run studio      # opens Remotion Studio in the browser — scrub, tweak, hot-reload
```

## Render the MP4
```bash
npm run render      # → out/promo.mp4  (1080x1920, 30fps)
```

## Where to change things
- `src/Promo.tsx` — all five scenes + copy (headlines, CTA text).
- `src/theme.ts` — colours (gold/cream palette from the app) and fonts.
- `src/components/HallMap.tsx` — the hall grid, highlighted table, walking route.
- `src/components/QRCode.tsx` — the stylised QR (swap for a real QR image if you like).
- `src/Root.tsx` — dimensions / duration / fps.

## Ideas for variants
- Duplicate `Promo.tsx` copy for the "pain" and "e-invite can't do this" hero videos.
- Drop in a real screen-recording later: replace a scene with `<OffthreadVideo src={staticFile('clip.mp4')} />`.
- Add a trending audio track in CapCut after export (keeps this render silent + reusable).
