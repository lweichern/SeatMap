'use client'

import { useEffect, useRef, useState } from 'react'
import { Cormorant_Garamond, Great_Vibes, Karla } from 'next/font/google'
import { GUEST_THEME } from '@/app/(guest)/theme'
import { DEFAULT_LETTER, formatDate } from '@/lib/invite'
import type { InviteConfig, Venue, WeddingEvent } from '@/lib/types'
import { InviteHero } from './InviteHero'
import { InviteEditorial } from './InviteEditorial'
import { InviteNames } from './InviteNames'
import { InviteRedDuo } from './InviteRedDuo'
import { InviteCalendar } from './InviteCalendar'
import { InviteCountdown } from './InviteCountdown'
import { InviteDetails } from './InviteDetails'
import { InviteRsvp } from './InviteRsvp'
import { InviteLetter } from './InviteLetter'
import { EdHero, EdSplit, EdStrip, PolHero, PolDuo, PolGallery } from './templates'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})
const body = Karla({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' })
const script = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-script' })

/**
 * Live miniature of the guest invite, driven by the Studio's DRAFT config —
 * the real beat components inside a phone frame, scaled with `zoom` and
 * made read-only via pointer-events (scrolling stays on the frame).
 */
export function InvitePreview({
  config,
  event,
  venue,
}: {
  config: InviteConfig
  event: WeddingEvent
  venue: Venue | null
}) {
  const template = config.template ?? 'classic'
  const gallery = (config.gallery ?? []).filter(Boolean)
  const tplClass =
    template === 'editorial' ? 'gv-t-editorial' : template === 'polaroid' ? 'gv-t-polaroid' : ''
  const previewEvent: WeddingEvent = { ...event, invite: config }
  const dateLine = formatDate(event.event_date)

  // Scale the 390px-wide invite to EXACTLY fill the frame's inner width
  const frameRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.85)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const fit = () => setZoom(el.clientWidth / 390)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Ambient auto-scroll: the story plays itself at reading pace, pauses
  // while the pointer hovers the frame, and loops (bottom → hold → top).
  const hoverRef = useRef(false)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let last = 0
    let holdUntil = 0
    const SPEED = 70 // px/s
    const step = (t: number) => {
      if (last === 0) last = t
      const dt = (t - last) / 1000
      last = t
      if (!hoverRef.current && t >= holdUntil) {
        const max = el.scrollHeight - el.clientHeight
        if (max > 4 && el.scrollTop >= max - 2) {
          holdUntil = t + 1800
          el.scrollTop = 0
        } else {
          el.scrollTop += SPEED * dt
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const over = () => (hoverRef.current = true)
    const out = () => (hoverRef.current = false)
    el.addEventListener('pointerenter', over)
    el.addEventListener('pointerleave', out)
    el.addEventListener('wheel', over, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', over)
      el.removeEventListener('pointerleave', out)
      el.removeEventListener('wheel', over)
    }
  }, [])

  // Music (when the config carries a track): tap-to-play over the frame.
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [musicNote, setMusicNote] = useState('')
  useEffect(() => {
    // track changed (e.g. sample mode toggled) — reset
    setPlaying(false)
    setMusicNote('')
    audioRef.current?.pause()
  }, [config.music])
  const toggleMusic = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.play()
        .then(() => {
          setPlaying(true)
          setMusicNote('')
        })
        .catch(() => {
          setPlaying(false)
          setMusicNote(
            "Track unavailable on this site — sample music isn't published with the app; upload your own in the Music section below.",
          )
        })
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  return (
    <div className={`${display.variable} ${body.variable} ${script.variable}`}>
      <style>{GUEST_THEME}</style>
      <div className="relative overflow-hidden rounded-[28px] border-[6px] border-slate-900 bg-slate-900 shadow-xl">
        {config.music && (
          <>
            <audio ref={audioRef} src={config.music} loop preload="none" />
            <button
              onClick={toggleMusic}
              aria-label={playing ? 'Pause preview music' : 'Play preview music'}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/45 text-sm text-white backdrop-blur-sm"
            >
              <span className={playing ? 'gv-spin inline-block' : 'inline-block opacity-60'}>♪</span>
            </button>
          </>
        )}
        <div
          ref={frameRef}
          className="h-[620px] overflow-y-auto overscroll-contain rounded-[22px]"
        >
          {/* zoom keeps layout + scroll math consistent while miniaturizing */}
          <div className={`gv-shell ${tplClass} pb-8`} style={{ width: 390, zoom }}>
            <div className="pointer-events-none">
              {template === 'editorial' ? (
                <EdHero
                  coupleNames={event.couple_names}
                  dateLine={dateLine}
                  greetName="Guest"
                  photo={config.photos?.hero}
                />
              ) : template === 'polaroid' ? (
                <PolHero
                  coupleNames={event.couple_names}
                  dateLine={dateLine}
                  greetName="Guest"
                  photo={config.photos?.hero}
                />
              ) : (
                <InviteHero
                  coupleNames={event.couple_names}
                  dateLine={dateLine}
                  greetName="Guest"
                  photo={config.photos?.hero}
                />
              )}
              {template === 'editorial' && (
                <>
                  <EdSplit
                    bride={config.bride_name}
                    groom={config.groom_name}
                    bridePhoto={config.photos?.bride}
                    groomPhoto={config.photos?.groom}
                  />
                  <EdStrip photos={gallery} />
                </>
              )}
              {template === 'polaroid' && (
                <>
                  <PolDuo
                    bride={config.bride_name}
                    groom={config.groom_name}
                    bridePhoto={config.photos?.bride}
                    groomPhoto={config.photos?.groom}
                  />
                  <PolGallery photos={gallery} />
                </>
              )}
              {template === 'classic' && (
                <>
                  <InviteEditorial photo={config.photos?.editorial} />
                  <InviteNames
                    bride={config.bride_name}
                    groom={config.groom_name}
                    bridePhoto={config.photos?.bride}
                    groomPhoto={config.photos?.groom}
                  />
                  {(config.red_accent ?? true) && (
                    <InviteRedDuo
                      bridePhoto={config.photos?.bride}
                      groomPhoto={config.photos?.groom}
                    />
                  )}
                </>
              )}
              <InviteCalendar eventDate={event.event_date} backdrop={config.photos?.candid1} />
              <InviteCountdown eventDate={event.event_date} />
              {venue && (
                <InviteDetails event={previewEvent} venue={venue} startsAt={event.starts_at} />
              )}
              <InviteLetter
                lines={config.letter ?? DEFAULT_LETTER}
                photos={{ candid1: config.photos?.candid1, candid2: config.photos?.candid2 }}
              />
              <InviteRsvp event={previewEvent} prefill={null} deadline={config.rsvp_deadline} />
              <footer className="py-10 text-center">
                <p className="gv-caps text-[11px] text-(--ink-faint)">SEATMAP</p>
              </footer>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        Live preview · updates as you edit · scroll inside the phone
      </p>
      {musicNote && (
        <p className="mt-1 text-center text-[11px] text-amber-600">{musicNote}</p>
      )}
    </div>
  )
}
