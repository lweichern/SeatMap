'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { peekToken, verifyToken } from '@/lib/token'
import { monogram, formatDate } from '@/lib/invite'
import { Flourish } from '@/components/guest/Flourish'
import { Hall2D, type HallViewProps } from '@/components/guest/Hall2D'
import { InviteEnvelope } from '@/components/invite/InviteEnvelope'
import { InviteParticles } from '@/components/invite/InviteParticles'
import { InviteHero } from '@/components/invite/InviteHero'
import { InviteCountdown } from '@/components/invite/InviteCountdown'
import { InviteDetails } from '@/components/invite/InviteDetails'
import { InviteBallroom } from '@/components/invite/InviteBallroom'
import { InviteMenu } from '@/components/invite/InviteMenu'
import { InviteRsvp } from '@/components/invite/InviteRsvp'
import type { HallSceneProps } from '@/lib/scene-builder'
import type { Venue, VenueTable, WeddingEvent } from '@/lib/types'

interface Resolved {
  event: WeddingEvent
  venue: Venue
  tables: VenueTable[]
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

        const [venue, layout] = await Promise.all([
          repo.getVenue(e.venue_id),
          repo.getLayout(e.layout_id),
        ])
        if (!venue) return setData(null)

        setData({ event: e, venue, tables: layout?.tables ?? [], greetName, prefill })

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

  const { event, venue, tables, greetName, prefill } = data

  const sceneProps: HallSceneProps = {
    walls: venue.walls,
    door: venue.door,
    doorWidthM: venue.door_width_m,
    registration: venue.registration,
    stage: venue.stage,
    tables,
    highlightTableId: null,
    route: null,
    fallbackSpan: { w: venue.width_m ?? 30, h: venue.height_m ?? 20 },
  }
  const hallProps: HallViewProps = {
    widthM: venue.width_m ?? 40,
    heightM: venue.height_m ?? 25,
    walls: venue.walls,
    door: venue.door,
    doorWidthM: venue.door_width_m,
    registration: venue.registration,
    stage: venue.stage,
    tables,
    guestTableId: null,
  }

  function handleOpen() {
    setOpened(true)
    try {
      sessionStorage.setItem(`invite.opened.${event.id}`, '1')
    } catch {}
  }

  return (
    <Shell>
      {!opened && (
        <InviteEnvelope
          monogram={monogram(event.couple_names)}
          opened={opened}
          onOpen={handleOpen}
        />
      )}
      <div className={!opened ? 'h-[100svh] overflow-hidden' : undefined}>
        <InviteParticles />
        <InviteHero
          coupleNames={event.couple_names}
          dateLine={formatDate(event.event_date)}
          greetName={greetName}
        />
        <InviteCountdown eventDate={event.event_date} />
        <InviteDetails event={event} venue={venue} />
        <InviteBallroom scene={sceneProps} fallback={<Hall2D {...hallProps} />} />
        <InviteMenu menu={event.menu ?? []} />
        <InviteRsvp event={event} prefill={prefill} />
        <footer className="py-16 text-center">
          <p className="gv-caps text-[11px] text-(--ink-faint)">SEATMAP</p>
        </footer>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="gv-shell pb-12">{children}</div>
}
