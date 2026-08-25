'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { resizeImage } from '@/lib/photos'
import { InvitePreview } from '@/components/invite/InvitePreview'
import { samplePhotos } from '@/components/invite/sampleConfig'
import { signToken } from '@/lib/token'
import { getShareOrigin } from '@/lib/share-origin'
import { DEFAULT_LETTER, formatDate, splitCouple } from '@/lib/invite'
import type { InviteConfig, Venue, WeddingEvent } from '@/lib/types'

type PhotoKey = keyof NonNullable<InviteConfig['photos']>

const SLOTS: { key: PhotoKey; title: string; hint: string; dims: string; tall?: boolean }[] = [
  {
    key: 'hero',
    title: 'Hero — the two of you',
    hint: 'opens the invite full-screen',
    dims: 'portrait 4:5 · ≥1080×1350 (Scrapbook crops the centre square)',
    tall: true,
  },
  {
    key: 'bride',
    title: 'Bride portrait',
    hint: "the 'her' moment",
    dims: 'portrait 3:4 · ≥1080×1440',
    tall: true,
  },
  {
    key: 'groom',
    title: 'Groom portrait',
    hint: "the 'him' moment",
    dims: 'portrait 3:4 · ≥1080×1440',
    tall: true,
  },
  {
    key: 'editorial',
    title: 'Editorial favourite',
    hint: 'the invitation line (Golden Letter)',
    dims: 'portrait 3:4 · ≥1080×1440',
  },
  {
    key: 'candid1',
    title: 'Candid 1',
    hint: 'the letter + calendar backdrop',
    dims: 'square-ish · ≥800×800',
  },
  {
    key: 'candid2',
    title: 'Candid 2',
    hint: 'the letter',
    dims: 'any shape · ≥800px wide',
  },
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
    template: cfg.template && cfg.template !== 'classic' ? cfg.template : undefined,
    gallery: (cfg.gallery ?? []).filter(Boolean).length > 0 ? (cfg.gallery ?? []).filter(Boolean).slice(0, 6) : undefined,
    music: cfg.music || undefined,
    auto_scroll: cfg.auto_scroll, // explicit false must survive
    photos: photoEntries.length > 0 ? Object.fromEntries(photoEntries) : undefined,
  }
}

/** One drop tile: drag-drop or click to browse, preview, ✕ to clear. */
function PhotoSlot({
  title,
  hint,
  dims,
  tall,
  photo,
  onChange,
}: {
  title: string
  hint: string
  dims?: string
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
          {dims && (
            <span className="mt-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              {dims}
            </span>
          )}
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
  const [sampleMode, setSampleMode] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
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
    const wasUpdate = existed
    try {
      const cleaned = cleanConfig(config)
      const starts_at = startsAt ? `${event.event_date}T${startsAt}:00` : event.starts_at
      const nextEvent: WeddingEvent = { ...event, invite: cleaned, starts_at }
      await getRepo().saveEvent(nextEvent)
      setEvent(nextEvent)
      setExisted(true)
      setJustCreated(!wasUpdate)
      const token = await signToken(nextEvent.id, 'rsvp', nextEvent.guest_token_secret)
      setSavedUrl(`${await getShareOrigin()}/invite/${token}`)
    } catch (e) {
      alert(`Couldn't save the e-invite: ${(e as { message?: string })?.message ?? e}`)
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
    <div className="mx-auto max-w-6xl px-6 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      <div className="mx-auto w-full max-w-2xl">
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

      {/* template picker */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            {
              key: 'classic',
              name: 'Golden Letter',
              vibe: 'ivory · gold · serif',
              sw: ['#faf5ea', '#a8842c', '#392e1e'],
              uses: 'Hero, Bride, Groom, Editorial + 2 candids',
            },
            {
              key: 'editorial',
              name: 'Midnight Editorial',
              vibe: 'espresso · champagne · magazine',
              sw: ['#131110', '#d3b465', '#f0e7d8'],
              uses: 'Hero, Bride, Groom + up to 6 gallery shots',
            },
            {
              key: 'polaroid',
              name: 'Sunday Scrapbook',
              vibe: 'blush · rose · polaroids',
              sw: ['#fbf2ec', '#bb5f72', '#46352c'],
              uses: 'Hero, Bride, Groom + gallery polaroids',
            },
          ] as const
        ).map((t) => {
          const active = (config.template ?? 'classic') === t.key
          return (
            <button
              key={t.key}
              onClick={() => setConfig((c) => ({ ...c, template: t.key }))}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active
                  ? 'border-slate-900 bg-white ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <span className="flex gap-1">
                {t.sw.map((c) => (
                  <span
                    key={c}
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ background: c }}
                  />
                ))}
              </span>
              <span className="mt-2 block text-sm font-semibold text-slate-900">{t.name}</span>
              <span className="block text-[11px] text-slate-400">{t.vibe}</span>
              <span className="mt-1 block text-[11px] text-slate-500">Uses: {t.uses}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {SLOTS.map((slot) => (
          <PhotoSlot
            key={slot.key}
            title={slot.title}
            hint={slot.hint}
            dims={slot.dims}
            tall={slot.tall}
            photo={config.photos?.[slot.key]}
            onChange={(photo) => setPhoto(slot.key, photo)}
          />
        ))}
      </div>

      <div className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        {/* gallery (Editorial strip / Scrapbook polaroids) */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Gallery (up to 6)</p>
          <p className="text-[11px] text-slate-400">
            Extra shots for the Editorial swipe strip / Scrapbook polaroids. Golden Letter
            ignores these. Best: portrait 3:4, ≥900×1200 (Scrapbook shows the centre square).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(config.gallery ?? []).map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-20 w-20 rounded object-cover" />
                <button
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      gallery: (c.gallery ?? []).filter((_, j) => j !== i),
                    }))
                  }
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-500 shadow hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            {(config.gallery ?? []).length < 6 && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-2xl text-slate-300 hover:border-slate-400 hover:text-slate-400">
                +
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ''
                    for (const f of files) {
                      const url = await resizeImage(f, 1200)
                      setConfig((c) =>
                        (c.gallery ?? []).length >= 6
                          ? c
                          : { ...c, gallery: [...(c.gallery ?? []), url] },
                      )
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>

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

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Music (optional)</p>
          <p className="text-[11px] text-slate-400">
            MP3 · ≤5 MB · a 60–90s loop is perfect. Starts when the guest opens the
            envelope; they can pause it anytime.
          </p>
          {config.music ? (
            <div className="mt-2 flex items-center gap-3">
              <audio controls src={config.music} className="h-9 w-full max-w-sm" />
              <button
                onClick={() => setConfig((c) => ({ ...c, music: undefined }))}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Upload audio…
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    if (f.size > 5 * 1024 * 1024) {
                      alert('That file is over 5 MB — please use a shorter clip or a compressed MP3.')
                      return
                    }
                    const r = new FileReader()
                    r.onload = () => setConfig((c) => ({ ...c, music: String(r.result) }))
                    r.readAsDataURL(f)
                  }}
                />
              </label>
              <span className="text-xs text-slate-400">or</span>
              <input
                placeholder="paste an audio URL (https://…)"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) setConfig((c) => ({ ...c, music: v }))
                }}
                className="w-64 rounded border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={config.auto_scroll ?? true}
              onChange={(e) => setConfig((c) => ({ ...c, auto_scroll: e.target.checked }))}
            />
            Auto-play the story (slow scroll until they touch)
          </label>
        </div>

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
            {justCreated ? 'E-invite created ✓' : 'E-invite updated ✓'}
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

      {/* live phone preview of the draft config */}
      <aside className="mt-10 hidden lg:mt-0 lg:block">
        <div className="sticky top-6">
          <div className="mb-3 flex justify-center">
            <div className="flex overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-medium">
              <button
                onClick={() => setSampleMode(false)}
                className={`px-3 py-1.5 transition-colors ${
                  !sampleMode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Your photos
              </button>
              <button
                onClick={() => setSampleMode(true)}
                className={`px-3 py-1.5 transition-colors ${
                  sampleMode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sample photos
              </button>
            </div>
          </div>
          <InvitePreview
            config={sampleMode ? { ...config, ...samplePhotos(config.template) } : config}
            event={event}
            venue={venue}
          />
          {sampleMode && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Showing bundled sample photos — your draft is untouched and samples are
              never saved.
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
