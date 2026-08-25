'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

export interface InviteAudioHandle {
  /** Call from a user-gesture handler (the envelope tap) to satisfy autoplay policy. */
  start: () => void
}

/**
 * Looping background music with a floating disc toggle. Playback only ever
 * starts from the envelope tap (a real user gesture) — never on load.
 */
export const InviteAudio = forwardRef<InviteAudioHandle, { src: string }>(
  function InviteAudio({ src }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [playing, setPlaying] = useState(false)
    const [started, setStarted] = useState(false)

    useImperativeHandle(ref, () => ({
      start() {
        const a = audioRef.current
        if (!a) return
        a.play()
          .then(() => {
            setStarted(true)
            setPlaying(true)
          })
          .catch(() => setStarted(true)) // blocked → show the disc, let them tap it
      },
    }))

    function toggle() {
      const a = audioRef.current
      if (!a) return
      if (a.paused) {
        a.play()
          .then(() => setPlaying(true))
          .catch(() => {})
      } else {
        a.pause()
        setPlaying(false)
      }
    }

    return (
      <>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} src={src} loop preload="none" />
        {started && (
          <button
            onClick={toggle}
            aria-label={playing ? 'Pause music' : 'Play music'}
            className="fixed right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-(--gold-soft) bg-(--card)/90 text-lg text-(--gold) shadow-md backdrop-blur-sm"
          >
            {/* spin the glyph, not the button — geometry stays stable for taps */}
            <span className={playing ? 'gv-spin inline-block' : 'inline-block opacity-40'}>
              ♪
            </span>
          </button>
        )}
      </>
    )
  },
)
