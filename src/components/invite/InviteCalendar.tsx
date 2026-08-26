'use client'

import { calendarGrid } from '@/lib/invite'
import { useReveal } from './useReveal'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/**
 * Beat: a month grid (Monday-first) for the wedding date's month, the
 * wedding day itself circled in gold. An optional backdrop photo sits
 * faint and feathered behind the grid. Null when `eventDate` doesn't
 * parse (mirrors `calendarGrid`'s own null).
 */
export function InviteCalendar({
  eventDate,
  backdrop,
}: {
  eventDate: string
  backdrop?: string
}) {
  const ref = useReveal<HTMLElement>()
  const grid = calendarGrid(eventDate)
  if (!grid) return null

  return (
    <section
      ref={ref}
      className="gv-io relative mx-auto max-w-md overflow-hidden px-6 py-14 text-center"
    >
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          loading="lazy"
          className="gv-feather-b absolute inset-0 h-full w-full object-cover opacity-20"
        />
      )}
      <div className="relative">
        <p className="gv-display text-3xl italic">{grid.monthLabel}</p>
        <div className="mx-auto mt-8 max-w-[280px]">
          <div className="grid grid-cols-7 gap-1">
            {DOW.map((d) => (
              <p key={d} className="gv-caps text-[10px] text-(--ink-faint)">
                {d}
              </p>
            ))}
          </div>
          {grid.weeks.map((week, wi) => (
            <div key={wi} className="mt-2 grid grid-cols-7 gap-1">
              {week.map((d, di) => (
                <div key={di} className="flex h-8 items-center justify-center">
                  {d !== null &&
                    (d === grid.day ? (
                      <span className="gv-daypulse flex h-7 w-7 items-center justify-center rounded-full bg-(--gold) text-[13px] font-semibold text-(--card)">
                        {d}
                      </span>
                    ) : (
                      <span className="text-sm text-(--ink-soft)">{d}</span>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
