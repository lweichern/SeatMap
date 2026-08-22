'use client'

import { use, useEffect, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { peekToken, verifyToken } from '@/lib/token'
import { mergeRsvp } from '@/lib/rsvp'
import { DietarySteppers } from '@/components/DietarySteppers'
import { Flourish } from '@/components/guest/Flourish'
import type { Dietary, GuestSide, Venue, WeddingEvent } from '@/lib/types'

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
    dietary: {} as Dietary,
  })
  const [showDietary, setShowDietary] = useState(false)
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
          dietary: form.dietary,
        },
        event.id,
      )
      await repo.saveGuest(guest)
      // remember who this phone belongs to — the /find entrance QR
      // recognizes them instantly next time
      try {
        localStorage.setItem(`seatmap.selfid.${event.id}`, guest.id)
      } catch {}
      setDone(form.attending ? 'yes' : 'no')
    } finally {
      setBusy(false)
    }
  }

  if (event === 'loading') {
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
  if (!event) {
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

  if (done) {
    return (
      <Shell>
        <div className="gv-rise mx-auto mt-28 max-w-sm px-6 text-center">
          <p className="text-5xl">{done === 'yes' ? '🎉' : '💐'}</p>
          <h1 className="gv-display mt-5 text-3xl italic">
            {done === 'yes' ? "You're on the guest list!" : 'Thank you for letting us know'}
          </h1>
          <p className="mx-auto mt-3 text-[15px] leading-relaxed text-(--ink-soft)">
            {done === 'yes'
              ? 'Closer to the day you’ll receive a personal QR code — it checks you in at the door and shows you exactly where your table is.'
              : `${event.couple_names} will miss you — thanks for responding.`}
          </p>
          <Flourish className="mx-auto mt-7" />
        </div>
      </Shell>
    )
  }

  const input =
    'mt-1.5 w-full rounded-xl border border-(--line) bg-(--card) px-3.5 py-2.5 text-[15px] normal-case tracking-normal text-(--ink) placeholder:text-(--ink-faint) focus:border-(--gold-soft) focus:outline-none'
  const label = 'gv-caps block text-[10px] text-(--ink-faint)'

  return (
    <Shell>
      <div className="mx-auto max-w-md px-6 pt-12">
        <p className="gv-caps gv-rise text-center text-[11px] text-(--gold)">
          You&apos;re invited to the wedding of
        </p>
        <h1
          className="gv-display gv-rise mt-2 text-center text-4xl italic sm:text-5xl"
          style={{ animationDelay: '.08s' }}
        >
          {event.couple_names}
        </h1>
        <p
          className="gv-rise mt-3 text-center text-[15px] text-(--ink-soft)"
          style={{ animationDelay: '.16s' }}
        >
          {event.event_date}
          {venue ? ` · ${venue.name}` : ''}
        </p>
        <Flourish className="gv-rise mx-auto mt-4" delay=".22s" />

        <div className="gv-rise mt-8 space-y-4" style={{ animationDelay: '.3s' }}>
          <label className={label}>
            Your name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="As it should appear on the seating list"
              className={input}
            />
          </label>
          <label className={label}>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="So the greeter can find you at the door"
              className={input}
            />
          </label>
          <div className="flex gap-3">
            <label className={`${label} flex-1`}>
              Seats needed
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
            <label className={`${label} flex-1`}>
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

          {form.attending && (
            <div className="rounded-2xl border border-(--line) bg-(--card) px-4 py-3">
              <button
                type="button"
                onClick={() => setShowDietary((s) => !s)}
                className="flex w-full items-center justify-between text-sm text-(--ink-soft)"
              >
                <span>Any dietary needs?</span>
                <span className="text-(--gold)">{showDietary ? '▴' : '▾'}</span>
              </button>
              {showDietary && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-(--ink-faint)">
                    How many of your {form.party} {form.party === 1 ? 'seat' : 'seats'} need:
                  </p>
                  <DietarySteppers
                    value={form.dietary}
                    max={form.party}
                    onChange={(d) => setForm({ ...form, dietary: d })}
                    tone="light"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {(
              [
                [true, 'Joyfully accept 🎉'],
                [false, 'Regretfully decline'],
              ] as [boolean, string][]
            ).map(([val, lbl]) => (
              <button
                key={lbl}
                onClick={() => setForm({ ...form, attending: val })}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                  form.attending === val
                    ? 'text-[#fffdf6] shadow-[0_10px_22px_-12px_rgba(140,105,35,.6)]'
                    : 'border border-(--line) bg-(--card) text-(--ink-soft)'
                }`}
                style={
                  form.attending === val
                    ? { background: 'linear-gradient(165deg,#c5a04a,#8a6a1f)' }
                    : undefined
                }
              >
                {lbl}
              </button>
            ))}
          </div>

          <button
            onClick={submit}
            disabled={busy || !form.name.trim()}
            className="mt-2 w-full rounded-full py-3.5 text-base font-bold text-[#fffdf6] shadow-[0_16px_32px_-14px_rgba(140,105,35,.55)] transition-transform active:scale-[.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(165deg,#b3903f,#7d5f1a)' }}
          >
            {busy ? 'Sending…' : 'Send RSVP'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="gv-shell pb-12">{children}</div>
}
