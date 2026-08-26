'use client'

import { use, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { peekToken, verifyToken } from '@/lib/token'
import { monogram, formatDate, DEFAULT_LETTER } from '@/lib/invite'
import { Flourish } from '@/components/guest/Flourish'
import { InviteEnvelope } from '@/components/invite/InviteEnvelope'
import { InviteAudio, type InviteAudioHandle } from '@/components/invite/InviteAudio'
import { useAutoScroll } from '@/components/invite/useAutoScroll'
import { InviteParticles } from '@/components/invite/InviteParticles'
import { InviteHero } from '@/components/invite/InviteHero'
import { InviteEditorial } from '@/components/invite/InviteEditorial'
import { InviteNames } from '@/components/invite/InviteNames'
import { InviteRedDuo } from '@/components/invite/InviteRedDuo'
import { InviteCalendar } from '@/components/invite/InviteCalendar'
import { InviteCountdown } from '@/components/invite/InviteCountdown'
import { InviteDetails } from '@/components/invite/InviteDetails'
import { InviteLetter } from '@/components/invite/InviteLetter'
import { InviteRsvp } from '@/components/invite/InviteRsvp'
import { EdHero, EdSplit, EdStrip, PolHero, PolDuo, PolGallery } from '@/components/invite/templates'
import type { Venue, WeddingEvent } from '@/lib/types'

interface Resolved {
  event: WeddingEvent
  venue: Venue
  greetName: string | null
  prefill: { name?: string; phone?: string } | null
}

/**
 * The full e-invitation: envelope → hero → countdown → details → ballroom
 * orbit → menu tease → RSVP. One link the couple shares everywhere, using
 * the same `rsvp` token slot the plain /rsvp form has always used — a
 * personal guest token in that same slot (`/invite/<guest-token>`) or a
 * `?to=Name` query on the shared link both personalize the greeting and
 * (for a guest token) prefill the RSVP form; neither → a generic greeting.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const search = useSearchParams()
  const [data, setData] = useState<Resolved | null | 'loading'>('loading')
  const [opened, setOpened] = useState(false)
  const audioRef = useRef<InviteAudioHandle>(null)
  // True only when the envelope was tapped THIS page load — a refresh that
  // restores the opened state must not replay the auto-scroll performance.
  const [justOpened, setJustOpened] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const payload = peekToken(token)
        const repo = getRepo()
        const e = payload ? await repo.getEvent(payload.event_id) : null
        if (!e) return setData(null)
        const ok = await verifyToken(token, e.guest_token_secret)
        if (!ok || ok.guest_id === 'kiosk') return setData(null)

        const slot = ok.guest_id
        let greetName: string | null = null
        let prefill: { name?: string; phone?: string } | null = null

        if (slot === 'rsvp') {
          greetName = search.get('to')
        } else {
          const guests = await repo.listGuests(e.id)
          const g = guests.find((x) => x.id === slot)
          if (g) {
            greetName = g.name
            prefill = { name: g.name, phone: g.phone ?? undefined }
          }
        }

        const venue = await repo.getVenue(e.venue_id)
        if (!venue) return setData(null)

        setData({ event: e, venue, greetName, prefill })

        // Reduced motion: initialize already-opened so an animating
        // envelope never mounts. Otherwise honor a prior open this session
        // so back-navigation doesn't re-seal it.
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        let already = false
        try {
          already = sessionStorage.getItem(`invite.opened.${e.id}`) === '1'
        } catch {}
        setOpened(reduced || already)
      } catch {
        setData(null)
      }
    })()
  }, [token, search])

  // Hook must run unconditionally (before the early returns below); it
  // no-ops until the invitation is open and configured for auto-scroll.
  const loadedCfg =
    data !== 'loading' && data ? (data.event.invite ?? null) : null
  useAutoScroll(justOpened && !!loadedCfg && (loadedCfg.auto_scroll ?? true))

  if (data === 'loading') {
    return (
      <Shell>
        <div className="gv-rise pt-36 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-2xl italic text-(--ink-soft)">
            Opening your invitation…
          </p>
        </div>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell>
        <div className="gv-rise mx-auto mt-28 max-w-sm px-6 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-3xl italic">This invitation link isn&apos;t valid</p>
          <p className="mt-3 text-[15px] leading-relaxed text-(--ink-soft)">
            Please check with the couple for the correct link.
          </p>
        </div>
      </Shell>
    )
  }

  const { event, venue, greetName, prefill } = data
  // Absent/null until the Invite Studio has been used for this event — an
  // event with no config keeps the V1 page exactly as it always rendered;
  // every new prop/section below is gated on `cfg`.
  const cfg = event.invite ?? null
  const template = cfg?.template ?? 'classic'
  const gallery = (cfg?.gallery ?? []).filter(Boolean)
  // The red her/him beat and the names collage share the only portrait
  // pair — when the red beat will show them, the collage goes labels-only.
  const redShowsPortraits =
    template === 'classic' &&
    !!cfg &&
    (cfg.red_accent ?? true) &&
    !!cfg.photos?.bride &&
    !!cfg.photos?.groom


  function handleOpen() {
    setOpened(true)
    setJustOpened(true)
    try {
      sessionStorage.setItem(`invite.opened.${event.id}`, '1')
    } catch {}
  }

  return (
    <Shell
      locked={!opened}
      templateClass={
        template === 'editorial' ? 'gv-t-editorial' : template === 'polaroid' ? 'gv-t-polaroid' : ''
      }
    >
      {!opened && (
        <InviteEnvelope
          monogram={monogram(event.couple_names)}
          opened={opened}
          onOpen={handleOpen}
          onTap={() => audioRef.current?.start()}
        />
      )}
      <div className={!opened ? 'h-[100svh] overflow-hidden' : undefined}>
        <InviteParticles />
        {cfg?.music && <InviteAudio ref={audioRef} src={cfg.music} revealed={opened} />}
        {template === 'editorial' ? (
          <EdHero
            coupleNames={event.couple_names}
            dateLine={formatDate(event.event_date)}
            greetName={greetName}
            photo={cfg?.photos?.hero}
          />
        ) : template === 'polaroid' ? (
          <PolHero
            coupleNames={event.couple_names}
            dateLine={formatDate(event.event_date)}
            greetName={greetName}
            photo={cfg?.photos?.hero}
          />
        ) : (
          <InviteHero
            coupleNames={event.couple_names}
            dateLine={formatDate(event.event_date)}
            greetName={greetName}
            photo={cfg?.photos?.hero}
          />
        )}
        {cfg && template === 'editorial' && (
          <>
            <EdSplit
              bride={cfg.bride_name}
              groom={cfg.groom_name}
              bridePhoto={cfg.photos?.bride}
              groomPhoto={cfg.photos?.groom}
            />
            <EdStrip photos={gallery} />
          </>
        )}
        {cfg && template === 'polaroid' && (
          <>
            <PolDuo
              bride={cfg.bride_name}
              groom={cfg.groom_name}
              bridePhoto={cfg.photos?.bride}
              groomPhoto={cfg.photos?.groom}
            />
            <PolGallery photos={gallery} />
          </>
        )}
        {cfg && template === 'classic' && (
          <>
            <InviteEditorial photo={cfg.photos?.editorial} />
            <InviteNames
              bride={cfg.bride_name}
              groom={cfg.groom_name}
              bridePhoto={redShowsPortraits ? undefined : cfg.photos?.bride}
              groomPhoto={redShowsPortraits ? undefined : cfg.photos?.groom}
            />
            {(cfg.red_accent ?? true) && (
              <InviteRedDuo bridePhoto={cfg.photos?.bride} groomPhoto={cfg.photos?.groom} />
            )}
          </>
        )}
        {cfg && <InviteCalendar eventDate={event.event_date} backdrop={cfg.photos?.candid1} />}
        <InviteCountdown eventDate={event.event_date} />
        <InviteDetails event={event} venue={venue} startsAt={cfg ? event.starts_at : undefined} />
        {cfg && (
          <InviteLetter
            lines={cfg.letter ?? DEFAULT_LETTER}
            photos={{ candid1: cfg.photos?.candid1, candid2: cfg.photos?.candid2 }}
          />
        )}
        <InviteRsvp event={event} prefill={prefill} deadline={cfg?.rsvp_deadline} />
        <footer className="py-16 text-center">
          <p className="gv-caps text-[11px] text-(--ink-faint)">SEATMAP</p>
        </footer>
      </div>
    </Shell>
  )
}

function Shell({
  children,
  locked,
  templateClass = '',
}: {
  children: ReactNode
  locked?: boolean
  templateClass?: string
}) {
  // locked (envelope still sealed): no bottom padding + clipped height, so
  // the page cannot rubber-band even a pixel behind the envelope
  return (
    <div
      className={`gv-shell ${templateClass} ${locked ? 'h-[100svh] overflow-hidden pb-0' : 'pb-12'}`}
    >
      {children}
    </div>
  )
}
