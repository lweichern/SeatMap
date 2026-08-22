'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { peekToken, signToken, verifyToken } from '@/lib/token'
import { matchGuests, maskPhone } from '@/lib/selfid'
import { Flourish } from '@/components/guest/Flourish'
import type { Guest, WeddingEvent } from '@/lib/types'

const SIDE_LABEL = {
  bride: "Bride's side",
  groom: "Groom's side",
  both: 'Friend of both',
} as const

/**
 * The shared entrance-poster QR: identify the guest with as little
 * friction as possible, then hand off to their personal /g page.
 * v1 deliberately writes nothing — attendance truth stays at the desk.
 */
export default function FindPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<WeddingEvent | null | 'loading'>('loading')
  const [guests, setGuests] = useState<Guest[]>([])
  const [recognized, setRecognized] = useState<Guest | null>(null)
  const [name, setName] = useState('')
  const [last4, setLast4] = useState('')
  const [candidates, setCandidates] = useState<Guest[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const payload = peekToken(token)
        if (!payload || payload.guest_id !== 'kiosk') return setEvent(null)
        const repo = getRepo()
        const e = await repo.getEvent(payload.event_id)
        if (!e) return setEvent(null)
        const ok = await verifyToken(token, e.guest_token_secret)
        if (!ok || ok.guest_id !== 'kiosk') return setEvent(null)
        const gs = await repo.listGuests(e.id)
        setEvent(e)
        setGuests(gs)
        const savedId = localStorage.getItem(`seatmap.selfid.${e.id}`)
        const saved = savedId
          ? (gs.find((g) => g.id === savedId && g.rsvp !== 'no') ?? null)
          : null
        if (saved) setRecognized(saved)
      } catch {
        setEvent(null)
      }
    })()
  }, [token])

  async function goToSeat(g: Guest) {
    if (!event || event === 'loading' || busy) return
    setBusy(true)
    try {
      localStorage.setItem(`seatmap.selfid.${event.id}`, g.id)
    } catch {}
    try {
      router.push(`/g/${await signToken(event.id, g.id, event.guest_token_secret)}`)
    } catch {
      setBusy(false)
    }
  }

  if (event === 'loading') {
    return (
      <Shell>
        <div className="gv-rise pt-36 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-2xl italic text-(--ink-soft)">One moment…</p>
        </div>
      </Shell>
    )
  }

  if (!event) {
    return (
      <Shell>
        <div className="gv-rise mx-auto mt-28 max-w-sm px-6 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-3xl italic">This code isn&apos;t valid</p>
          <p className="mt-3 text-[15px] leading-relaxed text-(--ink-soft)">
            Please see the greeter at the entrance desk — they&apos;ll find your table
            in seconds.
          </p>
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
          {event.couple_names}
        </p>
        <h1
          className="gv-display gv-rise mt-2 text-center text-4xl italic"
          style={{ animationDelay: '.08s' }}
        >
          Find your seat
        </h1>
        <Flourish className="gv-rise mx-auto mt-4" delay=".16s" />

        {recognized ? (
          <div className="gv-rise mt-8" style={{ animationDelay: '.24s' }}>
            <p className="text-center text-[15px] text-(--ink-soft)">
              Welcome back — is this you?
            </p>
            <GuestCard g={recognized} onYes={() => goToSeat(recognized)} busy={busy} />
            <button
              onClick={() => {
                setRecognized(null)
                setCandidates(null)
              }}
              className="mx-auto mt-3 block text-sm text-(--ink-faint) underline-offset-2 hover:underline"
            >
              Not me — search instead
            </button>
          </div>
        ) : (
          <div className="gv-rise mt-8 space-y-4" style={{ animationDelay: '.24s' }}>
            <label className={label}>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As it was given for the guest list"
                className={input}
              />
            </label>
            <label className={label}>
              Last 4 digits of your phone (optional)
              <input
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="Helps when names repeat"
                className={input}
              />
            </label>
            <button
              onClick={() => setCandidates(matchGuests(guests, name, last4))}
              disabled={!name.trim()}
              className="w-full rounded-full py-3 text-[15px] font-bold text-[#fffdf6] shadow-[0_16px_32px_-14px_rgba(140,105,35,.55)] transition-transform active:scale-[.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(165deg,#b3903f,#7d5f1a)' }}
            >
              Find my table
            </button>

            {candidates !== null && candidates.length === 0 && (
              <p className="pt-2 text-center text-[15px] leading-relaxed text-(--ink-soft)">
                We couldn&apos;t find you — please see the greeter at the entrance desk,
                they&apos;ll sort you out in seconds.
              </p>
            )}
            {candidates !== null && candidates.length > 5 && (
              <p className="pt-2 text-center text-[15px] leading-relaxed text-(--ink-soft)">
                That matches quite a few guests — add your phone digits above, or see
                the greeter at the entrance desk.
              </p>
            )}
            {candidates !== null && candidates.length >= 1 && candidates.length <= 5 && (
              <div className="pt-1">
                <p className="text-center text-sm text-(--ink-faint)">
                  {candidates.length === 1 ? 'Is this you?' : 'Which one is you?'}
                </p>
                {candidates.map((g) => (
                  <GuestCard key={g.id} g={g} onYes={() => goToSeat(g)} busy={busy} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

function GuestCard({ g, onYes, busy }: { g: Guest; onYes: () => void; busy: boolean }) {
  const mask = maskPhone(g.phone)
  return (
    <div className="mt-3 rounded-2xl border border-(--line) bg-(--card) p-4">
      <p className="gv-display text-xl font-semibold">{g.name}</p>
      <p className="mt-0.5 text-sm text-(--ink-soft)">
        {SIDE_LABEL[g.side]} · party of {g.party_size}
        {mask ? ` · ${mask}` : ''}
      </p>
      <button
        onClick={onYes}
        disabled={busy}
        className="mt-3 w-full rounded-full py-2.5 text-sm font-bold text-[#fffdf6] transition-transform active:scale-[.98] disabled:opacity-60"
        style={{ background: 'linear-gradient(165deg,#c5a04a,#8a6a1f)' }}
      >
        {busy ? 'Opening…' : 'Yes — show me my seat'}
      </button>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="gv-shell pb-12">{children}</div>
}
