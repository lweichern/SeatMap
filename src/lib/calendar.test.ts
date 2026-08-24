import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildIcs, downloadIcs, googleCalUrl, wazeUrl, gmapsUrl } from './calendar'

// jsdom is broken in this repo (html-encoding-sniffer@6 requires the ESM-only
// @exodus/bytes via CJS require()), so downloadIcs is exercised against a
// minimal hand-rolled `document` stub in the plain node environment instead.
type FakeAnchor = { href: string; download: string; click: ReturnType<typeof vi.fn> }

const ev = { id: 'evt-1', couple_names: 'Adam & Eve', event_date: '2026-09-12' }
const venue = { name: 'Grand Hall', address: '1 River Road' }

describe('buildIcs', () => {
  it('builds an all-day VEVENT with DTEND one day after the event date', () => {
    const ics = buildIcs(ev, venue)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260912')
    expect(ics).toContain('DTEND;VALUE=DATE:20260913')
    expect(ics).toContain('UID:seatmap-evt-1')
    expect(ics).toContain('SUMMARY:Adam & Eve — Wedding')
    expect(ics).toContain('LOCATION:Grand Hall\\, 1 River Road')
    expect(ics?.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics?.endsWith('END:VCALENDAR')).toBe(true)
  })

  it('rolls DTEND over the month boundary', () => {
    const ics = buildIcs({ ...ev, event_date: '2026-09-30' }, venue)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260930')
    expect(ics).toContain('DTEND;VALUE=DATE:20261001')
  })

  it('rolls DTEND over a year boundary too', () => {
    const ics = buildIcs({ ...ev, event_date: '2026-12-31' }, venue)
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
  })

  it('escapes commas, semicolons, and backslashes in LOCATION', () => {
    const ics = buildIcs(ev, { name: 'Hall; Wing A', address: '1 Road, Suite \\4' })
    expect(ics).toContain('LOCATION:Hall\\; Wing A\\, 1 Road\\, Suite \\\\4')
  })

  it('returns null for a missing/invalid event date', () => {
    expect(buildIcs({ ...ev, event_date: '' }, venue)).toBeNull()
    expect(buildIcs({ ...ev, event_date: '2026-9-1' }, venue)).toBeNull()
  })
})

describe('downloadIcs', () => {
  let created: FakeAnchor[]
  let originalDocument: unknown

  beforeEach(() => {
    created = []
    originalDocument = (globalThis as { document?: unknown }).document
    ;(globalThis as { document?: unknown }).document = {
      createElement: (): FakeAnchor => {
        const a: FakeAnchor = { href: '', download: '', click: vi.fn() }
        created.push(a)
        return a
      },
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(globalThis as { document?: unknown }).document = originalDocument
    vi.restoreAllMocks()
  })

  it('creates an object URL and clicks a download link when the ics is valid', () => {
    downloadIcs(ev, venue)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(created).toHaveLength(1)
    expect(created[0].click).toHaveBeenCalledTimes(1)
    expect(created[0].download).toBe('wedding.ics')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('is a no-op when buildIcs would return null', () => {
    downloadIcs({ ...ev, event_date: '' }, venue)
    expect(created).toHaveLength(0)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

describe('googleCalUrl', () => {
  it('builds a TEMPLATE url with local-part dates and encoded text/location', () => {
    const url = googleCalUrl(ev, venue)
    expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(url).toContain('dates=20260912/20260913')
    expect(url).toContain(`text=${encodeURIComponent('Adam & Eve — Wedding')}`)
    expect(url).toContain(`location=${encodeURIComponent('Grand Hall, 1 River Road')}`)
  })

  it('rolls the end date over a month boundary', () => {
    const url = googleCalUrl({ ...ev, event_date: '2026-09-30' }, venue)
    expect(url).toContain('dates=20260930/20261001')
  })

  it('returns null for an invalid event date', () => {
    expect(googleCalUrl({ ...ev, event_date: '' }, venue)).toBeNull()
  })
})

describe('wazeUrl', () => {
  it('encodes the query and requests navigation', () => {
    expect(wazeUrl('Grand Hall, 1 River Road')).toBe(
      `https://waze.com/ul?q=${encodeURIComponent('Grand Hall, 1 River Road')}&navigate=yes`,
    )
  })
})

describe('gmapsUrl', () => {
  it('encodes the query in a maps search url', () => {
    expect(gmapsUrl('Grand Hall, 1 River Road')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Grand Hall, 1 River Road')}`,
    )
  })
})
