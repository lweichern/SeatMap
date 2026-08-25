'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { newTableId } from '@/lib/layout-ops'
import { ImportDialog } from '@/components/guests/ImportDialog'
import { ConstraintsPanel } from '@/components/guests/ConstraintsPanel'
import { DietarySteppers } from '@/components/DietarySteppers'
import { normalizeDietary, summarizeDietary } from '@/lib/kitchen'
import {
  downloadBlob,
  ensureTokens,
  exportPdfSheet,
  exportPngZip,
} from '@/lib/qr-export'
import { signToken } from '@/lib/token'
import { downloadPosterPng } from '@/lib/poster'
import { getShareOrigin } from '@/lib/share-origin'
import type { Guest, GuestConstraint, GuestSide, WeddingEvent } from '@/lib/types'

type SideFilter = 'all' | GuestSide
const EMPTY_NEW = { name: '', party: 1 }

export default function GuestsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [constraints, setConstraints] = useState<GuestConstraint[]>([])
  const [q, setQ] = useState('')
  const [side, setSide] = useState<SideFilter>('all')
  const [vipOnly, setVipOnly] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newGuest, setNewGuest] = useState(EMPTY_NEW)
  const [exporting, setExporting] = useState<'' | 'pdf' | 'zip'>('')
  const [inviteNote, setInviteNote] = useState('')
  const [menu, setMenu] = useState<'' | 'invite' | 'io'>('')
  const [dietFor, setDietFor] = useState<{ id: string; top: number; left: number } | null>(null)

  const refresh = useCallback(async () => {
    const repo = getRepo()
    const [e, gs, cs] = await Promise.all([
      repo.getEvent(eventId),
      repo.listGuests(eventId),
      repo.listConstraints(eventId),
    ])
    setEvent(e)
    setGuests(gs)
    setConstraints(cs)
  }, [eventId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return guests.filter((g) => {
      if (needle && !g.name.toLowerCase().includes(needle) && !(g.phone ?? '').includes(needle))
        return false
      if (side !== 'all' && g.side !== side) return false
      if (vipOnly && !g.is_vip) return false
      return true
    })
  }, [guests, q, side, vipOnly])

  const totalPax = guests.reduce((s, g) => s + g.party_size, 0)

  async function patch(id: string, p: Partial<Guest>) {
    const g = guests.find((x) => x.id === id)
    if (!g) return
    const updated = { ...g, ...p }
    setGuests((gs) => gs.map((x) => (x.id === id ? updated : x)))
    await getRepo().saveGuest(updated)
  }

  /** Normalize the raw in-progress dietary edits once, when the popover closes. */
  const closeDiet = (g: Guest) => {
    patch(g.id, { dietary: normalizeDietary(g.dietary) ?? null })
    setDietFor(null)
  }

  async function addManual() {
    const name = newGuest.name.trim()
    if (!name) return
    await getRepo().saveGuest({
      id: newTableId(),
      event_id: eventId,
      name,
      phone: null,
      email: null,
      party_size: newGuest.party,
      side: 'both',
      group_tag: null,
      is_vip: false,
      table_id: null,
      qr_token: null,
      checked_in_at: null,
      locked: false,
    })
    setNewGuest(EMPTY_NEW)
    refresh()
  }

  // QR export: sign tokens for any guest missing one, persist, then download.
  async function exportQr(kind: 'pdf' | 'zip') {
    if (!event || guests.length === 0) return
    setExporting(kind)
    try {
      const withTokens = await ensureTokens(event, guests)
      const fresh = withTokens.filter((g, i) => g !== guests[i])
      if (fresh.length > 0) {
        await getRepo().saveGuests(fresh)
        setGuests(withTokens)
      }
      const origin = await getShareOrigin()
      const slug = event.couple_names.replace(/\s+/g, '-').toLowerCase()
      if (kind === 'pdf') {
        downloadBlob(
          await exportPdfSheet(event, withTokens, origin),
          `qr-sheet-${slug}.pdf`,
        )
      } else {
        downloadBlob(await exportPngZip(withTokens, origin), `qr-codes-${slug}.zip`)
      }
    } finally {
      setExporting('')
    }
  }

  async function rsvpUrl(): Promise<string | null> {
    if (!event) return null
    const token = await signToken(event.id, 'rsvp', event.guest_token_secret)
    return `${await getShareOrigin()}/invite/${token}`
  }

  async function copyInviteLink() {
    const url = await rsvpUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setInviteNote('Invitation link copied — share it anywhere ✓')
      setTimeout(() => setInviteNote(''), 4000)
    } catch {
      // clipboard blocked (permissions/embedded browser) — show it instead
      setInviteNote(url)
    }
  }

  async function downloadInviteQr() {
    const url = await rsvpUrl()
    if (!url || !event) return
    await downloadPosterPng({
      eyebrow: "You're invited to the wedding of",
      title: event.couple_names,
      subtitle: formatDate(event.event_date),
      instruction: 'Scan to RSVP',
      url,
      filename: `rsvp-${event.couple_names.replace(/\s+/g, '-').toLowerCase()}.png`,
    })
  }

  async function downloadFindQr() {
    if (!event) return
    const token = await signToken(event.id, 'kiosk', event.guest_token_secret)
    const url = `${await getShareOrigin()}/find/${token}`
    await downloadPosterPng({
      eyebrow: 'Welcome to the wedding of',
      title: event.couple_names,
      subtitle: formatDate(event.event_date),
      instruction: 'Scan to find your seat',
      url,
      filename: `find-my-seat-${event.couple_names.replace(/\s+/g, '-').toLowerCase()}.png`,
    })
  }

  /** "2026-09-12" → "12 September 2026" (falls back to the raw string). */
  function formatDate(d: string) {
    const t = new Date(`${d}T00:00:00`)
    return isNaN(t.getTime())
      ? d
      : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const rsvpYes = guests.filter((g) => g.rsvp === 'yes').length
  const rsvpNo = guests.filter((g) => g.rsvp === 'no').length

  const input = 'rounded border border-slate-300 px-2 py-1 text-xs w-full'

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* row 1: identity + stats */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href="/events"
          className="whitespace-nowrap text-sm text-slate-400 hover:text-slate-700"
        >
          ← Events
        </Link>
        <h1 className="whitespace-nowrap text-xl font-bold text-slate-900">
          {event?.couple_names}
        </h1>
        <span className="whitespace-nowrap text-sm text-slate-400">
          {guests.length} guests · {totalPax} pax
        </span>
        {(rsvpYes > 0 || rsvpNo > 0) && (
          <span className="whitespace-nowrap text-sm">
            <span className="text-emerald-600">{rsvpYes} accepted</span>
            <span className="text-slate-300"> · </span>
            <span className="text-red-500">{rsvpNo} declined</span>
          </span>
        )}
      </div>

      {/* row 2: toolbar — three entries, one job each */}
      {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu('')} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setMenu(menu === 'invite' ? '' : 'invite')}
            className="whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
          >
            Invite guests ▾
          </button>
          {menu === 'invite' && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <MenuItem
                label="Design the e-invite"
                hint="Photos + details → the full experience"
                onClick={() => {
                  setMenu('')
                  router.push(`/events/${eventId}/einvite`)
                }}
              />
              <MenuItem
                label="Copy invite link"
                hint="The full e-invitation — envelope, countdown, ballroom & RSVP"
                onClick={() => {
                  setMenu('')
                  copyInviteLink()
                }}
              />
              <MenuItem
                label="Invite poster (QR)"
                hint="Print-ready invitation poster with the RSVP code"
                onClick={() => {
                  setMenu('')
                  downloadInviteQr()
                }}
              />
              <MenuItem
                label="Seat-finder poster (QR)"
                hint="Print-ready entrance poster — guests find their own table"
                onClick={() => {
                  setMenu('')
                  downloadFindQr()
                }}
              />
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenu(menu === 'io' ? '' : 'io')}
            disabled={exporting !== ''}
            className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            {exporting !== '' ? 'Generating…' : 'Import / Export ▾'}
          </button>
          {menu === 'io' && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <MenuItem
                label="Import CSV/Excel"
                hint="Bring an existing guest list in"
                onClick={() => {
                  setMenu('')
                  setImporting(true)
                }}
              />
              <MenuItem
                label="QR PDF sheet"
                hint="A4 sheet of QR cards with cut lines"
                disabled={guests.length === 0}
                onClick={() => {
                  setMenu('')
                  exportQr('pdf')
                }}
              />
              <MenuItem
                label="QR PNG zip"
                hint="One PNG per guest, named after them"
                disabled={guests.length === 0}
                onClick={() => {
                  setMenu('')
                  exportQr('zip')
                }}
              />
            </div>
          )}
        </div>
        <Link
          href={`/events/${eventId}/allocate`}
          className="ml-auto whitespace-nowrap rounded-md border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Seating →
        </Link>
      </div>

      {inviteNote && (
        <p className="mt-2 text-sm text-emerald-600">{inviteNote}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone…"
          className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as SideFilter)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">Both sides</option>
          <option value="bride">Bride</option>
          <option value="groom">Groom</option>
          <option value="both">Shared</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={(e) => setVipOnly(e.target.checked)}
          />
          VIP only
        </label>
      </div>

      <div className="mt-4">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="min-w-48 px-3 py-2">Name</th>
                <th className="px-3 py-2 w-20">Pax</th>
                <th className="px-3 py-2 w-28">Side</th>
                <th className="px-3 py-2 w-36">Group</th>
                <th className="px-3 py-2 w-36">Dietary</th>
                <th className="px-3 py-2 w-16">VIP</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {g.rsvp && (
                        <span
                          title={g.rsvp === 'yes' ? 'RSVP: accepted' : 'RSVP: declined'}
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            g.rsvp === 'yes' ? 'bg-emerald-500' : 'bg-red-400'
                          }`}
                        />
                      )}
                      <input
                        value={g.name}
                        onChange={(e) => patch(g.id, { name: e.target.value })}
                        className={input}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min={1}
                      value={g.party_size}
                      onChange={(e) =>
                        patch(g.id, { party_size: Math.max(1, Number(e.target.value)) })
                      }
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={g.side}
                      onChange={(e) => patch(g.id, { side: e.target.value as GuestSide })}
                      className={input}
                    >
                      <option value="bride">bride</option>
                      <option value="groom">groom</option>
                      <option value="both">both</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={g.group_tag ?? ''}
                      onChange={(e) => patch(g.id, { group_tag: e.target.value || null })}
                      placeholder="—"
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={(e) => {
                        if (dietFor?.id === g.id) return closeDiet(g)
                        const r = e.currentTarget.getBoundingClientRect()
                        setDietFor({
                          id: g.id,
                          top: r.bottom + 4,
                          left: Math.max(8, Math.min(r.right - 288, window.innerWidth - 296)),
                        })
                      }}
                      title={g.dietary?.allergy ? `Allergy: ${g.dietary.allergy}` : 'Edit dietary needs'}
                      className="w-full rounded-md border border-transparent px-1.5 py-1 text-left text-xs hover:border-slate-200 hover:bg-slate-50"
                    >
                      {summarizeDietary(g.dietary, g.party_size) || (
                        <span className="text-slate-300">—</span>
                      )}
                      {g.dietary?.allergy && <span className="ml-1 text-red-500">•</span>}
                      {(['veg', 'halal', 'no_beef', 'child'] as const).some(
                        (k) => (g.dietary?.[k] ?? 0) > g.party_size,
                      ) && (
                        <span
                          className="ml-1 text-amber-500"
                          title="Counts exceed party size — party may have shrunk"
                        >
                          !
                        </span>
                      )}
                    </button>
                    {dietFor?.id === g.id && (
                      <div
                        className="fixed z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                        style={{ top: dietFor.top, left: dietFor.left }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">
                            Dietary needs · {g.party_size} pax
                          </p>
                          <button
                            onClick={() => closeDiet(g)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Done
                          </button>
                        </div>
                        <DietarySteppers
                          value={g.dietary ?? {}}
                          max={g.party_size}
                          onChange={(d) => patch(g.id, { dietary: d })}
                          tone="light"
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={g.is_vip}
                      onChange={(e) => patch(g.id, { is_vip: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={async () => {
                        await getRepo().deleteGuest(g.id)
                        refresh()
                      }}
                      className="text-slate-300 hover:text-red-600"
                      title="Remove guest"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2">
                  <input
                    value={newGuest.name}
                    onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addManual()}
                    placeholder="+ Add guest…"
                    className={input}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={newGuest.party}
                    onChange={(e) =>
                      setNewGuest({ ...newGuest, party: Math.max(1, Number(e.target.value)) })
                    }
                    className={input}
                  />
                </td>
                <td colSpan={5} className="px-3 py-2">
                  <button
                    onClick={addManual}
                    disabled={!newGuest.name.trim()}
                    className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  >
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          {guests.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">
              No guests yet — import a spreadsheet or add them above.
            </p>
          )}
        </div>

        <details
          className="mt-4 rounded-lg border border-slate-200 bg-white"
          open={constraints.length > 0}
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
            Seating rules
            {constraints.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {constraints.length}
              </span>
            )}
            <span className="ml-2 text-xs font-normal text-slate-400">
              hard constraints the allocator will never break
            </span>
          </summary>
          <ConstraintsPanel
            eventId={eventId}
            guests={guests}
            constraints={constraints}
            onAdd={async (c) => {
              await getRepo().saveConstraint(c)
              refresh()
            }}
            onRemove={async (id) => {
              await getRepo().deleteConstraint(id)
              refresh()
            }}
          />
        </details>
      </div>

      {importing && (
        <ImportDialog
          eventId={eventId}
          onClose={() => setImporting(false)}
          onImport={async (gs) => {
            await getRepo().saveGuests(gs)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function MenuItem({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="block w-full rounded-md px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
    >
      <span className="block text-sm text-slate-800">{label}</span>
      <span className="block text-xs text-slate-400">{hint}</span>
    </button>
  )
}
