'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * One shared IntersectionObserver for every `.gv-io` element on the page —
 * cheaper than one observer per revealed element, and the natural shape for
 * a page with a dozen-plus scroll-triggered beats. Lazily created on first
 * use so importing this module has no side effect at load time (SSR-safe:
 * nothing touches `window` until a component actually mounts and calls the
 * hook).
 */
let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined') return null
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('gv-io-in')
          sharedObserver?.unobserve(entry.target)
        }
      },
      { threshold: 0.2 },
    )
  }
  return sharedObserver
}

/**
 * Ref the element you want to reveal with class `gv-io` in markup; once it
 * crosses 20% visibility this adds `gv-io-in` (see THEME in the guest
 * layout) and stops observing — a one-shot reveal, not a scroll-linked one.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    const observer = getSharedObserver()
    if (!el || !observer) return
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [])

  return ref
}
