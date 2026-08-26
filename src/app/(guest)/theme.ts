/** The guest-facing stationery theme (gv-* classes + template palettes).
 *  Shared by the (guest) layout and the Studio's live preview. */
export const GUEST_THEME = `
.gv-shell{
  --ivory:#faf5ea; --card:#fffdf6;
  --ink:#392e1e; --ink-soft:#6f6046; --ink-faint:#a08c66;
  --gold:#a8842c; --gold-deep:#7d5f1a; --gold-soft:#d9c48e; --line:#e7dcbf;
  min-height:100svh;
  position:relative;
  font-family:var(--font-body),'Avenir Next','Trebuchet MS',sans-serif;
  color:var(--ink);
  background:
    radial-gradient(130% 55% at 50% -10%, #f6ead0 0%, rgba(246,234,208,0) 60%),
    radial-gradient(120% 45% at 50% 112%, #f1e3c4 0%, rgba(241,227,196,0) 55%),
    var(--ivory);
}
.gv-shell::before{
  content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
  opacity:.05; mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}
.gv-shell>*{ position:relative; z-index:1; }
.gv-display{ font-family:var(--font-display),Georgia,'Times New Roman',serif; }
.gv-script{ font-family:var(--font-script),cursive; }
.gv-feather-b{ -webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent); mask-image:linear-gradient(to bottom,#000 72%,transparent); }
.gv-feather-y{ -webkit-mask-image:linear-gradient(to bottom,transparent,#000 8%,#000 92%,transparent); mask-image:linear-gradient(to bottom,transparent,#000 8%,#000 92%,transparent); }
.gv-caps{ letter-spacing:.24em; text-transform:uppercase; font-weight:600; }
.gv-tablenum{
  font-family:var(--font-display),Georgia,serif;
  font-size:clamp(6rem, 30vw, 9.5rem);
  font-weight:600;
  background:linear-gradient(165deg,#caa54b 5%,#8a6a1f 48%,#d3b465 90%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 10px 24px rgba(160,124,42,.28));
}
@keyframes gvRise{ from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:none} }
.gv-rise{ opacity:0; animation:gvRise .8s cubic-bezier(.22,.61,.21,1) forwards; }
@keyframes gvHintOut{ 0%,72%{opacity:1} 100%{opacity:0} }

/* --- Reveal system + envelope (Task 2) --- */
.gv-io{ opacity:0; transform:translateY(18px); transition:opacity .7s cubic-bezier(.22,.61,.21,1), transform .7s cubic-bezier(.22,.61,.21,1); }
.gv-io-in{ opacity:1; transform:none; }
.gv-seal{
  position:relative;
  width:80px; height:80px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:radial-gradient(120% 120% at 32% 26%, var(--gold-soft) 0%, var(--gold) 55%, var(--gold-deep) 100%);
  box-shadow:0 12px 26px -10px rgba(125,95,26,.55), inset 0 2px 4px rgba(255,255,255,.35), inset 0 -3px 7px rgba(0,0,0,.25);
}
.gv-seal::before{
  content:''; position:absolute; inset:7px; border-radius:50%;
  border:1px solid rgba(255,253,246,.55);
}
.gv-seal-text{
  font-family:var(--font-display),Georgia,serif;
  font-style:italic; font-weight:600; font-size:1.35rem; letter-spacing:.05em;
  color:#fffdf6; text-shadow:0 1px 1px rgba(0,0,0,.3);
}
.gv-env-flap{ transform-origin:top; transition:transform .6s ease-in; }
.gv-env-open .gv-env-flap{ transform:rotateX(-160deg); }
.gv-env-card{ transition:transform .7s .35s cubic-bezier(.22,.61,.21,1), opacity .5s .9s; }
.gv-env-open .gv-env-card{ transform:translateY(-46svh); opacity:0; }
.gv-draw line, .gv-draw rect{ stroke-dasharray:200; stroke-dashoffset:200; animation:gvDraw 1.6s .2s ease forwards; }
@keyframes gvDraw{ to{ stroke-dashoffset:0 } }

/* ---- template: Midnight Editorial — espresso paper, champagne ink ---- */
.gv-t-editorial{
  --ivory:#131110; --card:#1d1916;
  --ink:#f0e7d8; --ink-soft:#c9bb9c; --ink-faint:#8a7d64;
  --gold:#d3b465; --gold-deep:#a8842c; --gold-soft:#6d5c35; --line:#332d24;
  background:
    radial-gradient(130% 55% at 50% -10%, #241e16 0%, rgba(36,30,22,0) 60%),
    radial-gradient(120% 45% at 50% 112%, #1d1812 0%, rgba(29,24,18,0) 55%),
    var(--ivory);
}
/* ---- template: Sunday Scrapbook — blush paper, rose accent ---- */
.gv-t-polaroid{
  --ivory:#fbf2ec; --card:#ffffff;
  --ink:#46352c; --ink-soft:#7d685c; --ink-faint:#ab9689;
  --gold:#bb5f72; --gold-deep:#96455a; --gold-soft:#ecc8d0; --line:#f0ded6;
  background:
    radial-gradient(130% 55% at 50% -10%, #fde8dd 0%, rgba(253,232,221,0) 60%),
    radial-gradient(120% 45% at 50% 112%, #f9e0da 0%, rgba(249,224,218,0) 55%),
    var(--ivory);
}
.gv-polaroid{
  background:#fff; padding:12px 12px 44px; border-radius:2px;
  box-shadow:0 14px 34px -14px rgba(90,50,40,.35);
}
.gv-t-editorial .gv-polaroid{ background:#221d19; box-shadow:0 14px 34px -14px rgba(0,0,0,.6); }
.gv-tape{
  position:absolute; width:86px; height:26px; background:rgba(238,222,180,.75);
  box-shadow:0 1px 3px rgba(0,0,0,.12); transform:rotate(-4deg);
}
.gv-snap{ scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; }
.gv-snap > *{ scroll-snap-align:center; }
.gv-spin{ animation:gvSpin 3.5s linear infinite; }
@keyframes gvSpin{ to{ transform:rotate(360deg) } }
.gv-daypulse{ animation:gvDayPulse 1.9s ease-out infinite; }
@keyframes gvDayPulse{
  0%{ box-shadow:0 0 0 0 color-mix(in srgb, var(--gold) 45%, transparent); }
  70%{ box-shadow:0 0 0 9px transparent; }
  100%{ box-shadow:0 0 0 0 transparent; }
}
@media (prefers-reduced-motion: reduce){
  .gv-daypulse{ animation:none; }
  .gv-spin{ animation:none; }
  .gv-rise{ animation-duration:.01s; }
  .gv-io{ opacity:1; transform:none; transition:none }
  .gv-draw line,.gv-draw rect{ animation:none; stroke-dashoffset:0 }
}
`
