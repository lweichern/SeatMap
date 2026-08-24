'use client'

import { useEffect, useState } from 'react'
import { countdown, type CountdownState } from '@/lib/invite'
import { useReveal } from './useReveal'

const UNITS: ['days' | 'hours' | 'minutes', string][] = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Minutes'],
]

/**
 * Beat 3: live "18 days · 4 hours · 12 minutes" toward `eventDate`.
 * Recomputed on mount and every 60s thereafter via `setInterval` (cleaned up
 * on unmount/prop change) — no per-second churn. `state` starts `null` (the
 * target is time-dependent, so it can't be computed during SSR/first paint
 * without a hydration mismatch); the first effect run fills it in
 * immediately. 'past' or an invalid `eventDate` renders nothing.
 */
export function InviteCountdown({ eventDate }: { eventDate: string }) {
  const ref = useReveal<HTMLElement>()
  const [state, setState] = useState<CountdownState | null>(null)

  useEffect(() => {
    function tick() {
      setState(countdown(eventDate, new Date()))
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [eventDate])

  if (state === null || state.state === 'past') return null

  return (
    <section ref={ref} className="gv-io mx-auto max-w-md px-6 py-10 text-center">
      {state.state === 'today' ? (
        <p className="gv-display text-2xl italic">Today we celebrate 🎉</p>
      ) : (
        <div className="flex items-start justify-center gap-8">
          {UNITS.map(([key, label]) => (
            <div key={key}>
              <p className="gv-display text-4xl text-(--gold)">{state[key]}</p>
              <p className="gv-caps mt-1 text-[10px] text-(--ink-faint)">{label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
