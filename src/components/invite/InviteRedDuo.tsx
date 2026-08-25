'use client'

import { useReveal } from './useReveal'

const MAROON = '#7a1e26'

/**
 * Beat: a full-bleed maroon section pairing the bride and groom's
 * portraits under script "her /" / "him /" labels, closing with a shared
 * caption. Deliberately full-bleed (no `mx-auto max-w-*`) so it breaks out
 * of the invite's usual column. Only renders when both portraits are set —
 * the page additionally gates this on the studio's red-accent toggle.
 */
export function InviteRedDuo({
  bridePhoto,
  groomPhoto,
}: {
  bridePhoto?: string
  groomPhoto?: string
}) {
  const ref = useReveal<HTMLElement>()
  if (!bridePhoto || !groomPhoto) return null

  return (
    <section ref={ref} className="gv-io w-full px-6 py-16 text-center" style={{ background: MAROON }}>
      <p className="gv-script text-3xl text-[#fffdf6]">her /</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bridePhoto}
        alt=""
        loading="lazy"
        className="gv-feather-y mx-auto mt-4 aspect-[3/4] w-4/5 object-cover"
      />

      <p className="gv-script mt-14 text-3xl text-[#fffdf6]">him /</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={groomPhoto}
        alt=""
        loading="lazy"
        className="gv-feather-y mx-auto mt-4 aspect-[3/4] w-4/5 object-cover"
      />

      <p className="gv-script mx-auto mt-14 max-w-xs text-2xl leading-relaxed text-[#fffdf6]">
        Some moments define a lifetime — and this is one of them.
      </p>
    </section>
  )
}
