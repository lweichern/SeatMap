'use client'

import { useEditor } from '@/stores/editor'
import { seatsOf } from '@/lib/layout-ops'
import { SERVICE_NAME_PRESETS } from '@/lib/types'

const ROT_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 15)

/** Stage / registration desk properties: rotation + delete. */
function FixtureInspector({ kind }: { kind: 'stage' | 'registration' }) {
  const stage = useEditor((s) => s.stage)
  const registration = useEditor((s) => s.registration)
  const setStage = useEditor((s) => s.setStage)
  const setRegistration = useEditor((s) => s.setRegistration)
  const setSelectedFixture = useEditor((s) => s.setSelectedFixture)

  const rot = (kind === 'stage' ? stage?.rot : registration?.rot) ?? 0
  const input = 'mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm'

  function setRot(deg: number) {
    if (kind === 'stage' && stage) setStage({ ...stage, rot: deg })
    if (kind === 'registration' && registration)
      setRegistration({ ...registration, rot: deg })
  }

  function remove() {
    if (kind === 'stage') setStage(null)
    else setRegistration(null)
    setSelectedFixture(null)
  }

  return (
    <div className="p-3 text-sm">
      <h3 className="font-semibold text-slate-900">
        {kind === 'stage' ? 'Stage' : 'Registration desk'}
      </h3>

      {kind === 'stage' && stage && (
        <div className="mt-2 flex gap-2">
          <label className="block flex-1 text-xs text-slate-600">
            Width (m)
            <input
              type="number"
              step={0.5}
              min={1}
              max={30}
              defaultValue={stage.w}
              key={`stage-w-${stage.w}`}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (Number.isFinite(v) && v >= 1 && v <= 30) setStage({ ...stage, w: v })
              }}
              className={input}
            />
          </label>
          <label className="block flex-1 text-xs text-slate-600">
            Depth (m)
            <input
              type="number"
              step={0.5}
              min={1}
              max={20}
              defaultValue={stage.h}
              key={`stage-h-${stage.h}`}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (Number.isFinite(v) && v >= 1 && v <= 20) setStage({ ...stage, h: v })
              }}
              className={input}
            />
          </label>
        </div>
      )}

      <label className="mt-2 block text-xs text-slate-600">
        Rotation
        <select value={rot} onChange={(e) => setRot(Number(e.target.value))} className={input}>
          {ROT_OPTIONS.map((deg) => (
            <option key={deg} value={deg}>
              {deg}°
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={remove}
        className="mt-4 w-full rounded-md border border-red-200 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  )
}

/**
 * Selected-object properties. ⚠️ Number fields guard against half-typed
 * values — clearing a field to retype parses to NaN and poisons geometry, so
 * out-of-range values are simply not committed.
 */
export function Inspector() {
  const tables = useEditor((s) => s.tables)
  const selectedIds = useEditor((s) => s.selectedIds)
  const selectedFixture = useEditor((s) => s.selectedFixture)
  const updateTable = useEditor((s) => s.updateTable)
  const removeSelected = useEditor((s) => s.removeSelected)

  const t = tables.find((x) => selectedIds.includes(x.id))

  if (!t && selectedFixture) return <FixtureInspector kind={selectedFixture} />

  if (!t) {
    const seatTables = tables.filter((x) => x.kind === 'seat')
    const stations = tables.length - seatTables.length
    const seats = tables.reduce((s, x) => s + seatsOf(x), 0)
    return (
      <div className="p-3 text-sm">
        <h3 className="font-semibold text-slate-900">Layout</h3>
        <p className="mt-2 text-slate-500">
          {seatTables.length} tables · {seats} seats · {stations} station{stations === 1 ? '' : 's'}
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Select an object to edit it. Click a seating table to preview the
          guest walking route.
        </p>
      </div>
    )
  }

  const num =
    (field: 'seats' | 'dia' | 'len' | 'wid', lo: number, hi: number, isInt = false) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value)
      if (!Number.isFinite(v) || v < lo || v > hi) return // don't commit garbage
      updateTable(t.id, { [field]: v })
    }

  const input = 'mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm'
  const isService = t.kind === 'service'

  return (
    <div className="p-3 text-sm">
      <h3 className="font-semibold text-slate-900">
        {isService ? t.label : `Table ${t.label}`}
        <span className="ml-2 text-xs font-normal text-slate-400">{t.shape}</span>
      </h3>

      {isService ? (
        <label className="mt-3 block text-xs text-slate-600">
          Name
          <input
            list="service-names"
            value={t.label}
            onChange={(e) => updateTable(t.id, { label: e.target.value })}
            className={input}
          />
          <datalist id="service-names">
            {SERVICE_NAME_PRESETS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
      ) : (
        <>
          <label className="mt-3 block text-xs text-slate-600">
            Label
            <input
              value={t.label}
              onChange={(e) => updateTable(t.id, { label: e.target.value })}
              className={input}
            />
          </label>
          <label className="mt-2 block text-xs text-slate-600">
            Seats
            <input
              type="number"
              min={1}
              max={30}
              defaultValue={t.seats}
              key={`${t.id}-seats`}
              onChange={num('seats', 1, 30, true)}
              className={input}
            />
          </label>
        </>
      )}

      {t.shape === 'round' ? (
        <label className="mt-2 block text-xs text-slate-600">
          Diameter (m)
          <input
            type="number"
            step={0.1}
            min={0.5}
            max={8}
            defaultValue={t.dia}
            key={`${t.id}-dia`}
            onChange={num('dia', 0.5, 8)}
            className={input}
          />
        </label>
      ) : (
        <div className="mt-2 flex gap-2">
          <label className="block flex-1 text-xs text-slate-600">
            Length (m)
            <input
              type="number"
              step={0.1}
              min={0.5}
              max={12}
              defaultValue={t.len}
              key={`${t.id}-len`}
              onChange={num('len', 0.5, 12)}
              className={input}
            />
          </label>
          <label className="block flex-1 text-xs text-slate-600">
            Width (m)
            <input
              type="number"
              step={0.1}
              min={0.4}
              max={8}
              defaultValue={t.wid}
              key={`${t.id}-wid`}
              onChange={num('wid', 0.4, 8)}
              className={input}
            />
          </label>
        </div>
      )}

      {t.shape !== 'round' && (
        <label className="mt-2 block text-xs text-slate-600">
          Rotation
          <select
            value={t.rot ?? 0}
            onChange={(e) => updateTable(t.id, { rot: Number(e.target.value) })}
            className={input}
          >
            {Array.from({ length: 24 }, (_, i) => i * 15).map((deg) => (
              <option key={deg} value={deg}>
                {deg}°
              </option>
            ))}
          </select>
        </label>
      )}

      {(t.shape === 'banquet' || t.shape === 'square') && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={t.ends ?? true}
            onChange={(e) => updateTable(t.id, { ends: e.target.checked })}
          />
          Seat the short ends
          <span className="text-slate-400">(off = head table)</span>
        </label>
      )}

      <button
        onClick={removeSelected}
        className="mt-4 w-full rounded-md border border-red-200 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  )
}
