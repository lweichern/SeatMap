'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { getRepo } from '@/lib/repo'
import type { Photo, WeddingEvent } from '@/lib/types'

/**
 * Moderation queue: everything the AI passed waits here for a human ✓ before
 * it can reach the ballroom screen. Must be a 20-second-per-photo job.
 */
export default function PhotosModerationPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [pending, setPending] = useState<Photo[]>([])
  const [counts, setCounts] = useState({ approved: 0, rejected: 0, total: 0 })
  const [zipping, setZipping] = useState(false)

  const refresh = useCallback(async () => {
    const repo = getRepo()
    const [e, all] = await Promise.all([
      repo.getEvent(eventId),
      repo.listPhotos(eventId),
    ])
    setEvent(e)
    setPending(all.filter((p) => p.status === 'pending_human'))
    setCounts({
      approved: all.filter((p) => p.status === 'approved').length,
      rejected: all.filter((p) => p.status === 'rejected').length,
      total: all.length,
    })
  }, [eventId])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  async function decide(photo: Photo, approve: boolean) {
    setPending((ps) => ps.filter((p) => p.id !== photo.id))
    await getRepo().updatePhoto(photo.id, {
      status: approve ? 'approved' : 'rejected',
      approved_at: approve ? new Date().toISOString() : null,
    })
    refresh()
  }

  /** Couple's album: EVERYTHING, unfiltered, as a ZIP after the event. */
  async function downloadAlbum() {
    setZipping(true)
    try {
      const [{ default: JSZip }, all] = await Promise.all([
        import('jszip'),
        getRepo().listPhotos(eventId),
      ])
      const zip = new JSZip()
      all.forEach((p, i) => {
        const [meta, b64] = p.storage_path.split(',')
        if (!b64) return
        const ext = meta.includes('webp') ? 'webp' : meta.includes('png') ? 'png' : 'jpg'
        zip.file(`photo-${String(i + 1).padStart(3, '0')}.${ext}`, b64, { base64: true })
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `album-${event?.couple_names.replace(/\s+/g, '-') ?? 'event'}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/events" className="text-sm text-slate-400 hover:text-slate-700">
          ← Events
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          Photos — {event?.couple_names}
        </h1>
        <span className="text-sm text-slate-400">
          {pending.length} waiting · {counts.approved} approved · {counts.rejected} hidden ·{' '}
          {counts.total} total
        </span>
        <div className="ml-auto flex gap-2">
          <a
            href={`/screen/${eventId}`}
            target="_blank"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Open ballroom screen ↗
          </a>
          <button
            onClick={downloadAlbum}
            disabled={zipping || counts.total === 0}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {zipping ? 'Zipping…' : "Couple's album (ZIP)"}
          </button>
        </div>
      </div>

      {pending.length === 0 ? (
        <p className="mt-16 text-center text-sm text-slate-400">
          Queue clear ✨ — new guest photos appear here within seconds.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pending.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.storage_path}
                alt="Pending guest photo"
                className="aspect-square w-full object-cover"
              />
              <figcaption className="flex">
                <button
                  onClick={() => decide(p, true)}
                  className="flex-1 bg-emerald-50 py-3 text-lg font-bold text-emerald-600 hover:bg-emerald-100"
                  title="Approve for the ballroom screen"
                >
                  ✓
                </button>
                <button
                  onClick={() => decide(p, false)}
                  className="flex-1 bg-red-50 py-3 text-lg font-bold text-red-500 hover:bg-red-100"
                  title="Hide from screen and feed"
                >
                  ✗
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
