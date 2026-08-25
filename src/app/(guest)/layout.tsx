import { Cormorant_Garamond, Great_Vibes, Karla } from 'next/font/google'
import type { ReactNode } from 'react'
import { GUEST_THEME } from './theme'

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

const script = Great_Vibes({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
})


export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} ${script.variable}`}>
      <style>{GUEST_THEME}</style>
      {children}
    </div>
  )
}
