import { Flourish } from '@/components/guest/Flourish'

/**
 * Beat 2: eyebrow → names → self-drawing flourish → date → greeting.
 * Plays on load (the envelope has already gated the "reveal" moment), so
 * children just stagger with `gv-rise` + increasing inline delays — no IO.
 */
export function InviteHero({
  coupleNames,
  dateLine,
  greetName,
}: {
  coupleNames: string
  dateLine: string
  greetName: string | null
}) {
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
