'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/venues', label: 'Venues' },
  { href: '/events', label: 'Events' },
] as const

export function NavLinks() {
  const path = usePathname()
  return (
    <nav className="flex gap-5 text-sm">
      {LINKS.map((l) => {
        const active = path.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative pb-0.5 transition-colors ${
              active ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {l.label}
            <span
              className={`absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-[#a8842c] transition-opacity ${
                active ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </Link>
        )
      })}
    </nav>
  )
}
