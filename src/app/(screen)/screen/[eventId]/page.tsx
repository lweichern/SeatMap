'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { getRepo } from '@/lib/repo'
import type { Photo, WeddingEvent } from '@/lib/types'

const SLIDE_MS = 7000
const CACHE_KEY = (id: string) => `seatmap.screen-cache.${id}`

/**
 * Ballroom projector slideshow. Approved photos only. Keeps a local cache of
 * the last N approved photos so a wifi blip never blanks the projector
 * mid-dinner. Ken Burns pan/zoom + crossfade.
 */
export default function ScreenPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [idx, setIdx] = useState(0)
  const idxRef = useRef(0)

  const refresh = useCallback(async () => {
    try {
      const repo = getRepo()
      const [e, approved] = await Promise.all([
        repo.getEvent(eventId),
        repo.listPhotos(eventId, ['approved']),
      ])
      if (e) setEvent(e)
      if (approved.length > 0) {
        setPhotos(approved)
        // cache the newest 30 so connectivity loss doesn't blank the screen
        try {
          localStorage.setItem(
            CACHE_KEY(eventId),
            JSON.stringify({ event: e, photos: approved.slice(0, 30) }),
          )
        } catch {
          /* cache full — keep going with what we have */
        }
      }
    } catch {
      // offline — fall back to the local cache
      const raw = localStorage.getItem(CACHE_KEY(eventId))
      if (raw) {
        const cached = JSON.parse(raw) as { event: WeddingEvent; photos: Photo[] }
        setEvent((e) => e ?? cached.event)
        setPhotos((p) => (p.length > 0 ? p : cached.photos))
      }
    }
  }, [eventId])

  useEffect(() => {
    refresh()
    const poll = setInterval(refresh, 4000)
    return () => clearInterval(poll)
  }, [refresh])

  useEffect(() => {
    const t = setInterval(() => {
      idxRef.current += 1
      setIdx(idxRef.current)
    }, SLIDE_MS)
    return () => clearInterval(t)
  }, [])

  const current = photos.length > 0 ? photos[idx % photos.length] : null
  const next = photos.length > 1 ? photos[(idx + 1) % photos.length] : null

  return (
    <div className="fixed inset-0 cursor-none overflow-hidden bg-black">
      {current ? (
        <div key={current.id + idx} className="kenburns absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.storage_path}
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-2xl text-slate-600">
            {event ? 'Waiting for the first photos…' : 'Loading…'}
          </p>
        </div>
      )}
      {/* preload the next slide so the crossfade never flashes */}
      {next && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={next.storage_path} alt="" className="hidden" />
      )}

      {event && (
        <div className="absolute bottom-8 left-10">
          <p className="text-3xl font-bold text-white/90 drop-shadow-lg">
            {event.couple_names}
          </p>
          <p className="mt-1 text-lg text-white/60">
            #{event.couple_names.replace(/[^\p{L}\p{N}]+/gu, '')}
          </p>
        </div>
      )}

      <style jsx global>{`
        .kenburns {
          animation:
            kb ${SLIDE_MS + 1500}ms ease-in-out forwards,
            fadein 1200ms ease-out;
        }
        @keyframes kb {
          from {
            transform: scale(1) translate(0, 0);
          }
          to {
            transform: scale(1.08) translate(-1.5%, 1%);
          }
        }
        @keyframes fadein {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
