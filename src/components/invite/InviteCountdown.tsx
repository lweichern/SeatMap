'use client'

import { useEffect, useState } from 'react'
import { countdown, type CountdownState } from '@/lib/invite'
import { useReveal } from './useReveal'

const UNITS: ['days' | 'hours' | 'minutes' | 'seconds', string][] = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Minutes'],
  ['seconds', 'Seconds'],
]

/**
 * Beat 3: live "18 days · 4 hours · 12 minutes · 7 seconds" toward
 * `eventDate`. Recomputed on mount and every 1s thereafter via
 * `setInterval` (cleaned up on unmount/prop change). While the tab is
 * hidden the tick still fires but skips the `setState` call — no point
 * re-rendering off-screen — and a `visibilitychange` listener re-syncs
 * immediately when the tab becomes visible again. `state` starts `null`
 * (the target is time-dependent, so it can't be computed during
 * SSR/first paint without a hydration mismatch); the first effect run
 * fills it in immediately. 'past' or an invalid `eventDate` renders
 * nothing.
 */
export function InviteCountdown({ eventDate }: { eventDate: string }) {
  const ref = useReveal<HTMLElement>()
  const [state, setState] = useState<CountdownState | null>(null)

  useEffect(() => {
    function sync() {
      setState(countdown(eventDate, new Date()))
    }
    function tick() {
      if (document.hidden) return
      sync()
    }
    sync()
    const id = setInterval(tick, 1_000)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [eventDate])

  if (state === null || state.state === 'past') return null

  return (
    <section ref={ref} className="gv-io mx-auto max-w-md px-6 py-10 text-center">
      {state.state === 'today' ? (
        <p className="gv-display text-2xl italic">Today we celebrate 🎉</p>
      ) : (
        <div className="flex items-start justify-center gap-4">
          {UNITS.map(([key, label]) => (
            <div key={key}>
              <p className="gv-display text-3xl text-(--gold)">{state[key]}</p>
              <p className="gv-caps mt-1 text-[10px] text-(--ink-faint)">{label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
