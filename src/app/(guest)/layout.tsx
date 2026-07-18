import { Cormorant_Garamond, Karla } from 'next/font/google'
import type { ReactNode } from 'react'

/**
 * Guest-facing pages dress like the invitation, not like the planner's
 * console: warm ivory paper, ink-brown text, champagne gold. The theme
 * lives on `.gv-shell` so pages opt in explicitly.
 */

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

const body = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

const THEME = `
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
@media (prefers-reduced-motion: reduce){
  .gv-rise{ animation-duration:.01s; }
}
`

export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <style>{THEME}</style>
      {children}
    </div>
  )
}
