'use client'

import { useState } from 'react'
import { newTableId } from '@/lib/layout-ops'
import type { ConstraintType, Guest, GuestConstraint } from '@/lib/types'

interface Props {
  eventId: string
  guests: Guest[]
  constraints: GuestConstraint[]
  onAdd: (c: GuestConstraint) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function ConstraintsPanel({ eventId, guests, constraints, onAdd, onRemove }: Props) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [type, setType] = useState<ConstraintType>('must_sit_together')

  const name = (id: string) => guests.find((g) => g.id === id)?.name ?? '(deleted)'

  async function add() {
    if (!a || !b || a === b) return
    const dupe = constraints.some(
      (c) =>
        (c.guest_a_id === a && c.guest_b_id === b) ||
        (c.guest_a_id === b && c.guest_b_id === a),
    )
    if (dupe) return
    await onAdd({ id: newTableId(), event_id: eventId, guest_a_id: a, guest_b_id: b, type })
    setA('')
    setB('')
  }

  const select = 'rounded border border-slate-300 px-2 py-1.5 text-xs'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Seating rules</h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Hard constraints the allocator will never break.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className={select}>
          <option value="">Guest…</option>
          {guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ConstraintType)}
          className={select}
        >
          <option value="must_sit_together">must sit with</option>
          <option value="must_not_sit_together">must NOT sit with</option>
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className={select}>
          <option value="">Guest…</option>
          {guests
            .filter((g) => g.id !== a)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
        <button
          onClick={add}
          disabled={!a || !b}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Add rule
        </button>
      </div>

      {constraints.length > 0 && (
        <ul className="mt-3 space-y-1">
          {constraints.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs"
            >
              <span>
                <strong>{name(c.guest_a_id)}</strong>{' '}
                {c.type === 'must_sit_together' ? (
                  <span className="text-green-700">must sit with</span>
                ) : (
                  <span className="text-red-700">must NOT sit with</span>
                )}{' '}
                <strong>{name(c.guest_b_id)}</strong>
              </span>
              <button
                onClick={() => onRemove(c.id)}
                className="ml-2 text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
