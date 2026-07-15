'use client'

import { use, useEffect, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { peekToken, verifyToken } from '@/lib/token'
import { mergeRsvp } from '@/lib/rsvp'
import type { GuestSide, Venue, WeddingEvent } from '@/lib/types'

/**
 * Public e-invitation: the planner blasts ONE link to everyone; each
 * submission lands straight on the guest list (deduped) with an RSVP status.
 * Token scope is the event, guest_id slot fixed to "rsvp".
 */
export default function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null | 'loading'>('loading')
  const [venue, setVenue] = useState<Venue | null>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    party: 1,
    side: 'both' as GuestSide,
    attending: true,
  })
  const [done, setDone] = useState<null | 'yes' | 'no'>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const payload = peekToken(token)
        const repo = getRepo()
        const e = payload ? await repo.getEvent(payload.event_id) : null
        if (!e) return setEvent(null)
        const ok = await verifyToken(token, e.guest_token_secret)
        if (!ok || ok.guest_id !== 'rsvp') return setEvent(null)
        setEvent(e)
        setVenue(await repo.getVenue(e.venue_id))
      } catch {
        setEvent(null)
      }
    })()
  }, [token])

  async function submit() {
    if (!event || event === 'loading' || !form.name.trim()) return
    setBusy(true)
    try {
      const repo = getRepo()
      const existing = await repo.listGuests(event.id)
      const guest = mergeRsvp(
        existing,
        {
          name: form.name,
          phone: form.phone,
          party_size: form.party,
          side: form.side,
          attending: form.attending,
        },
        event.id,
      )
      await repo.saveGuest(guest)
      setDone(form.attending ? 'yes' : 'no')
    } finally {
      setBusy(false)
    }
  }

  if (event === 'loading') {
    return <Shell><p className="mt-24 text-center text-slate-400">Loading invitation…</p></Shell>
  }
  if (!event) {
    return (
      <Shell>
        <div className="mt-20 px-6 text-center">
          <p className="text-2xl font-bold text-slate-100">This invitation link isn&apos;t valid</p>
          <p className="mt-3 text-slate-400">Please check with the couple for the correct link.</p>
        </div>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="mt-24 px-6 text-center">
          <p className="text-5xl">{done === 'yes' ? '🎉' : '💐'}</p>
          <h1 className="mt-4 text-2xl font-bold text-slate-100">
            {done === 'yes' ? "You're on the guest list!" : 'Thank you for letting us know'}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-slate-400">
            {done === 'yes'
              ? 'Closer to the day you’ll receive a personal QR code — it checks you in at the door and shows you exactly where your table is.'
              : `${event.couple_names} will miss you — thanks for responding.`}
          </p>
        </div>
      </Shell>
    )
  }

  const input =
    'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500'

  return (
    <Shell>
      <div className="mx-auto max-w-md px-6 pt-12">
        <p className="text-center text-sm uppercase tracking-widest text-slate-400">
          You&apos;re invited
        </p>
        <h1 className="mt-2 text-center text-3xl font-bold text-amber-400">
          {event.couple_names}
        </h1>
        <p className="mt-2 text-center text-slate-300">
          {event.event_date}
          {venue ? ` · ${venue.name}` : ''}
        </p>

        <div className="mt-8 space-y-3">
          <label className="block text-xs text-slate-400">
            Your name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="As it should appear on the seating list"
              className={input}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="So the greeter can find you at the door"
              className={input}
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1 text-xs text-slate-400">
              Seats needed (you + guests)
              <input
                type="number"
                min={1}
                max={10}
                value={form.party}
                onChange={(e) =>
                  setForm({ ...form, party: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
                }
                className={input}
              />
            </label>
            <label className="block flex-1 text-xs text-slate-400">
              Side
              <select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value as GuestSide })}
                className={input}
              >
                <option value="bride">Bride&apos;s</option>
                <option value="groom">Groom&apos;s</option>
                <option value="both">Friend of both</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            {(
              [
                [true, 'Joyfully accept 🎉'],
                [false, 'Regretfully decline'],
              ] as [boolean, string][]
            ).map(([val, label]) => (
              <button
                key={label}
                onClick={() => setForm({ ...form, attending: val })}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold ${
                  form.attending === val
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={submit}
            disabled={busy || !form.name.trim()}
            className="mt-2 w-full rounded-full bg-emerald-500 py-3 text-base font-bold text-slate-900 disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send RSVP'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-900 pb-10">{children}</div>
}
