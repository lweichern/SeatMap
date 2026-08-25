'use client'

import { splitCouple } from '@/lib/invite'
import { useReveal } from './useReveal'

/**
 * Template-specific beats. Shared sections (envelope, countdown, details,
 * RSVP, letter, audio) restyle themselves via the CSS-variable overrides
 * on the shell (`gv-t-editorial` / `gv-t-polaroid`); these components only
 * cover what is genuinely different: the hero and the photo layouts.
 */

/* ============================ Midnight Editorial ============================ */

export function EdHero({
  coupleNames,
  dateLine,
  greetName,
  photo,
}: {
  coupleNames: string
  dateLine: string
  greetName: string | null
  photo?: string
}) {
  // Names stacked like a masthead: "ADAM" / "&" / "EVE" — splitCouple
  // handles the connector safely (never matches "and" inside "Amanda")
  const { bride, groom } = splitCouple(coupleNames)
  const stacked = bride && groom ? [bride, '&', groom] : [coupleNames]
  return (
    <div className="relative flex h-[100svh] w-full items-end overflow-hidden">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(19,17,16,.55) 0%, rgba(19,17,16,.05) 40%, rgba(19,17,16,.88) 88%)',
        }}
      />
      <div className="relative z-10 w-full px-7 pb-[max(3.5rem,env(safe-area-inset-bottom))]">
        <p className="gv-caps text-[11px] text-(--gold)">The wedding of</p>
        <h1 className="gv-display mt-3 leading-[0.95] text-[#f5edde]">
          {stacked.map((line, i) => (
            <span
              key={i}
              className={
                line === '&'
                  ? 'block pl-1 text-3xl italic text-(--gold)'
                  : 'block text-6xl font-semibold uppercase tracking-tight'
              }
            >
              {line}
            </span>
          ))}
        </h1>
        <div className="mt-5 h-px w-24 bg-(--gold)" />
        <p className="gv-caps mt-4 text-[11px] text-[#c9bb9c]">{dateLine}</p>
        <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-[#e4d9c2]">
          {greetName ? (
            <>
              Dear <span className="font-semibold text-[#f5edde]">{greetName}</span>, we
              would be honoured to have you with us.
            </>
          ) : (
            'We would be honoured to have you with us.'
          )}
        </p>
      </div>
    </div>
  )
}

export function EdSplit({
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
  const ref = useReveal<HTMLDivElement>()
  if (!bridePhoto || !groomPhoto) return null
  return (
    <div ref={ref} className="gv-io mt-16">
      <div className="grid grid-cols-2 gap-px bg-(--line)">
        {[
          { photo: bridePhoto, label: 'The Bride', name: bride },
          { photo: groomPhoto, label: 'The Groom', name: groom },
        ].map((side) => (
          <figure key={side.label} className="relative m-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={side.photo} alt="" className="aspect-[3/4] w-full object-cover" />
            <figcaption className="bg-(--card) px-3 py-3">
              <p className="gv-caps text-[9px] text-(--ink-faint)">{side.label}</p>
              {side.name && (
                <p className="gv-display mt-0.5 text-lg italic text-(--ink)">{side.name}</p>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function EdStrip({ photos }: { photos: string[] }) {
  const ref = useReveal<HTMLDivElement>()
  if (photos.length === 0) return null
  return (
    <div ref={ref} className="gv-io mt-16">
      <p className="gv-caps px-7 text-[10px] text-(--ink-faint)">
        Moments · swipe →
      </p>
      <div className="gv-snap mt-3 flex gap-3 overflow-x-auto px-7 pb-3">
        {photos.map((src, i) => (
          <figure key={i} className="m-0 w-64 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="aspect-[3/4] w-full object-cover" />
            <figcaption className="gv-caps mt-2 text-[10px] text-(--gold)">
              {String(i + 1).padStart(2, '0')}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

/* ============================= Sunday Scrapbook ============================= */

function Polaroid({
  photo,
  caption,
  rotate,
  tapePos = 'top',
}: {
  photo: string
  caption?: string
  rotate: string
  tapePos?: 'top' | 'corner'
}) {
  return (
    <figure className={`gv-polaroid relative m-0 ${rotate}`}>
      <span
        className="gv-tape"
        style={
          tapePos === 'top'
            ? { top: -12, left: '50%', marginLeft: -43 }
            : { top: -10, right: -26, transform: 'rotate(38deg)' }
        }
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" className="aspect-square w-full object-cover" />
      {caption && (
        <figcaption className="gv-script absolute inset-x-0 bottom-2 text-center text-xl text-(--ink-soft)">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export function PolHero({
  coupleNames,
  dateLine,
  greetName,
  photo,
}: {
  coupleNames: string
  dateLine: string
  greetName: string | null
  photo?: string
}) {
  return (
    <div className="flex min-h-[100svh] w-full flex-col items-center justify-center px-8 py-16">
      <p className="gv-caps gv-rise text-[11px] text-(--gold)">Save the date</p>
      {photo && (
        <div className="gv-rise mt-6 w-full max-w-xs" style={{ animationDelay: '.1s' }}>
          <Polaroid photo={photo} caption={coupleNames} rotate="-rotate-2" />
        </div>
      )}
      {!photo && (
        <h1 className="gv-display gv-rise mt-4 text-center text-4xl italic">{coupleNames}</h1>
      )}
      <p className="gv-rise mt-8 text-[15px] text-(--ink-soft)" style={{ animationDelay: '.2s' }}>
        {dateLine}
      </p>
      <p
        className="gv-rise mt-3 max-w-xs text-center text-[15px] leading-relaxed text-(--ink-soft)"
        style={{ animationDelay: '.28s' }}
      >
        {greetName ? (
          <>
            Dear <span className="font-semibold text-(--ink)">{greetName}</span> — come
            celebrate with us!
          </>
        ) : (
          'Come celebrate with us!'
        )}
      </p>
    </div>
  )
}

export function PolDuo({
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
  const ref = useReveal<HTMLDivElement>()
  if (!bridePhoto || !groomPhoto) return null
  return (
    <div ref={ref} className="gv-io mx-auto mt-14 flex max-w-md items-start justify-center gap-4 px-6">
      <div className="w-1/2 pt-6">
        <Polaroid photo={bridePhoto} caption={bride ? `${bride} ♡` : 'her'} rotate="-rotate-3" />
      </div>
      <div className="w-1/2">
        <Polaroid photo={groomPhoto} caption={groom ?? 'him'} rotate="rotate-2" tapePos="corner" />
      </div>
    </div>
  )
}

export function PolGallery({ photos }: { photos: string[] }) {
  const ref = useReveal<HTMLDivElement>()
  if (photos.length === 0) return null
  const rotations = ['-rotate-2', 'rotate-3', 'rotate-1', '-rotate-3', 'rotate-2', '-rotate-1']
  return (
    <div ref={ref} className="gv-io mx-auto mt-14 max-w-md px-6">
      <p className="gv-script text-center text-2xl text-(--gold)">little moments</p>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8">
        {photos.map((src, i) => (
          <div key={i} className={i % 3 === 1 ? 'pt-6' : ''}>
            <Polaroid
              photo={src}
              rotate={rotations[i % rotations.length]}
              tapePos={i % 2 ? 'corner' : 'top'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
