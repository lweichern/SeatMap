'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { LIVE_FEED_STATUSES, uploadPhoto } from '@/lib/photos'
import type { Photo } from '@/lib/types'

interface Props {
  eventId: string
  guestId: string
  photoMode: 'live_feed' | 'moderated_only' | 'off'
}

export function PhotoTab({ eventId, guestId, photoMode }: Props) {
  const [feed, setFeed] = useState<Photo[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setFeed(await getRepo().listPhotos(eventId, [...LIVE_FEED_STATUSES]))
  }, [eventId])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [refresh])

  if (photoMode === 'off') {
    return (
      <p className="mt-10 px-6 text-center text-slate-400">
        Photo sharing isn&apos;t enabled for this event.
      </p>
    )
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setNote('')
    try {
      for (const f of files) await uploadPhoto(eventId, guestId, f)
      setNote(files.length > 1 ? `${files.length} photos shared 🎉` : 'Photo shared 🎉')
      refresh()
    } catch (err) {
      console.error(err)
      setNote("Couldn't upload right now — we'll keep trying, or retry in a moment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 pb-8">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mx-auto mt-4 block w-full max-w-md rounded-full bg-amber-500 py-3.5 text-base font-bold text-slate-900 disabled:opacity-50"
      >
        {busy ? 'Uploading…' : '📸 Share a photo'}
      </button>
      {note && <p className="mt-2 text-center text-sm text-slate-400">{note}</p>}

      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-1.5">
        {feed.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.storage_path}
            alt="Wedding moment"
            className="aspect-square w-full rounded-lg object-cover"
            loading="lazy"
          />
        ))}
      </div>
      {feed.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">
          No photos yet — be the first!
        </p>
      )}
    </div>
  )
}
