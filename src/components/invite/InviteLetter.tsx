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

  // Photos sit IN the flow between line groups (tilted, offset) — the text
  // always keeps its own space and stays legible.
  const firstBreak = Math.max(1, Math.ceil(lines.length / 3))
  const secondBreak = Math.max(firstBreak + 1, Math.ceil((2 * lines.length) / 3))

  return (
    <section className="mx-auto max-w-md px-6 py-14">
      <div className="space-y-4 text-center">
        {lines.map((line, i) => (
          <div key={i}>
            <LetterLine last={i === lines.length - 1}>{line}</LetterLine>
            {i === firstBreak - 1 && photos?.candid1 && (
              <LetterPhoto src={photos.candid1} className="ml-auto mr-2 w-36 rotate-2" />
            )}
            {i === secondBreak - 1 && photos?.candid2 && (
              <LetterPhoto src={photos.candid2} className="mr-auto ml-2 w-36 -rotate-2" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function LetterPhoto({ src, className }: { src: string; className: string }) {
  const ref = useReveal<HTMLImageElement>()
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      className={`gv-io my-6 block rounded-lg shadow-[0_14px_30px_-18px_rgba(90,66,20,.45)] ${className}`}
    />
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
