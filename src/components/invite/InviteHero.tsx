import { Flourish } from '@/components/guest/Flourish'

/**
 * Beat 2: eyebrow → names → self-drawing flourish → date → greeting.
 * Plays on load (the envelope has already gated the "reveal" moment), so
 * children just stagger with `gv-rise` + increasing inline delays — no IO.
 *
 * With a `photo`, this becomes a full-bleed 100svh photo hero instead: the
 * photo fills the section (feathered into the ivory page below via
 * `.gv-feather-b`), and the eyebrow/names/date/greeting sit over it near
 * the bottom in ivory text with a drop-shadow (photos are often dark, so a
 * scrim would fight the mask) plus a translucent pill behind the greeting
 * line for extra legibility. Without a `photo`, this is exactly today's
 * markup — the V1 no-config page must render unchanged.
 */
export function InviteHero({
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
  if (photo) {
    return (
      <section className="relative h-[100svh] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          className="gv-feather-b absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-x-0 bottom-0 px-6 text-center"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
        >
          <p className="gv-script text-4xl text-[#fffdf6] drop-shadow-[0_2px_10px_rgba(0,0,0,.45)]">
            We&apos;re getting married
          </p>
          <h1 className="gv-display mt-2 text-4xl italic text-[#fffdf6] drop-shadow-[0_2px_10px_rgba(0,0,0,.45)]">
            {coupleNames}
          </h1>
          <p className="mt-2 text-[15px] text-[#fffdf6] drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
            {dateLine}
          </p>
          <p className="mx-auto mt-4 inline-block rounded-full bg-black/25 px-4 py-1 text-[13px] text-[#fffdf6] backdrop-blur">
            {greetName ? (
              <>Dear {greetName}, we would be honoured to have you with us</>
            ) : (
              'We would be honoured to have you with us'
            )}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative mx-auto max-w-md px-6 pt-28 pb-16 text-center sm:pt-36">
      <p className="gv-caps gv-rise text-[11px] text-(--gold)">Together with their families</p>
      <h1
        className="gv-display gv-rise mt-3 text-5xl italic"
        style={{ animationDelay: '.12s' }}
      >
        {coupleNames}
      </h1>
      <Flourish draw className="gv-rise mx-auto mt-4" delay=".3s" />
      <p
        className="gv-rise mt-4 text-[15px] text-(--ink-soft)"
        style={{ animationDelay: '.5s' }}
      >
        {dateLine}
      </p>
      <p
        className="gv-rise mx-auto mt-6 max-w-xs text-[15px] leading-relaxed text-(--ink-soft)"
        style={{ animationDelay: '.65s' }}
      >
        {greetName ? (
          <>
            Dear <strong className="text-(--ink)">{greetName}</strong>, we would be honoured to
            have you with us
          </>
        ) : (
          'We would be honoured to have you with us'
        )}
      </p>
    </section>
  )
}
