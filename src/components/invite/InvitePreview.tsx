'use client'

import { useEffect, useRef, useState } from 'react'
import { Cormorant_Garamond, Great_Vibes, Karla } from 'next/font/google'
import { GUEST_THEME } from '@/app/(guest)/theme'
import { DEFAULT_LETTER, formatDate } from '@/lib/invite'
import type { InviteConfig, Venue, WeddingEvent } from '@/lib/types'
import { InviteHero } from './InviteHero'
import { InviteEditorial } from './InviteEditorial'
import { InviteNames } from './InviteNames'
import { InviteRedDuo } from './InviteRedDuo'
import { InviteCalendar } from './InviteCalendar'
import { InviteCountdown } from './InviteCountdown'
import { InviteDetails } from './InviteDetails'
import { InviteRsvp } from './InviteRsvp'
import { InviteLetter } from './InviteLetter'
import { EdHero, EdSplit, EdStrip, PolHero, PolDuo, PolGallery } from './templates'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})
const body = Karla({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' })
const script = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-script' })

/**
 * Live miniature of the guest invite, driven by the Studio's DRAFT config —
 * the real beat components inside a phone frame, scaled with `zoom` and
 * made read-only via pointer-events (scrolling stays on the frame).
 */
export function InvitePreview({
  config,
  event,
  venue,
}: {
  config: InviteConfig
  event: WeddingEvent
  venue: Venue | null
}) {
  const template = config.template ?? 'classic'
  const gallery = (config.gallery ?? []).filter(Boolean)
  const tplClass =
    template === 'editorial' ? 'gv-t-editorial' : template === 'polaroid' ? 'gv-t-polaroid' : ''
  const previewEvent: WeddingEvent = { ...event, invite: config }
  const dateLine = formatDate(event.event_date)

  // Scale the 390px-wide invite to EXACTLY fill the frame's inner width
  const frameRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.85)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const fit = () => setZoom(el.clientWidth / 390)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={`${display.variable} ${body.variable} ${script.variable}`}>
      <style>{GUEST_THEME}</style>
      <div className="overflow-hidden rounded-[28px] border-[6px] border-slate-900 bg-slate-900 shadow-xl">
        <div
          ref={frameRef}
          className="h-[620px] overflow-y-auto overscroll-contain rounded-[22px]"
        >
          {/* zoom keeps layout + scroll math consistent while miniaturizing */}
          <div className={`gv-shell ${tplClass} pb-8`} style={{ width: 390, zoom }}>
            <div className="pointer-events-none">
              {template === 'editorial' ? (
                <EdHero
                  coupleNames={event.couple_names}
                  dateLine={dateLine}
                  greetName="Guest"
                  photo={config.photos?.hero}
                />
              ) : template === 'polaroid' ? (
                <PolHero
                  coupleNames={event.couple_names}
                  dateLine={dateLine}
                  greetName="Guest"
                  photo={config.photos?.hero}
                />
              ) : (
                <InviteHero
                  coupleNames={event.couple_names}
                  dateLine={dateLine}
                  greetName="Guest"
                  photo={config.photos?.hero}
                />
              )}
              {template === 'editorial' && (
                <>
                  <EdSplit
                    bride={config.bride_name}
                    groom={config.groom_name}
                    bridePhoto={config.photos?.bride}
                    groomPhoto={config.photos?.groom}
                  />
                  <EdStrip photos={gallery} />
                </>
              )}
              {template === 'polaroid' && (
                <>
                  <PolDuo
                    bride={config.bride_name}
                    groom={config.groom_name}
                    bridePhoto={config.photos?.bride}
                    groomPhoto={config.photos?.groom}
                  />
                  <PolGallery photos={gallery} />
                </>
              )}
              {template === 'classic' && (
                <>
                  <InviteEditorial photo={config.photos?.editorial} />
                  <InviteNames
                    bride={config.bride_name}
                    groom={config.groom_name}
                    bridePhoto={config.photos?.bride}
                    groomPhoto={config.photos?.groom}
                  />
                  {(config.red_accent ?? true) && (
                    <InviteRedDuo
                      bridePhoto={config.photos?.bride}
                      groomPhoto={config.photos?.groom}
                    />
                  )}
                </>
              )}
              <InviteCalendar eventDate={event.event_date} backdrop={config.photos?.candid1} />
              <InviteCountdown eventDate={event.event_date} />
              {venue && (
                <InviteDetails event={previewEvent} venue={venue} startsAt={event.starts_at} />
              )}
              <InviteLetter
                lines={config.letter ?? DEFAULT_LETTER}
                photos={{ candid1: config.photos?.candid1, candid2: config.photos?.candid2 }}
              />
              <InviteRsvp event={previewEvent} prefill={null} deadline={config.rsvp_deadline} />
              <footer className="py-10 text-center">
                <p className="gv-caps text-[11px] text-(--ink-faint)">SEATMAP</p>
              </footer>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        Live preview · updates as you edit · scroll inside the phone
      </p>
    </div>
  )
}
