'use client'

import { useEffect } from 'react'

/**
 * The story plays itself: a gentle reading-pace scroll that starts shortly
 * after the envelope opens and cancels PERMANENTLY on the first real user
 * input. Stops before the document end so the RSVP form arrives at rest.
 */
export function useAutoScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let raf = 0
    let last = 0
    const SPEED = 55 // px per second — slow reading pace

    const cancel = () => {
      cancelled = true
      cancelAndCleanup()
    }
    const events: (keyof WindowEventMap)[] = ['wheel', 'touchstart', 'pointerdown', 'keydown']

    const step = (t: number) => {
      if (cancelled) return
      if (last === 0) last = t
      const dt = (t - last) / 1000
      last = t
      const remaining =
        document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      if (remaining <= 600) return cancelAndCleanup() // let RSVP arrive at rest
      window.scrollBy(0, SPEED * dt)
      raf = requestAnimationFrame(step)
    }

    const startTimer = setTimeout(() => {
      raf = requestAnimationFrame(step)
    }, 1800)

    function cancelAndCleanup() {
      cancelled = true
      clearTimeout(startTimer)
      cancelAnimationFrame(raf)
      events.forEach((e) => window.removeEventListener(e, cancel))
    }
    events.forEach((e) => window.addEventListener(e, cancel, { passive: true }))

    return cancelAndCleanup
  }, [active])
}
