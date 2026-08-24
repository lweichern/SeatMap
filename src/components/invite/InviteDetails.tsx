'use client'

import { downloadIcs, googleCalUrl, wazeUrl, gmapsUrl } from '@/lib/calendar'
import { formatDate } from '@/lib/invite'
import { useReveal } from './useReveal'

/** Gold-gradient pill, matching the RSVP page's primary action buttons. */
const BUTTON =
  'flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-center text-sm font-semibold text-[#fffdf6] shadow-[0_10px_22px_-12px_rgba(140,105,35,.6)] transition-transform active:scale-[.98]'
const BUTTON_STYLE = { background: 'linear-gradient(165deg,#c5a04a,#8a6a1f)' }

/**
 * Beat 4: two stationery cards — add-to-calendar, then venue + directions.
 * `event`/`venue` carry only the fields the calendar/maps helpers need.
 */
export function InviteDetails({
  event,
  venue,
}: {
  event: { couple_names: string; event_date: string; id: string }
  venue: { name: string; address: string }
}) {
  const dateRef = useReveal<HTMLDivElement>()
  const venueRef = useReveal<HTMLDivElement>()

  const calUrl = googleCalUrl(event, venue)

  return (
    <section className="mx-auto max-w-md space-y-5 px-6 py-10">
      <div
        ref={dateRef}
        className="gv-io rounded-2xl border border-(--line) bg-(--card) p-6 text-center"
      >
        <p className="gv-display text-xl">{formatDate(event.event_date)}</p>
        <div className="mt-4 flex gap-2">
          {calUrl && (
            <a href={calUrl} target="_blank" rel="noopener" className={BUTTON} style={BUTTON_STYLE}>
              Google Calendar
            </a>
          )}
          <button
            type="button"
            onClick={() => downloadIcs(event, venue)}
            className={BUTTON}
            style={BUTTON_STYLE}
          >
            Apple / .ics
          </button>
        </div>
      </div>

      <div
        ref={venueRef}
        className="gv-io rounded-2xl border border-(--line) bg-(--card) p-6 text-center"
      >
        <p className="gv-display text-xl">{venue.name}</p>
        <p className="mt-1 text-[15px] text-(--ink-soft)">{venue.address}</p>
        <div className="mt-4 flex gap-2">
          <a
            href={wazeUrl(venue.address)}
            target="_blank"
            rel="noopener"
            className={BUTTON}
            style={BUTTON_STYLE}
          >
            Waze
          </a>
          <a
            href={gmapsUrl(venue.address)}
            target="_blank"
            rel="noopener"
            className={BUTTON}
            style={BUTTON_STYLE}
          >
            Google Maps
          </a>
        </div>
      </div>
    </section>
  )
}
