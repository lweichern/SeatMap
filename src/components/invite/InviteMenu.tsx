'use client'

import type { MenuItem } from '@/lib/types'
import { useReveal } from './useReveal'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']

/**
 * Beat 6: a tease, not the full list — first 4 courses in the roman-numeral
 * centered stationery style (copied from the guest page's menu tab), only
 * the first course that actually has a photo shows it, then "…and more on
 * the night". `null` when there's no menu at all.
 */
export function InviteMenu({ menu }: { menu: MenuItem[] }) {
  const ref = useReveal<HTMLElement>()

  if (menu.length === 0) return null

  const courses = menu.slice(0, 4)
  const photoIndex = courses.findIndex((m) => m.photo)

  return (
    <section ref={ref} className="gv-io mx-auto max-w-md px-6 py-10">
      <p className="gv-caps text-center text-[11px] text-(--gold)">This evening&apos;s menu</p>
      <ol className="mt-7 space-y-8">
        {courses.map((m, i) => (
          <li key={m.id} className="text-center">
            <p className="gv-display text-base text-(--gold)">{ROMAN[i] ?? i + 1}</p>
            <p className="gv-display mt-1 text-[22px] font-semibold leading-snug">{m.name}</p>
            {m.description && (
              <p className="mt-1 text-sm leading-relaxed text-(--ink-soft)">{m.description}</p>
            )}
            {i === photoIndex && m.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.photo}
                alt={m.name}
                loading="lazy"
                className="mt-3 aspect-video w-full rounded-2xl border border-(--line) object-cover shadow-[0_14px_30px_-18px_rgba(90,66,20,.4)]"
              />
            )}
          </li>
        ))}
      </ol>
      <p className="gv-display mt-8 text-center text-base italic text-(--ink-soft)">
        …and more on the night
      </p>
    </section>
  )
}
