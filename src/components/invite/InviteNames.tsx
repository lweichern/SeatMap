'use client'

import { useReveal } from './useReveal'

/**
 * Beat: offset editorial collage introducing the couple by name — bride
 * portrait upper-left, groom portrait lower-right overlapping it, then
 * underlined "BRIDE / <name>" / "GROOM / <name>" labels below (`.gv-caps`
 * uppercases the literal "Bride"/"Groom" text for us). Photos are optional
 * — labels alone still render when a name is set but its portrait isn't —
 * and the whole beat disappears when neither name is set.
 */
export function InviteNames({
  bride,
  groom,
  bridePhoto,
  groomPhoto,
}: {
  bride?: string
  groom?: string
  bridePhoto?: string
  groomPhoto?: string
}) {
  const ref = useReveal<HTMLElement>()
  if (!bride && !groom) return null

  const hasPhotos = !!bridePhoto || !!groomPhoto

  return (
    <section ref={ref} className="gv-io mx-auto max-w-md px-6 py-14">
      {hasPhotos && (
        <div className="relative">
          {bridePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bridePhoto}
              alt={bride ?? ''}
              loading="lazy"
              className="aspect-[3/4] w-3/5 rounded-2xl object-cover shadow-[0_18px_40px_-20px_rgba(90,66,20,.45)]"
            />
          )}
          {groomPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={groomPhoto}
              alt={groom ?? ''}
              loading="lazy"
              className="absolute right-0 bottom-0 aspect-[3/4] w-2/5 -translate-y-10 rounded-2xl border-4 border-(--ivory) object-cover shadow-[0_18px_40px_-20px_rgba(90,66,20,.45)]"
            />
          )}
        </div>
      )}
      <div className={`flex items-start justify-between gap-4 ${hasPhotos ? 'mt-10' : ''}`}>
        {bride && (
          <p className="gv-caps border-b border-(--line) pb-2 text-[13px]">
            Bride / <span className="text-(--gold)">{bride}</span>
          </p>
        )}
        {groom && (
          <p className="gv-caps ml-auto border-b border-(--line) pb-2 text-right text-[13px]">
            Groom / <span className="text-(--gold)">{groom}</span>
          </p>
        )}
      </div>
    </section>
  )
}
