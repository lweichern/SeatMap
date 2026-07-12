'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onToken: (token: string) => void
}

/**
 * QR scanner: camera via @zxing/browser, plus a manual entry field that always
 * works (damaged QR, no camera permission, testing). The token may arrive as a
 * full URL (https://…/g/<token>) or bare — both accepted.
 */
export function Scanner({ onToken }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraError, setCameraError] = useState('')
  const [manual, setManual] = useState('')
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })

  useEffect(() => {
    let stop: (() => void) | null = null
    let cancelled = false
    ;(async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        if (cancelled || !videoRef.current) return
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return
            const text = result.getText()
            // debounce repeat decodes of the same code held in frame
            const now = performance.now()
            if (lastRef.current.text === text && now - lastRef.current.at < 3000) return
            lastRef.current = { text, at: now }
            onToken(extractToken(text))
          },
        )
        stop = () => controls.stop()
      } catch (err) {
        console.warn('camera unavailable', err)
        if (!cancelled) setCameraError('Camera unavailable — use manual entry below.')
      }
    })()
    return () => {
      cancelled = true
      stop?.()
    }
  }, [onToken])

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 p-4 text-center text-sm text-slate-400">
            {cameraError}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 border-[3px] border-amber-400/60 [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,0_20%,20%_20%,20%_80%,80%_80%,80%_20%,0_20%)]" />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) {
            onToken(extractToken(manual))
            setManual('')
          }
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste/type the QR link…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900"
        >
          Check
        </button>
      </form>
    </div>
  )
}

function extractToken(input: string): string {
  const s = input.trim()
  const m = s.match(/\/g\/([A-Za-z0-9_.-]+)/)
  return m ? m[1] : s
}
