'use client'

import { useReveal } from './useReveal'

/**
 * Beat: a full-width editorial portrait rising with a feathered bottom
 * mask into the page, followed by the "overjoyed" script line — split
 * across two reveal lines so it arrives in step with the photo rather
 * than all at once. Null when there's no editorial photo (the no-config
 * V1 page never had this beat, so there's nothing to fall back to).
 */
export function InviteEditorial({ photo }: { photo?: string }) {
  const photoRef = useReveal<HTMLDivElement>()
  const line1Ref = useReveal<HTMLParagraphElement>()
  const line2Ref = useReveal<HTMLParagraphElement>()

  if (!photo) return null

  return (
    <section className="mx-auto max-w-md px-6 py-10">
      <div ref={photoRef} className="gv-io overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="gv-feather-b aspect-[3/4] max-h-[70svh] w-full object-cover"
        />
      </div>
      <p ref={line1Ref} className="gv-io gv-script mt-8 text-center text-2xl text-(--ink-soft)">
        We are overjoyed to invite you —
      </p>
      <p ref={line2Ref} className="gv-io gv-script mt-1 text-center text-2xl text-(--ink-soft)">
        to witness the beginning of our forever
      </p>
    </section>
  )
}
