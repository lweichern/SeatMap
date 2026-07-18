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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
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
      <p className="mt-12 px-6 text-center text-[15px] text-(--ink-faint)">
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
    setProgress({ done: 0, total: files.length })
    let ok = 0
    for (const f of files) {
      try {
        await uploadPhoto(eventId, guestId, f)
        ok++
      } catch (err) {
        console.error('upload failed for one photo', err)
      }
      setProgress({ done: ok, total: files.length })
      refresh() // each photo appears in the feed as soon as it lands
    }
    setProgress(null)
    setNote(
      ok === files.length
        ? ok > 1
          ? `${ok} photos shared 🎉`
          : 'Photo shared 🎉'
        : ok > 0
          ? `${ok} of ${files.length} shared — a few didn't make it, try those again.`
          : "Couldn't upload right now — please try again in a moment.",
    )
    setBusy(false)
  }

  return (
    <div className="px-5 pb-12">
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
        className="mx-auto mt-6 block w-full max-w-md rounded-full py-3.5 text-[15px] font-bold tracking-wide text-[#fffdf6] shadow-[0_16px_32px_-14px_rgba(140,105,35,.55)] transition-transform active:scale-[.98] disabled:opacity-60"
        style={{ background: 'linear-gradient(165deg,#c5a04a,#8a6a1f)' }}
      >
        {busy
          ? progress && progress.total > 1
            ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
            : 'Uploading…'
          : '📸 Share photos'}
      </button>
      {!busy && !note && (
        <p className="mt-2 text-center text-xs text-(--ink-faint)">
          You can select several at once
        </p>
      )}
      {note && <p className="mt-2 text-center text-sm text-(--ink-soft)">{note}</p>}

      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2">
        {feed.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.storage_path}
            alt="Wedding moment"
            className="aspect-square w-full rounded-xl border border-(--line) object-cover shadow-[0_8px_18px_-12px_rgba(90,66,20,.45)]"
            loading="lazy"
          />
        ))}
      </div>
      {feed.length === 0 && (
        <p className="gv-display mt-9 text-center text-lg italic text-(--ink-faint)">
          No photos yet — be the first to share one.
        </p>
      )}
    </div>
  )
}
