'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { resizeImage } from '@/lib/photos'
import { signToken } from '@/lib/token'
import { getShareOrigin } from '@/lib/share-origin'
import { DEFAULT_LETTER, formatDate, splitCouple } from '@/lib/invite'
import type { InviteConfig, Venue, WeddingEvent } from '@/lib/types'

type PhotoKey = keyof NonNullable<InviteConfig['photos']>

const SLOTS: { key: PhotoKey; title: string; hint: string; tall?: boolean }[] = [
  { key: 'hero', title: 'Hero — the two of you', hint: 'Portrait · opens the invite', tall: true },
  { key: 'bride', title: 'Bride portrait', hint: "the 'her' moment", tall: true },
  { key: 'groom', title: 'Groom portrait', hint: "the 'him' moment", tall: true },
  { key: 'editorial', title: 'Editorial favourite', hint: 'the invitation line' },
  { key: 'candid1', title: 'Candid 1', hint: 'the letter' },
  { key: 'candid2', title: 'Candid 2', hint: 'the letter' },
]

/** Drops empty strings, empty letter arrays, and a photos object with no keys. */
function cleanConfig(cfg: InviteConfig): InviteConfig {
  const letter = (cfg.letter ?? [])
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const photoEntries = Object.entries(cfg.photos ?? {}).filter(([, v]) => !!v)
  return {
    bride_name: cfg.bride_name?.trim() || undefined,
    groom_name: cfg.groom_name?.trim() || undefined,
    rsvp_deadline: cfg.rsvp_deadline || undefined,
    letter: letter.length > 0 ? letter : undefined,
    red_accent: cfg.red_accent,
    photos: photoEntries.length > 0 ? Object.fromEntries(photoEntries) : undefined,
  }
}

/** One drop tile: drag-drop or click to browse, preview, ✕ to clear. */
function PhotoSlot({
  title,
  hint,
  tall,
  photo,
  onChange,
}: {
  title: string
  hint: string
  tall?: boolean
  photo?: string
  onChange: (photo: string | undefined) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(f: File | null | undefined) {
    if (!f) return
    onChange(await resizeImage(f, 1200))
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      className={`relative flex ${
        tall ? 'aspect-[3/4]' : 'aspect-square'
      } cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
        dragOver ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          handleFile(f)
        }}
      />
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={title} className="absolute inset-0 h-full w-full object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onChange(undefined)
            }}
            title="Remove photo"
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-red-500 shadow-sm hover:bg-red-50"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-slate-700">{title}</span>
          <span className="mt-1 text-xs text-slate-400">{hint}</span>
        </>
      )}
    </label>
  )
}

/**
 * The e-invite Studio: drop six labeled photos, fill a short details form,
 * and turn the guest-facing /invite from typography-only into the full
 * photo story. Re-entering with a saved config loads it for editing.
 */
export default function EinvitePage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [config, setConfig] = useState<InviteConfig>({})
  const [startsAt, setStartsAt] = useState('')
  const [existed, setExisted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState('')

  useEffect(() => {
    ;(async () => {
      const repo = getRepo()
      const e = await repo.getEvent(eventId)
      if (!e) return
      const v = await repo.getVenue(e.venue_id)
      setEvent(e)
      setVenue(v)

      const inv = e.invite ?? {}
      const split = splitCouple(e.couple_names)
      setConfig({
        ...inv,
        bride_name: inv.bride_name ?? split.bride ?? '',
        groom_name: inv.groom_name ?? split.groom ?? '',
        letter: inv.letter ?? DEFAULT_LETTER,
      })
      setExisted(!!e.invite && Object.keys(e.invite).length > 0)

      // event.starts_at is "YYYY-MM-DDTHH:MM:SS" or null — pull just "HH:MM".
      const match = e.starts_at?.match(/T(\d{2}:\d{2})/)
      setStartsAt(match ? match[1] : '')
    })()
  }, [eventId])

  function setPhoto(key: PhotoKey, photo: string | undefined) {
    setConfig((c) => ({ ...c, photos: { ...c.photos, [key]: photo } }))
  }

  async function handleSave() {
    if (!event) return
    setSaving(true)
    setSavedUrl(null)
    try {
      const cleaned = cleanConfig(config)
      const starts_at = startsAt ? `${event.event_date}T${startsAt}:00` : event.starts_at
      const nextEvent: WeddingEvent = { ...event, invite: cleaned, starts_at }
      await getRepo().saveEvent(nextEvent)
      setEvent(nextEvent)
      setExisted(true)
      const token = await signToken(nextEvent.id, 'rsvp', nextEvent.guest_token_secret)
      setSavedUrl(`${await getShareOrigin()}/invite/${token}`)
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!savedUrl) return
    try {
      await navigator.clipboard.writeText(savedUrl)
      setCopyNote('Invite link copied ✓')
      setTimeout(() => setCopyNote(''), 4000)
    } catch {
      setCopyNote(savedUrl)
    }
  }

  if (!event) {
    return <div className="mx-auto max-w-2xl px-6 py-10 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/events" className="text-sm text-slate-400 hover:text-slate-700">
          ← Events
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          E-invite studio — {event.couple_names}
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Drop your photos, fill in the details, and the guest-facing invite
        becomes your full photo story.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {SLOTS.map((slot) => (
          <PhotoSlot
            key={slot.key}
            title={slot.title}
            hint={slot.hint}
            tall={slot.tall}
            photo={config.photos?.[slot.key]}
            onChange={(photo) => setPhoto(slot.key, photo)}
          />
        ))}
      </div>

      <div className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Bride&apos;s name</span>
            <input
              value={config.bride_name ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, bride_name: e.target.value }))}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Groom&apos;s name</span>
            <input
              value={config.groom_name ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, groom_name: e.target.value }))}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Ceremony start time</span>
            <input
              type="time"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">RSVP deadline</span>
            <input
              type="date"
              value={config.rsvp_deadline ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, rsvp_deadline: e.target.value }))}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">The letter</span>
          <textarea
            rows={6}
            value={(config.letter ?? []).join('\n')}
            onChange={(e) => setConfig((c) => ({ ...c, letter: e.target.value.split('\n') }))}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={config.red_accent ?? true}
            onChange={(e) => setConfig((c) => ({ ...c, red_accent: e.target.checked }))}
          />
          Bold red her/him section
        </label>

        <p className="text-xs text-slate-400">
          {formatDate(event.event_date)} · {venue?.name ?? '—'} — date & venue come from
          the event
        </p>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : existed ? 'Update e-invite' : 'Create e-invite'}
          </button>
        </div>
      </div>

      {savedUrl && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            {existed ? 'E-invite updated ✓' : 'E-invite created ✓'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={copyLink}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
            >
              Copy invite link
            </button>
            <button
              onClick={() => window.open(savedUrl, '_blank')}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
            >
              Preview
            </button>
          </div>
          {copyNote && <p className="mt-2 text-xs text-emerald-700">{copyNote}</p>}
          <p className="mt-2 text-xs text-emerald-700/70">
            Want a printable poster? Head to Guests → Invite guests ▾ → Invite
            poster (QR).
          </p>
        </div>
      )}
    </div>
  )
}
