'use client'

import { useState } from 'react'
import {
  detectColumns,
  FIELD_LABELS,
  parseSpreadsheet,
  rowsToGuests,
  type ColumnMapping,
} from '@/lib/import'
import type { Guest } from '@/lib/types'

interface Props {
  eventId: string
  onImport: (guests: Guest[]) => Promise<void>
  onClose: () => void
}

export function ImportDialog({ eventId, onImport, onClose }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<unknown[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const { headers, rows } = await parseSpreadsheet(file)
      if (headers.length === 0) {
        setError('That file looks empty — no header row found.')
        return
      }
      setHeaders(headers)
      setRows(rows)
      setMapping(detectColumns(headers))
    } catch (err) {
      console.error(err)
      setError('Could not read that file. Is it a CSV or Excel sheet?')
    }
  }

  const preview = mapping ? rowsToGuests(rows.slice(0, 5), mapping, eventId) : []
  const total = mapping ? rowsToGuests(rows, mapping, eventId).length : 0

  async function commit() {
    if (!mapping) return
    setBusy(true)
    await onImport(rowsToGuests(rows, mapping, eventId))
    setBusy(false)
    onClose()
  }

  const fields = Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-6">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Import guests</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        {!mapping && (
          <label className="mt-4 flex h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-slate-400">
            <span className="font-medium">Choose a CSV or Excel file</span>
            <span className="mt-1 text-xs">
              Headers like “Guest Name”, “No. of Pax”, “名字” are auto-detected
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onFile}
            />
          </label>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {mapping && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Column mapping
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fields.map((f) => (
                <label key={f} className="text-xs text-slate-600">
                  {FIELD_LABELS[f]}
                  <select
                    value={mapping[f] ?? ''}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        [f]: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                  >
                    <option value="">— not in file —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Preview — {total} guest(s) will be imported
            </h3>
            {mapping.name === null ? (
              <p className="mt-2 text-sm text-amber-600">
                Map the Name column to continue — every guest needs a name.
              </p>
            ) : (
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1 pr-2">Name</th>
                    <th className="py-1 pr-2">Phone</th>
                    <th className="py-1 pr-2">Pax</th>
                    <th className="py-1 pr-2">Side</th>
                    <th className="py-1 pr-2">Group</th>
                    <th className="py-1">VIP</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {preview.map((g) => (
                    <tr key={g.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 font-medium">{g.name}</td>
                      <td className="py-1.5 pr-2">{g.phone ?? '—'}</td>
                      <td className="py-1.5 pr-2">{g.party_size}</td>
                      <td className="py-1.5 pr-2">{g.side}</td>
                      <td className="py-1.5 pr-2">{g.group_tag ?? '—'}</td>
                      <td className="py-1.5">{g.is_vip ? '★' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setMapping(null)
                  setHeaders([])
                  setRows([])
                }}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Different file
              </button>
              <button
                onClick={commit}
                disabled={busy || total === 0 || mapping.name === null}
                className="rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
              >
                {busy ? 'Importing…' : `Import ${total} guests`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
