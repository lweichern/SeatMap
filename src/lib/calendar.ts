interface IcsEvent {
  id: string
  couple_names: string
  event_date: string
}

interface IcsVenue {
  name: string
  address: string
}

const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1')

/** DTEND is exclusive in iCal — one local day past the event date. */
function localPartsDtend(eventDate: string): string {
  const next = new Date(`${eventDate}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(
    next.getDate(),
  ).padStart(2, '0')}` // local parts — toISOString would shift across UTC
}

/** All-day calendar entry for the wedding — works in Apple/Google/Outlook. */
export function buildIcs(ev: IcsEvent, venue: IcsVenue): string | null {
  const d = ev.event_date?.replaceAll('-', '')
  if (!d || d.length !== 8) return null
  const dtend = localPartsDtend(ev.event_date)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SeatMap//EN',
    'BEGIN:VEVENT',
    `UID:seatmap-${ev.id}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${esc(`${ev.couple_names} — Wedding`)}`,
    `LOCATION:${esc([venue.name, venue.address].filter(Boolean).join(', '))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(ev: IcsEvent, venue: IcsVenue): void {
  const ics = buildIcs(ev, venue)
  if (!ics) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'wedding.ics'
  a.click()
  URL.revokeObjectURL(a.href)
}

export function googleCalUrl(
  ev: { couple_names: string; event_date: string },
  venue: IcsVenue,
): string | null {
  const d = ev.event_date?.replaceAll('-', '')
  if (!d || d.length !== 8) return null
  const dtend = localPartsDtend(ev.event_date)
  const text = encodeURIComponent(`${ev.couple_names} — Wedding`)
  const location = encodeURIComponent([venue.name, venue.address].filter(Boolean).join(', '))
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${d}/${dtend}&location=${location}`
}

export function wazeUrl(q: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`
}

export function gmapsUrl(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
