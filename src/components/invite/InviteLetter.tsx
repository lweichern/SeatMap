'use client'

import { useReveal } from './useReveal'

/**
 * Beat: the couple's letter, one line at a time. Each line is its own
 * `.gv-io` reveal (via a per-line subcomponent, since the number of lines
 * is dynamic and hooks can't be called inside a loop directly) so they
 * arrive as the guest scrolls rather than all at once; the final line —
 * the sign-off — renders in script. Two "candid" photos float beside the
 * text: one high and right, one lower and left. Null when there are no
 * lines to show.
 */
export function InviteLetter({
  lines,
  photos,
}: {
  lines: string[]
  photos?: { candid1?: string; candid2?: string }
}) {
  if (lines.length === 0) return null

  return (
    <section className="relative mx-auto max-w-md px-6 py-14">
      {photos?.candid1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photos.candid1}
          alt=""
          loading="lazy"
          className="absolute top-0 right-4 w-32 rotate-2 rounded-lg shadow-[0_14px_30px_-18px_rgba(90,66,20,.45)]"
        />
      )}
      {photos?.candid2 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photos.candid2}
          alt=""
          loading="lazy"
          className="absolute top-1/2 left-4 w-36 -rotate-2 rounded-lg shadow-[0_14px_30px_-18px_rgba(90,66,20,.45)]"
        />
      )}
      <div className="relative space-y-4 text-center">
        {lines.map((line, i) => (
          <LetterLine key={i} last={i === lines.length - 1}>
            {line}
          </LetterLine>
        ))}
      </div>
    </section>
  )
}

function LetterLine({ children, last }: { children: string; last: boolean }) {
  const ref = useReveal<HTMLParagraphElement>()
  return (
    <p
      ref={ref}
      className={
        last
          ? 'gv-io gv-script text-2xl text-(--ink)'
          : 'gv-io text-[15px] leading-relaxed text-(--ink-soft)'
      }
    >
      {children}
    </p>
  )
}
