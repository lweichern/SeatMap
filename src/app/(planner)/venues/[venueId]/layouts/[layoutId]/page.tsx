'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { use, useEffect, useRef, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { useEditor } from '@/stores/editor'
import { Toolbar } from '@/components/editor/Toolbar'
import { Inspector } from '@/components/editor/Inspector'
import type { Venue } from '@/lib/types'

// Konva touches window/canvas — never render it on the server.
const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading canvas…
    </div>
  ),
})

type SaveState = 'clean' | 'saving' | 'saved' | 'error'

export default function EditorPage({
  params,
}: {
  params: Promise<{ venueId: string; layoutId: string }>
}) {
  const { venueId, layoutId } = use(params)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [missing, setMissing] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('clean')
  const venueRef = useRef<Venue | null>(null)

  // Load venue + layout into the editor store
  useEffect(() => {
    let alive = true
    ;(async () => {
      const repo = getRepo()
      const [v, l] = await Promise.all([repo.getVenue(venueId), repo.getLayout(layoutId)])
      if (!alive) return
      if (!v || !l) {
        setMissing(true)
        return
      }
      venueRef.current = v
      setVenue(v)
      useEditor.getState().loadLayout({
        venueId,
        layoutId,
        layoutName: l.name,
        walls: v.walls,
        entrance: v.entrance,
        stage: v.stage,
        floorplanUrl: v.floorplan_url,
        scalePxPerM: v.scale_px_per_metre,
        tables: l.tables,
      })
    })()
    return () => {
      alive = false
      useEditor.getState().reset()
    }
  }, [venueId, layoutId])

  // Debounced autosave whenever the store goes dirty
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useEditor.subscribe((s) => {
      if (!s.dirty || !venueRef.current) return
      // Pending edits must never display as "Saved" — the debounce window is
      // exactly when closing the tab would lose work.
      setSaveState('saving')
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const st = useEditor.getState()
        const base = venueRef.current!
        const updated: Venue = {
          ...base,
          walls: st.walls,
          entrance: st.entrance,
          stage: st.stage,
          floorplan_url: st.floorplanUrl,
          scale_px_per_metre: st.scalePxPerM,
        }
        try {
          const repo = getRepo()
          await repo.saveVenue(updated)
          await repo.saveLayout(
            {
              id: layoutId,
              venue_id: venueId,
              name: st.layoutName || 'Untitled layout',
              capacity_total: st.tables.reduce((sum, t) => sum + t.seats, 0),
            },
            st.tables,
          )
          venueRef.current = updated
          st.markSaved()
          setSaveState('saved')
        } catch (err) {
          console.error('autosave failed', err)
          setSaveState('error')
        }
      }, 800)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [venueId, layoutId])

  // Unsaved edits (debounce window or failed save) → warn before leaving
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (useEditor.getState().dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const layoutName = useEditor((s) => s.layoutName)

  if (missing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <p>Venue or layout not found.</p>
        <Link href="/venues" className="text-slate-900 underline">
          Back to venue library
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href="/venues" className="text-sm text-slate-400 hover:text-slate-700">
          ← Venues
        </Link>
        <span className="text-sm font-medium text-slate-900">{venue?.name}</span>
        <span className="text-slate-300">/</span>
        <input
          value={layoutName}
          onChange={(e) =>
            useEditor.setState({ layoutName: e.target.value, dirty: true })
          }
          className="rounded border border-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
        />
        <span className="ml-auto text-xs text-slate-400">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved ✓'}
          {saveState === 'error' && <span className="text-red-500">Save failed — retrying on next edit</span>}
        </span>
      </div>
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <EditorCanvas />
        </div>
        <Inspector />
      </div>
    </div>
  )
}
