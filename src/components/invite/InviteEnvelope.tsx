'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Full-screen ivory envelope guests tap to open. Tap-driven, not
 * scroll-driven — the page underneath only becomes scrollable once this
 * unmounts. The whole overlay is the tap target (mobile-first: no hunting
 * for a tiny button), so nothing inside needs its own hit area.
 *
 * `opened` is fully controlled by the parent (which also owns the
 * reduced-motion / sessionStorage / JS-failure "skip straight to open"
 * decision) — this component only fires `onOpen` once, after the CSS
 * animation finishes (or a fallback timeout, whichever comes first).
 */
export function InviteEnvelope({
  monogram,
  opened,
  onOpen,
}: {
  monogram: string
  opened: boolean
  onOpen: () => void
}) {
  const [opening, setOpening] = useState(false)
  const firedRef = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!opening) return
    const el = cardRef.current

    function fire() {
      if (firedRef.current) return
      firedRef.current = true
      onOpen()
    }

    function onTransitionEnd(e: TransitionEvent) {
      if (e.target === el) fire()
    }

    el?.addEventListener('transitionend', onTransitionEnd)
    const fallback = setTimeout(fire, 1400)

    return () => {
      el?.removeEventListener('transitionend', onTransitionEnd)
      clearTimeout(fallback)
    }
  }, [opening, onOpen])

  if (opened) return null

  function open() {
    if (opening) return
    setOpening(true)
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-(--ivory) [perspective:1400px] ${opening ? 'gv-env-open' : ''}`}
      style={{
        height: '100svh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      role="button"
      tabIndex={0}
      aria-label="Tap to open your invitation"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      {/* envelope body */}
      <div
        className="absolute inset-6 rounded-2xl border border-(--line)"
        style={{ background: 'linear-gradient(165deg,#fffdf6,#f1e3c4)' }}
        aria-hidden
      />
      {/* flap — lifts open on tap */}
      <div
        className="gv-env-flap absolute inset-x-6 top-6 h-[42%] rounded-t-2xl"
        style={{
          background: 'linear-gradient(165deg,#f6ead0,#dcc182)',
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }}
        aria-hidden
      />

      {/* card — the seal + caption, slides up and fades away on open */}
      <div ref={cardRef} className="gv-env-card relative flex flex-col items-center gap-5 px-8 text-center">
        <div className="gv-seal">
          <span className="gv-seal-text">{monogram}</span>
        </div>
        <p className="gv-caps text-[11px] text-(--ink-faint)">Tap to open</p>
      </div>
    </div>
  )
}
