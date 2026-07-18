'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { getGreeterDb } from '@/lib/greeter-db'
import { flushOutbox, startSyncLoop } from '@/lib/greeter-sync'
import { Scanner } from '@/components/greeter/Scanner'
import type { Guest, VenueTable } from '@/lib/types'

type Tab = 'scan' | 'search' | 'walkin' | 'tables'

type Result =
  | { kind: 'ok'; guest: Guest; table: VenueTable | null; already: boolean }
  | { kind: 'invalid' }

export default function CheckinPage() {
  const [tab, setTab] = useState<Tab>('scan')
  const [status, setStatus] = useState<Awaited<ReturnType<ReturnType<typeof getGreeterDb>['status']>> | null>(null)
  const [online, setOnline] = useState(true)
  const [result, setResult] = useState<Result | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Guest[]>([])
  const [occ, setOcc] = useState<Awaited<ReturnType<ReturnType<typeof getGreeterDb>['occupancy']>>>([])
  const [walkin, setWalkin] = useState({ name: '', tableId: '', party: 1 })

  const refreshStatus = useCallback(async () => {
    setStatus(await getGreeterDb().status())
  }, [])

  // don't wait for the 30s loop — push each action up as soon as it happens
  const syncSoon = useCallback(() => {
    setTimeout(() => {
      flushOutbox()
        .then(refreshStatus)
        .catch(() => {}) // offline — the loop retries later
    }, 400)
  }, [refreshStatus])

  useEffect(() => {
    refreshStatus()
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const stopSync = startSyncLoop(() => refreshStatus())
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      stopSync()
    }
  }, [refreshStatus])

  useEffect(() => {
    if (tab === 'tables' || tab === 'walkin') getGreeterDb().occupancy().then(setOcc)
  }, [tab, result])

  const handleToken = useCallback(
    async (token: string) => {
      const db = getGreeterDb()
      const hit = await db.lookupToken(token)
      if (!hit) {
        setResult({ kind: 'invalid' })
        return
      }
      const already = !!hit.guest.checked_in_at
      if (!already) await db.checkIn(hit.guest.id, new Date().toISOString())
      const guest = (await db.getGuest(hit.guest.id))!
      setResult({ kind: 'ok', guest, table: hit.table, already })
      refreshStatus()
    syncSoon()
    },
    [refreshStatus],
  )

  async function checkInGuest(g: Guest) {
    const db = getGreeterDb()
    const already = !!g.checked_in_at
    if (!already) await db.checkIn(g.id, new Date().toISOString())
    const guest = (await db.getGuest(g.id))!
    const table = guest.table_id
      ? ((await db.occupancy()).find((o) => o.table.id === guest.table_id)?.table ?? null)
      : null
    setResult({ kind: 'ok', guest, table, already })
    setQuery('')
    setHits([])
    setTab('scan')
    refreshStatus()
    syncSoon()
  }

  async function undo(guestId: string) {
    await getGreeterDb().undoCheckIn(guestId, new Date().toISOString())
    setResult(null)
    refreshStatus()
    syncSoon()
  }

  async function submitWalkin() {
    if (!walkin.name.trim() || !walkin.tableId) return
    const db = getGreeterDb()
    const guest = await db.addWalkIn(walkin.name, walkin.tableId, walkin.party)
    const table = (await db.occupancy()).find((o) => o.table.id === walkin.tableId)?.table ?? null
    setWalkin({ name: '', tableId: '', party: 1 })
    setResult({ kind: 'ok', guest, table, already: false })
    setTab('scan')
    refreshStatus()
    syncSoon()
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`flex-1 rounded-lg py-3 text-sm font-semibold ${
        tab === t ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-4">
      {/* status bar */}
      <div className="flex items-center gap-2 text-xs">
        <Link href="/greeter" className="text-slate-500 hover:text-slate-300">
          ⚙
        </Link>
        <span className="font-semibold text-slate-300">{status?.coupleNames}</span>
        <span className="text-slate-500">· {status?.guestCount ?? 0} guests cached</span>
        <span className="ml-auto flex items-center gap-2">
          {(status?.pendingOps ?? 0) > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-medium text-amber-400">
              {status!.pendingOps} to sync
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {online ? 'Online' : 'Offline — check-ins still work'}
          </span>
        </span>
      </div>

      {/* result card — the thing the guest sees */}
      {result && (
        <div
          className={`mt-4 rounded-2xl p-6 text-center ${
            result.kind === 'invalid'
              ? 'bg-red-500/15 ring-2 ring-red-500'
              : result.already
                ? 'bg-amber-500/15 ring-2 ring-amber-500'
                : 'bg-emerald-500/15 ring-2 ring-emerald-500'
          }`}
        >
          {result.kind === 'invalid' ? (
            <>
              <p className="text-3xl font-black text-red-400">Not recognised</p>
              <p className="mt-2 text-sm text-slate-300">
                QR not valid for this event — try search, or add as walk-in.
              </p>
            </>
          ) : (
            <>
              {result.already && (
                <p className="text-sm font-bold uppercase tracking-wide text-amber-400">
                  Already checked in
                </p>
              )}
              <p className="text-3xl font-bold">{result.guest.name}</p>
              {result.guest.party_size > 1 && (
                <p className="text-sm text-slate-300">Party of {result.guest.party_size}</p>
              )}
              <p className="mt-3 text-7xl font-black tracking-tight text-amber-400">
                {result.table ? `TABLE ${result.table.label}` : 'NO TABLE'}
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => undo(result.guest.id)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300"
                >
                  Undo check-in
                </button>
                <button
                  onClick={() => setResult(null)}
                  className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-bold text-slate-900"
                >
                  Next guest →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* tabs */}
      <div className="mt-4 flex gap-2">
        {tabBtn('scan', 'Scan')}
        {tabBtn('search', 'Search')}
        {tabBtn('walkin', 'Walk-in')}
        {tabBtn('tables', 'Tables')}
      </div>

      <div className="mt-4 flex-1">
        {tab === 'scan' && <Scanner onToken={handleToken} />}

        {tab === 'search' && (
          <div>
            <input
              autoFocus
              value={query}
              onChange={async (e) => {
                setQuery(e.target.value)
                setHits(await getGreeterDb().search(e.target.value))
              }}
              placeholder="Name or phone…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-500"
            />
            <ul className="mt-3 space-y-2">
              {hits.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => checkInGuest(g)}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-800 px-4 py-3 text-left hover:bg-slate-700"
                  >
                    <span>
                      <span className="font-semibold">{g.name}</span>
                      {g.party_size > 1 && (
                        <span className="ml-2 text-xs text-slate-400">×{g.party_size}</span>
                      )}
                      {g.checked_in_at && (
                        <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                          checked in
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-slate-400">{g.phone}</span>
                  </button>
                </li>
              ))}
              {query && hits.length === 0 && (
                <p className="text-sm text-slate-500">
                  No match — add them as a walk-in.
                </p>
              )}
            </ul>
          </div>
        )}

        {tab === 'walkin' && (
          <div className="space-y-3">
            <input
              value={walkin.name}
              onChange={(e) => setWalkin({ ...walkin, name: e.target.value })}
              placeholder="Guest name"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-500"
            />
            <div className="flex gap-3">
              <select
                value={walkin.tableId}
                onChange={(e) => setWalkin({ ...walkin, tableId: e.target.value })}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-slate-100"
              >
                <option value="">Table with space…</option>
                {occ.map((o) => (
                  <option key={o.table.id} value={o.table.id}>
                    Table {o.table.label} — {(o.table.seats ?? 0) - o.totalPax} seats free
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={walkin.party}
                onChange={(e) =>
                  setWalkin({ ...walkin, party: Math.max(1, Number(e.target.value)) })
                }
                className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-slate-100"
              />
            </div>
            <button
              onClick={submitWalkin}
              disabled={!walkin.name.trim() || !walkin.tableId}
              className="w-full rounded-lg bg-amber-500 py-3 font-bold text-slate-900 disabled:opacity-40"
            >
              Add & check in
            </button>
          </div>
        )}

        {tab === 'tables' && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {occ.map((o) => {
              const ratio = o.totalPax === 0 ? 0 : o.checkedInPax / o.totalPax
              return (
                <div key={o.table.id} className="rounded-lg bg-slate-800 p-3 text-center">
                  <p className="text-lg font-bold">{o.table.label}</p>
                  <p
                    className={`text-sm font-semibold ${
                      ratio === 1 && o.totalPax > 0
                        ? 'text-emerald-400'
                        : ratio > 0
                          ? 'text-amber-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {o.checkedInPax}/{o.totalPax}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-700">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
