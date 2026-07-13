'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { use, useEffect, useMemo, useRef, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { useEditor } from '@/stores/editor'
import { findPath, type RouteResult } from '@/lib/pathfinding'
import { seatsOf } from '@/lib/layout-ops'
import { Canvas2D } from '@/components/hall-editor/Canvas2D'
import { Rail } from '@/components/hall-editor/Rail'
import { Inspector } from '@/components/hall-editor/Inspector'
import type { Venue } from '@/lib/types'

const Preview3D = dynamic(() => import('@/components/hall-editor/Preview3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-slate-500">
      Loading 3D preview…
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
  const [unreachable, setUnreachable] = useState<string[]>([])
  const venueRef = useRef<Venue | null>(null)

  // load venue + layout into the editor store
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
      useEditor.getState().loadVenueLayout({
        venueId,
        layoutId,
        layoutName: l.name,
        floorplanUrl: v.floorplan_url,
        scalePxPerM: v.scale_px_per_metre,
        walls: v.walls,
        door: v.door,
        doorWidthM: v.door_width_m,
        registration: v.registration,
        stage: v.stage,
        clearM: v.clear_m,
        tables: l.tables,
      })
    })()
    return () => {
      alive = false
      useEditor.getState().reset()
    }
  }, [venueId, layoutId])

  // debounced autosave — "Saving…" from the first pending edit
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useEditor.subscribe((s) => {
      if (!s.dirty || !venueRef.current) return
      setSaveState('saving')
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const st = useEditor.getState()
        const base = venueRef.current!
        const updated: Venue = {
          ...base,
          floorplan_url: st.floorplanUrl,
          scale_px_per_metre: st.scalePxPerM,
          walls: st.walls,
          door: st.door,
          door_width_m: st.doorWidthM,
          registration: st.registration,
          stage: st.stage,
          clear_m: st.clearM,
        }
        try {
          const repo = getRepo()
          await repo.saveVenue(updated)
          await repo.saveLayout(
            {
              id: layoutId,
              venue_id: venueId,
              name: st.layoutName || 'Untitled layout',
              capacity_total: st.tables.reduce((sum, t) => sum + seatsOf(t), 0),
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

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (useEditor.getState().dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const s = useEditor()

  const venueGeom = useMemo(
    () =>
      ({
        ...(venueRef.current ?? ({} as Venue)),
        walls: s.walls,
        door: s.door,
        door_width_m: s.doorWidthM,
        registration: s.registration,
        stage: s.stage,
        clear_m: s.clearM,
      }) as Venue,
    [s.walls, s.door, s.doorWidthM, s.registration, s.stage, s.clearM],
  )

  // route re-solves whenever the selected target or the room changes
  const route: RouteResult | null = useMemo(() => {
    if (!s.routeTargetId || (!s.door && !s.registration)) return null
    return findPath(venueGeom, s.tables, s.routeTargetId)
  }, [venueGeom, s.tables, s.routeTargetId, s.door, s.registration])

  // validation pass: desk → EVERY seating table, debounced. Five-line loop,
  // catches a real class of layout error before wedding day.
  useEffect(() => {
    if (!s.door && !s.registration) {
      setUnreachable([])
      return
    }
    const t = setTimeout(() => {
      const bad: string[] = []
      for (const table of s.tables) {
        if (table.kind !== 'seat') continue
        const r = findPath(venueGeom, s.tables, table.id)
        if (r && !r.ok) bad.push(table.label)
      }
      setUnreachable(bad)
    }, 1200)
    return () => clearTimeout(t)
  }, [venueGeom, s.tables, s.door, s.registration])

  const sceneProps = {
    walls: s.walls,
    door: s.door,
    doorWidthM: s.doorWidthM,
    registration: s.registration,
    stage: s.stage,
    tables: s.tables,
    highlightTableId: s.routeTargetId,
    route,
  }

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

  const seatTables = s.tables.filter((t) => t.kind === 'seat')
  const stations = s.tables.length - seatTables.length
  const seats = s.tables.reduce((sum, t) => sum + seatsOf(t), 0)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href="/venues" className="text-sm text-slate-400 hover:text-slate-700">
          ← Venues
        </Link>
        <span className="text-sm font-medium text-slate-900">{venue?.name}</span>
        <span className="text-slate-300">/</span>
        <input
          value={s.layoutName}
          onChange={(e) => useEditor.setState({ layoutName: e.target.value, dirty: true })}
          className="rounded border border-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
        />
        <span className="text-xs text-slate-400">
          {seatTables.length} tables · {seats} seats · {stations} station
          {stations === 1 ? '' : 's'}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved ✓'}
          {saveState === 'error' && (
            <span className="text-red-500">Save failed — retrying on next edit</span>
          )}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <Rail unreachable={unreachable} />
        <div className="min-w-0 flex-1">
          <Canvas2D route={route} unreachableIds={unreachable} />
        </div>
        <div className="flex w-95 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="h-[46%] min-h-56 border-b border-slate-200 bg-slate-950">
            <Preview3D {...sceneProps} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Inspector />
          </div>
        </div>
      </div>
    </div>
  )
}
