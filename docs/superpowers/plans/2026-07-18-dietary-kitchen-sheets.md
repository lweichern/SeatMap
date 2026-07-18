# Dietary Capture → Kitchen Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests declare dietary needs (seat counts per party) at RSVP; planners edit them on the guest list; a print-ready per-table kitchen sheet rolls everything up for the caterer.

**Architecture:** One optional `dietary` jsonb field on `Guest`, pure aggregation logic in `src/lib/kitchen.ts`, a shared stepper component used by both the RSVP form (dark theme) and the planner guest list (light theme), and a new print-CSS page at `/events/[eventId]/kitchen`. Spec: `docs/superpowers/specs/2026-07-18-dietary-kitchen-sheets-design.md`.

**Tech Stack:** Next.js 15 App Router (client pages), TypeScript, Tailwind v4, vitest@3 (pinned — Node 20.11), Playwright for e2e, Supabase (jsonb column) with localStorage/server-store fallback.

## Global Constraints

- All work on branch `dietary-kitchen`, merged `--no-ff` to `main` at the end.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- NEVER run `npm run build` while the dev server is running (corrupts `.next`). Stop dev → build → `rm -rf .next` → restart dev.
- The dev server on :3000 runs against the user's REAL Supabase project. E2E probes must only touch the demo event (`demo-e1`, secret `demo-secret-adam-eve`) or throwaway records, and must restore state afterwards.
- Export uses browser print (`window.print()`), NOT jsPDF (jsPDF cannot render CJK names).
- Dietary categories are fixed: vegetarian, halal, no beef, child meal, + one free-text allergy note. Counts are independent (NOT a partition of the party); each is capped at `party_size`.
- `SupabaseVenueRepo.saveGuests` upserts raw `Guest` objects — a `dietary` key requires the `guests.dietary` column to exist in Postgres (Task 2 + user action) before any UI writes it in Supabase mode.
- Tests live next to code: `src/lib/*.test.ts` (vitest pattern already in use).

---

### Task 1: Dietary type + pure kitchen logic

**Files:**
- Modify: `src/lib/types.ts:150-167` (Guest interface; add `Dietary` above it)
- Create: `src/lib/kitchen.ts`
- Test: `src/lib/kitchen.test.ts`

**Interfaces:**
- Consumes: `Guest`, `VenueTable` from `src/lib/types.ts` (VenueTable is the alias of TableObj; has `id`, `label`, `kind`).
- Produces (later tasks rely on these exact names):
  - `Dietary` type on `Guest.dietary?: Dietary | null`
  - `DIETARY_CATEGORIES: readonly {key, label, emoji}[]`, `type DietaryCountKey`
  - `normalizeDietary(d): Dietary | undefined`
  - `clampedCount(g: Guest, key: DietaryCountKey): number`
  - `summarizeDietary(d): string` (chips text, '' when nothing)
  - `buildKitchenSheet(tables: VenueTable[], guests: Guest[]): KitchenSheet`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git checkout -b dietary-kitchen
```

- [ ] **Step 2: Add the Dietary type to types.ts**

Insert directly above `export interface Guest` (line 150):

```ts
/** Seat counts within a party needing each plate type; counts are independent
 *  requests to the kitchen, not a partition of the party. */
export interface Dietary {
  veg?: number
  halal?: number
  no_beef?: number
  child?: number
  /** Free-text allergy note for the whole party. */
  allergy?: string
}
```

Inside `Guest`, after `rsvp?: 'yes' | 'no' | null`, add:

```ts
  /** Dietary seat counts from RSVP or planner entry; absent/null = none. */
  dietary?: Dietary | null
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/kitchen.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildKitchenSheet,
  clampedCount,
  normalizeDietary,
  summarizeDietary,
} from './kitchen'
import type { Guest, VenueTable } from './types'

const guest = (over: Partial<Guest>): Guest => ({
  id: 'g1',
  event_id: 'e1',
  name: 'Guest',
  phone: null,
  email: null,
  party_size: 4,
  side: 'both',
  group_tag: null,
  is_vip: false,
  table_id: null,
  qr_token: null,
  checked_in_at: null,
  locked: false,
  ...over,
})

const table = (over: Partial<VenueTable>): VenueTable => ({
  id: 't1',
  layout_id: 'l1',
  label: '1',
  shape: 'round',
  kind: 'seating',
  x: 0,
  y: 0,
  rot: 0,
  seats: 10,
  dia: 1.8,
  locked: false,
  ...over,
})

describe('normalizeDietary', () => {
  it('drops zero counts and empty allergy; undefined when nothing remains', () => {
    expect(normalizeDietary({ veg: 0, halal: 0, allergy: '  ' })).toBeUndefined()
    expect(normalizeDietary(null)).toBeUndefined()
    expect(normalizeDietary({ veg: 2, halal: 0, allergy: '' })).toEqual({ veg: 2 })
    expect(normalizeDietary({ allergy: ' peanut ' })).toEqual({ allergy: 'peanut' })
  })
})

describe('clampedCount', () => {
  it('caps counts at party_size (party may shrink after RSVP)', () => {
    const g = guest({ party_size: 2, dietary: { veg: 5 } })
    expect(clampedCount(g, 'veg')).toBe(2)
    expect(clampedCount(guest({ dietary: null }), 'veg')).toBe(0)
  })
})

describe('summarizeDietary', () => {
  it('renders compact chips text', () => {
    expect(summarizeDietary({ veg: 2, child: 1 })).toBe('🌱2 · 🧒1')
    expect(summarizeDietary({})).toBe('')
    expect(summarizeDietary(undefined)).toBe('')
  })
})

describe('buildKitchenSheet', () => {
  const tables = [
    table({ id: 't2', label: '10' }),
    table({ id: 't1', label: '2' }),
    table({ id: 'svc', label: 'Buffet', kind: 'service' }),
  ]

  it('rolls up counts per table, sorts labels numerically, excludes service tables', () => {
    const guests = [
      guest({ id: 'a', table_id: 't1', party_size: 4, dietary: { veg: 2 } }),
      guest({ id: 'b', table_id: 't1', party_size: 2, dietary: { veg: 1, halal: 1 } }),
      guest({ id: 'c', table_id: 't2', party_size: 3 }),
    ]
    const s = buildKitchenSheet(tables, guests)
    expect(s.rows.map((r) => r.label)).toEqual(['2', '10'])
    expect(s.rows[0]).toMatchObject({ pax: 6, counts: { veg: 3, halal: 1, no_beef: 0, child: 0 } })
    expect(s.totals).toMatchObject({ pax: 9, counts: { veg: 3, halal: 1, no_beef: 0, child: 0 } })
  })

  it('collects allergy notes with guest names and counts them in totals', () => {
    const guests = [guest({ id: 'a', name: '陈美玲', table_id: 't1', dietary: { allergy: 'peanut' } })]
    const s = buildKitchenSheet(tables, guests)
    expect(s.rows[0].allergies).toEqual([{ guestName: '陈美玲', note: 'peanut' }])
    expect(s.totals.allergies).toBe(1)
  })

  it('buckets unassigned guests and excludes declined RSVPs entirely', () => {
    const guests = [
      guest({ id: 'a', table_id: null, party_size: 2, dietary: { halal: 1 } }),
      guest({ id: 'b', table_id: 't1', party_size: 5, rsvp: 'no', dietary: { veg: 5 } }),
    ]
    const s = buildKitchenSheet(tables, guests)
    expect(s.unassigned.pax).toBe(2)
    expect(s.unassigned.counts.halal).toBe(1)
    expect(s.totals.pax).toBe(2)
    expect(s.totals.counts.veg).toBe(0)
  })

  it('flags guests whose counts were clamped', () => {
    const guests = [guest({ id: 'a', name: 'Shrunk', table_id: 't1', party_size: 1, dietary: { veg: 3 } })]
    const s = buildKitchenSheet(tables, guests)
    expect(s.rows[0].counts.veg).toBe(1)
    expect(s.clampedGuests).toEqual(['Shrunk'])
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/lib/kitchen.test.ts`
Expected: FAIL — `Cannot find module './kitchen'` (or equivalent resolve error).

- [ ] **Step 5: Implement src/lib/kitchen.ts**

```ts
import type { Dietary, Guest, VenueTable } from './types'

/** Fixed v1 category set — agreed in the spec; no custom categories. */
export const DIETARY_CATEGORIES = [
  { key: 'veg', label: 'Vegetarian', emoji: '🌱' },
  { key: 'halal', label: 'Halal', emoji: '☪️' },
  { key: 'no_beef', label: 'No beef', emoji: '🚫🥩' },
  { key: 'child', label: 'Child meal', emoji: '🧒' },
] as const

export type DietaryCountKey = (typeof DIETARY_CATEGORIES)[number]['key']

const KEYS = DIETARY_CATEGORIES.map((c) => c.key)

/** Drop zero counts and blank allergy; undefined when nothing remains. */
export function normalizeDietary(d: Dietary | null | undefined): Dietary | undefined {
  if (!d) return undefined
  const out: Dietary = {}
  for (const k of KEYS) {
    const n = d[k] ?? 0
    if (n > 0) out[k] = n
  }
  const allergy = (d.allergy ?? '').trim()
  if (allergy) out.allergy = allergy
  return Object.keys(out).length > 0 ? out : undefined
}

/** A count never exceeds the party — the party may shrink after RSVP. */
export function clampedCount(g: Guest, key: DietaryCountKey): number {
  return Math.min(g.dietary?.[key] ?? 0, g.party_size)
}

/** Compact chips text for list rows, e.g. "🌱2 · ☪️1". Empty string when none. */
export function summarizeDietary(d: Dietary | null | undefined): string {
  if (!d) return ''
  return DIETARY_CATEGORIES.filter((c) => (d[c.key] ?? 0) > 0)
    .map((c) => `${c.emoji}${d[c.key]}`)
    .join(' · ')
}

export interface KitchenRow {
  tableId: string
  label: string
  pax: number
  counts: Record<DietaryCountKey, number>
  allergies: { guestName: string; note: string }[]
}

export interface KitchenSheet {
  totals: { pax: number; counts: Record<DietaryCountKey, number>; allergies: number }
  rows: KitchenRow[]
  /** Pseudo-row for guests not yet assigned to a table. */
  unassigned: KitchenRow
  /** Names whose stored counts exceeded party_size (shown as a warning). */
  clampedGuests: string[]
}

const zeroCounts = (): Record<DietaryCountKey, number> =>
  Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<DietaryCountKey, number>

const emptyRow = (tableId: string, label: string): KitchenRow => ({
  tableId,
  label,
  pax: 0,
  counts: zeroCounts(),
  allergies: [],
})

/** Numeric-aware label ordering: "2" before "10", text labels last. */
const byLabel = (a: KitchenRow, b: KitchenRow) => {
  const na = Number(a.label)
  const nb = Number(b.label)
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  if (!Number.isNaN(na)) return -1
  if (!Number.isNaN(nb)) return 1
  return a.label.localeCompare(b.label)
}

/**
 * Roll the guest list up into the caterer's view. Declined RSVPs are
 * excluded (they never reach seating); service tables (buffet lines) carry
 * no guests and are omitted.
 */
export function buildKitchenSheet(tables: VenueTable[], guests: Guest[]): KitchenSheet {
  const rows = new Map<string, KitchenRow>()
  for (const t of tables) {
    if (t.kind !== 'service') rows.set(t.id, emptyRow(t.id, t.label))
  }
  const unassigned = emptyRow('', 'Unassigned')
  const clampedGuests: string[] = []

  for (const g of guests) {
    if (g.rsvp === 'no') continue
    const row = (g.table_id && rows.get(g.table_id)) || unassigned
    row.pax += g.party_size
    for (const k of KEYS) {
      const clamped = clampedCount(g, k)
      if ((g.dietary?.[k] ?? 0) > clamped && !clampedGuests.includes(g.name)) {
        clampedGuests.push(g.name)
      }
      row.counts[k] += clamped
    }
    const note = (g.dietary?.allergy ?? '').trim()
    if (note) row.allergies.push({ guestName: g.name, note })
  }

  const sorted = [...rows.values()].sort(byLabel)
  const totals = { pax: unassigned.pax, counts: zeroCounts(), allergies: unassigned.allergies.length }
  for (const k of KEYS) totals.counts[k] = unassigned.counts[k]
  for (const r of sorted) {
    totals.pax += r.pax
    totals.allergies += r.allergies.length
    for (const k of KEYS) totals.counts[k] += r.counts[k]
  }

  return { totals, rows: sorted, unassigned, clampedGuests }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/kitchen.test.ts`
Expected: PASS (all 6 tests). Also run `npx tsc --noEmit` — no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/kitchen.ts src/lib/kitchen.test.ts
git commit -m "feat: dietary type + kitchen sheet aggregation logic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Supabase schema migration

**Files:**
- Create: `supabase/migrations/0003_dietary.sql`
- Modify: `supabase/setup.sql` (guests table block, after line 107 `rsvp text check (...)`)

**Interfaces:**
- Produces: `guests.dietary jsonb` column. `SupabaseVenueRepo.saveGuests` upserts whole `Guest` objects, so this column MUST exist in the user's live project before any UI task writes dietary data in Supabase mode.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_dietary.sql`:

```sql
-- Dietary seat counts per party, captured at RSVP or entered by the planner.
-- Shape: { "veg": 2, "halal": 1, "no_beef": 0, "child": 1, "allergy": "peanut" }
alter table guests add column if not exists dietary jsonb;
```

- [ ] **Step 2: Mirror it in setup.sql**

In `supabase/setup.sql`, inside `create table guests (...)`, add after the `rsvp` line:

```sql
  dietary jsonb,
```

Then append at the end of the file (so existing installs picking up the new setup.sql also converge):

```sql
-- 0003: dietary capture
alter table guests add column if not exists dietary jsonb;
```

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat: guests.dietary jsonb column (migration 0003)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: USER ACTION — apply to the live project**

The executor cannot run DDL against the user's Supabase (anon key only). Before Task 7's e2e probe, the user must run this in the Supabase SQL editor (project buymunrrgnoovondyioq):

```sql
alter table guests add column if not exists dietary jsonb;
```

Verify afterwards (executor can do this) — expect HTTP 200, not a 42703 error:

```bash
KEY=$(grep ANON_KEY .env.local | cut -d= -f2)
curl -s -o /dev/null -w "%{http_code}" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "https://buymunrrgnoovondyioq.supabase.co/rest/v1/guests?select=dietary&limit=1"
```

---

### Task 3: mergeRsvp carries dietary

**Files:**
- Modify: `src/lib/rsvp.ts`
- Test: `src/lib/rsvp.test.ts` (append to existing describe blocks)

**Interfaces:**
- Consumes: `normalizeDietary` from `src/lib/kitchen.ts`, `Dietary` from `src/lib/types.ts`.
- Produces: `RsvpSubmission.dietary?: Dietary`; `mergeRsvp` stores normalized dietary on create, and on update replaces existing dietary only when the submission contains any.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/rsvp.test.ts` (reuse the file's existing helpers/imports style; `mergeRsvp` is already imported):

```ts
describe('mergeRsvp dietary', () => {
  const base = { name: 'Dee', phone: '', party_size: 3, side: 'both' as const, attending: true }

  it('stores normalized dietary on a new guest, omitting empties', () => {
    const g = mergeRsvp([], { ...base, dietary: { veg: 2, halal: 0, allergy: ' ' } }, 'e1')
    expect(g.dietary).toEqual({ veg: 2 })
    const none = mergeRsvp([], { ...base, dietary: { veg: 0 } }, 'e1')
    expect(none.dietary).toBeUndefined()
  })

  it('replaces existing dietary when resubmitted, keeps it when absent', () => {
    const existing = mergeRsvp([], { ...base, dietary: { veg: 1 } }, 'e1')
    const updated = mergeRsvp([existing], { ...base, dietary: { halal: 2 } }, 'e1')
    expect(updated.id).toBe(existing.id)
    expect(updated.dietary).toEqual({ halal: 2 })
    const kept = mergeRsvp([existing], { ...base }, 'e1')
    expect(kept.dietary).toEqual({ veg: 1 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/rsvp.test.ts`
Expected: FAIL — `dietary` is undefined on the merged guest / type error on `RsvpSubmission`.

- [ ] **Step 3: Implement**

In `src/lib/rsvp.ts`:

```ts
import { normalizeDietary } from './kitchen'
import type { Dietary, Guest, GuestSide } from './types'
```

Add to `RsvpSubmission`:

```ts
  dietary?: Dietary
```

In the `if (match)` return object add:

```ts
      dietary: normalizeDietary(sub.dietary) ?? match.dietary,
```

In the new-guest return object add (after `rsvp,`):

```ts
    dietary: normalizeDietary(sub.dietary),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/rsvp.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rsvp.ts src/lib/rsvp.test.ts
git commit -m "feat: RSVP submissions carry dietary counts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: DietarySteppers component + RSVP form section

**Files:**
- Create: `src/components/DietarySteppers.tsx`
- Modify: `src/app/(guest)/rsvp/[token]/page.tsx`

**Interfaces:**
- Consumes: `DIETARY_CATEGORIES`, `DietaryCountKey` from `src/lib/kitchen.ts`; `Dietary` from types.
- Produces: `<DietarySteppers value max onChange tone />` — reused by Task 5. `tone: 'light' | 'dark'` (RSVP page is dark slate; planner pages are light).

- [ ] **Step 1: Create the component**

`src/components/DietarySteppers.tsx`:

```tsx
'use client'

import { DIETARY_CATEGORIES, type DietaryCountKey } from '@/lib/kitchen'
import type { Dietary } from '@/lib/types'

/** Stepper rows for the fixed dietary categories + one allergy line.
 *  Counts are clamped to [0, max] (max = party size). */
export function DietarySteppers({
  value,
  max,
  onChange,
  tone,
}: {
  value: Dietary
  max: number
  onChange: (d: Dietary) => void
  tone: 'light' | 'dark'
}) {
  const t =
    tone === 'dark'
      ? {
          row: 'text-slate-300',
          btn: 'border-slate-600 bg-slate-800 text-slate-200',
          num: 'text-slate-100',
          input:
            'border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500',
        }
      : {
          row: 'text-slate-600',
          btn: 'border-slate-300 bg-white text-slate-700',
          num: 'text-slate-900',
          input: 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
        }

  const set = (key: DietaryCountKey, n: number) =>
    onChange({ ...value, [key]: Math.max(0, Math.min(max, n)) })

  return (
    <div className="space-y-2">
      {DIETARY_CATEGORIES.map((c) => {
        const n = value[c.key] ?? 0
        return (
          <div key={c.key} className={`flex items-center justify-between text-sm ${t.row}`}>
            <span>
              {c.emoji} {c.label}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Fewer ${c.label}`}
                onClick={() => set(c.key, n - 1)}
                className={`h-7 w-7 rounded-full border text-base leading-none ${t.btn}`}
              >
                −
              </button>
              <span className={`w-5 text-center font-semibold ${t.num}`}>{n}</span>
              <button
                type="button"
                aria-label={`More ${c.label}`}
                onClick={() => set(c.key, n + 1)}
                className={`h-7 w-7 rounded-full border text-base leading-none ${t.btn}`}
              >
                ＋
              </button>
            </span>
          </div>
        )
      })}
      <input
        value={value.allergy ?? ''}
        onChange={(e) => onChange({ ...value, allergy: e.target.value })}
        placeholder="Allergies? e.g. peanut — for the kitchen"
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${t.input}`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the RSVP form**

In `src/app/(guest)/rsvp/[token]/page.tsx`:

Imports:

```ts
import { DietarySteppers } from '@/components/DietarySteppers'
import type { Dietary, GuestSide, Venue, WeddingEvent } from '@/lib/types'
```

Form state — add to the `useState` object and a disclosure flag:

```ts
  const [form, setForm] = useState({
    name: '',
    phone: '',
    party: 1,
    side: 'both' as GuestSide,
    attending: true,
    dietary: {} as Dietary,
  })
  const [showDietary, setShowDietary] = useState(false)
```

In `submit()`, extend the `mergeRsvp` submission object:

```ts
          attending: form.attending,
          dietary: form.dietary,
```

(`mergeRsvp` normalizes; an untouched `{}` stores nothing.)

In the JSX, after the party/side `<div className="flex gap-3">…</div>` block and before the accept/decline buttons, add (only shown when attending):

```tsx
          {form.attending && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setShowDietary((s) => !s)}
                className="flex w-full items-center justify-between text-sm text-slate-300"
              >
                <span>Any dietary needs?</span>
                <span className="text-slate-500">{showDietary ? '▴' : '▾'}</span>
              </button>
              {showDietary && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-slate-500">
                    How many of your {form.party} {form.party === 1 ? 'seat' : 'seats'} need:
                  </p>
                  <DietarySteppers
                    value={form.dietary}
                    max={form.party}
                    onChange={(d) => setForm({ ...form, dietary: d })}
                    tone="dark"
                  />
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 3: Manual smoke check**

With the dev server running, open an RSVP link (any invalid token shows the error page — instead compute the demo token or just verify compile): confirm `npx tsc --noEmit` passes and the dev server compiles the page without errors (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/rsvp/x` → 200). Full behavior is covered by the Task 7 e2e probe.

- [ ] **Step 4: Commit**

```bash
git add src/components/DietarySteppers.tsx "src/app/(guest)/rsvp/[token]/page.tsx"
git commit -m "feat: dietary steppers on the RSVP form

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Guest list chips + editor popover

**Files:**
- Modify: `src/app/(planner)/events/[eventId]/guests/page.tsx` (table at lines ~262-335; `patch` helper at line 68)

**Interfaces:**
- Consumes: `DietarySteppers` (Task 4), `normalizeDietary`, `summarizeDietary` from `src/lib/kitchen.ts`; existing `patch(id, partial)` which optimistically updates state and calls `saveGuest`.
- Produces: a "Dietary" column planners use for phone RSVPs / manual guests.

- [ ] **Step 1: Add imports and popover state**

```ts
import { DietarySteppers } from '@/components/DietarySteppers'
import { normalizeDietary, summarizeDietary } from '@/lib/kitchen'
```

Component state (next to the other useState calls):

```ts
  const [dietFor, setDietFor] = useState<string | null>(null)
```

- [ ] **Step 2: Add the column**

Header row — insert between "Group" and "VIP":

```tsx
                <th className="px-3 py-2 w-36">Dietary</th>
```

Body — insert a matching `<td>` between the Group and VIP cells:

```tsx
                  <td className="relative px-3 py-1.5">
                    <button
                      onClick={() => setDietFor(dietFor === g.id ? null : g.id)}
                      title={g.dietary?.allergy ? `Allergy: ${g.dietary.allergy}` : 'Edit dietary needs'}
                      className="w-full rounded-md border border-transparent px-1.5 py-1 text-left text-xs hover:border-slate-200 hover:bg-slate-50"
                    >
                      {summarizeDietary(g.dietary) || <span className="text-slate-300">—</span>}
                      {g.dietary?.allergy && <span className="ml-1 text-red-500">•</span>}
                    </button>
                    {dietFor === g.id && (
                      <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">
                            Dietary needs · {g.party_size} pax
                          </p>
                          <button
                            onClick={() => setDietFor(null)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Done
                          </button>
                        </div>
                        <DietarySteppers
                          value={g.dietary ?? {}}
                          max={g.party_size}
                          onChange={(d) => patch(g.id, { dietary: normalizeDietary(d) ?? null })}
                          tone="light"
                        />
                      </div>
                    )}
                  </td>
```

- [ ] **Step 3: Verify compile + behavior**

`npx tsc --noEmit` → clean. In the browser (demo event guests page): click the — cell, steppers appear, "＋" on Vegetarian shows `🌱1` chip after Done; reload page → chip persists (repo round-trip). NOTE (Supabase mode): persistence requires the Task 2 column; if the user hasn't applied it yet, verify persistence later during Task 7 and only check the UI renders here.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(planner)/events/[eventId]/guests/page.tsx"
git commit -m "feat: dietary chips + editor on the planner guest list

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Kitchen sheet page + nav link + demo seed

**Files:**
- Create: `src/app/(planner)/events/[eventId]/kitchen/page.tsx`
- Modify: `src/app/(planner)/events/page.tsx` (button row at lines ~145-170)
- Modify: `src/lib/demo.ts` (after the guest-building loop, ~line 209)

**Interfaces:**
- Consumes: `buildKitchenSheet`, `DIETARY_CATEGORIES` (Task 1); repo methods `getEvent(eventId)`, `getLayout(e.layout_id)` → `{ tables }`, `listGuests(eventId)` (same load pattern as allocate/page.tsx lines 34-49).
- Produces: `/events/[eventId]/kitchen` route; "Kitchen" button on the events list.

- [ ] **Step 1: Create the page**

`src/app/(planner)/events/[eventId]/kitchen/page.tsx`:

```tsx
'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { buildKitchenSheet, DIETARY_CATEGORIES } from '@/lib/kitchen'
import type { Guest, VenueTable, WeddingEvent } from '@/lib/types'

/**
 * The caterer's view: per-table plate counts + allergy notes, printed via
 * the browser (window.print) so CJK guest names render correctly.
 */
export default function KitchenPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [tables, setTables] = useState<VenueTable[]>([])
  const [guests, setGuests] = useState<Guest[]>([])

  useEffect(() => {
    ;(async () => {
      const repo = getRepo()
      const e = await repo.getEvent(eventId)
      if (!e) return
      const [l, gs] = await Promise.all([repo.getLayout(e.layout_id), repo.listGuests(eventId)])
      setEvent(e)
      setTables(l?.tables ?? [])
      setGuests(gs)
    })()
  }, [eventId])

  const sheet = useMemo(() => buildKitchenSheet(tables, guests), [tables, guests])
  if (!event) return <p className="p-8 text-sm text-slate-400">Loading…</p>

  const showUnassigned = sheet.unassigned.pax > 0

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* everything outside .print-area is hidden when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; inset: 0; width: 100%; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Kitchen sheet</h1>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Print / save as PDF
        </button>
      </div>

      <div className="print-area">
        <div className="mb-1 text-lg font-bold text-slate-900">
          {event.couple_names} — {event.event_date}
        </div>
        <p className="mb-4 text-sm text-slate-500">
          {sheet.totals.pax} pax ·{' '}
          {DIETARY_CATEGORIES.map((c) => `${sheet.totals.counts[c.key]} ${c.label.toLowerCase()}`).join(' · ')}
          {sheet.totals.allergies > 0 && ` · ${sheet.totals.allergies} allergy ${sheet.totals.allergies === 1 ? 'note' : 'notes'}`}
        </p>

        {sheet.clampedGuests.length > 0 && (
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Counts capped at party size for: {sheet.clampedGuests.join(', ')} — their party shrank
            after dietary needs were recorded. Please confirm with them.
          </p>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Table</th>
              <th className="py-2 pr-3">Pax</th>
              {DIETARY_CATEGORIES.map((c) => (
                <th key={c.key} className="py-2 pr-3">
                  {c.label}
                </th>
              ))}
              <th className="py-2">Allergies</th>
            </tr>
          </thead>
          <tbody>
            {[...sheet.rows, ...(showUnassigned ? [sheet.unassigned] : [])].map((r) => (
              <tr key={r.tableId || 'unassigned'} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-3 font-semibold text-slate-900">{r.label}</td>
                <td className="py-2 pr-3">{r.pax || '—'}</td>
                {DIETARY_CATEGORIES.map((c) => (
                  <td key={c.key} className="py-2 pr-3">
                    {r.counts[c.key] || '—'}
                  </td>
                ))}
                <td className="py-2 text-xs text-slate-600">
                  {r.allergies.length === 0
                    ? '—'
                    : r.allergies.map((a, i) => (
                        <div key={i}>
                          <span className="font-medium">{a.guestName}:</span> {a.note}
                        </div>
                      ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-xs text-slate-400">
          Declined RSVPs excluded · counts are seats within each party · generated by SeatMap
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the events-list button**

In `src/app/(planner)/events/page.tsx`, after the "Menu" button, add:

```tsx
              <button
                onClick={() => router.push(`/events/${e.id}/kitchen`)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Kitchen
              </button>
```

- [ ] **Step 3: Seed demo dietary data**

In `src/lib/demo.ts`, immediately after the guest-building `for` loop (after line ~209), add:

```ts
  // dietary needs so the kitchen sheet demos instantly
  guests[1].dietary = { veg: 1, child: 1, allergy: 'Child — peanut allergy' } // 陈美玲
  guests[3].dietary = { no_beef: 1 } // Beth Chua
  guests[4].dietary = { halal: 2 } // David Tan
```

- [ ] **Step 4: Verify compile + page renders**

`npx tsc --noEmit` → clean. Browser: `/events/demo-e1/kitchen` renders the table (demo dietary appears only after the next demo reset; an empty sheet with per-table rows is fine here).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(planner)/events/[eventId]/kitchen" "src/app/(planner)/events/page.tsx" src/lib/demo.ts
git commit -m "feat: kitchen sheet page, events nav link, demo dietary seed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end verification, suite, build, merge

**Files:**
- Create (scratchpad, not committed): `probe-dietary.mjs` in the session scratchpad directory

**Interfaces:**
- Consumes: everything above; demo event `demo-e1` (secret `demo-secret-adam-eve`, RSVP guest-slot `rsvp`); Supabase REST with the anon key from `.env.local`.

- [ ] **Step 0: Gate on the live column**

Run the REST check from Task 2 Step 4. If it returns 400/42703, STOP and ask the user to run the ALTER statement first — the probe writes dietary data through the live Supabase repo.

- [ ] **Step 1: Write the probe**

`probe-dietary.mjs` in the scratchpad (imports playwright from the repo's node_modules, same pattern as previous probes):

```js
import { chromium } from '/Users/weichernlim/Documents/RandomProjects/WeddingEventPlanner/node_modules/playwright/index.mjs'
import { webcrypto } from 'crypto'
import { readFileSync } from 'fs'

const env = readFileSync('/Users/weichernlim/Documents/RandomProjects/WeddingEventPlanner/.env.local', 'utf8')
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const rest = async (path, opts = {}) => {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers ?? {}) } })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null }
}
const log = (...a) => console.log('[dietary]', ...a)

const enc = new TextEncoder()
const key = await webcrypto.subtle.importKey('raw', enc.encode('demo-secret-adam-eve'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
const tok = async (slot) => {
  const sig = new Uint8Array(await webcrypto.subtle.sign('HMAC', key, enc.encode(`demo-e1:${slot}`))).slice(0, 16)
  return `${Buffer.from(enc.encode(`demo-e1:${slot}`)).toString('base64url')}.${Buffer.from(sig).toString('base64url')}`
}

const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 200)))

// 1. RSVP with dietary counts
await page.goto(`http://localhost:3000/rsvp/${await tok('rsvp')}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector("text=You're invited", { timeout: 30000 })
await page.fill('input[placeholder*="seating list"]', 'Dietary Probe')
await page.fill('input[type="number"]', '3')
await page.click('text=Any dietary needs?')
await page.click('[aria-label="More Vegetarian"]')
await page.click('[aria-label="More Vegetarian"]')
await page.click('[aria-label="More Child meal"]')
await page.fill('input[placeholder*="Allergies"]', 'shellfish')
await page.click('button:has-text("Send RSVP")')
await page.waitForSelector("text=You're on the guest list!", { timeout: 20000 })
const row = await rest(`guests?select=id,dietary&name=eq.Dietary Probe`)
const d = row.body?.[0]?.dietary
log(`RSVP dietary in Postgres: ${JSON.stringify(d)} ${d?.veg === 2 && d?.child === 1 && d?.allergy === 'shellfish' ? '✅' : '❌'}`)

// 2. planner guest list shows chips; popover edits persist
const desk = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
desk.on('pageerror', (e) => console.log('[desk err]', e.message.slice(0, 200)))
await desk.goto('http://localhost:3000/events/demo-e1/guests', { waitUntil: 'domcontentloaded' })
await desk.waitForSelector('text=Dietary Probe', { timeout: 30000 })
const chips = await desk.isVisible('text=🌱2 · 🧒1')
log(`guest list chips: ${chips ? '✅' : '❌'}`)

// 3. kitchen sheet totals (probe guest is unassigned)
await desk.goto('http://localhost:3000/events/demo-e1/kitchen', { waitUntil: 'domcontentloaded' })
await desk.waitForSelector('text=Kitchen sheet', { timeout: 30000 })
await desk.waitForSelector('text=Unassigned', { timeout: 15000 })
const totalsLine = await desk.textContent('p.mb-4')
log(`totals line: "${totalsLine?.trim()}" ${/2 vegetarian/.test(totalsLine ?? '') ? '✅' : '❌'}`)
const shellfish = await desk.isVisible('text=shellfish')
log(`allergy note on sheet: ${shellfish ? '✅' : '❌'}`)
await desk.screenshot({ path: process.env.OUT + '/kitchen-sheet.png', fullPage: true })

// 4. cleanup — remove the probe guest, leave demo pristine
const gid = row.body[0].id
await rest(`guests?id=eq.${gid}`, { method: 'DELETE' })
const gone = await rest(`guests?select=id&name=eq.Dietary Probe`)
log(`cleanup: probe guest deleted ${gone.body.length === 0 ? '✅' : '❌'}`)
await b.close()
log('DONE')
```

- [ ] **Step 2: Run the probe**

```bash
OUT=<scratchpad> node <scratchpad>/probe-dietary.mjs
```

Expected: every line ends ✅; read `kitchen-sheet.png` and confirm the layout looks right (totals line, per-table rows, allergy column).

- [ ] **Step 3: Full suite + build**

```bash
npx vitest run          # expect: all tests pass (119 existing + ~8 new)
npm run lint --silent   # expect: no output
pkill -f "next dev"; sleep 2
npm run build           # expect: success
rm -rf .next
```

- [ ] **Step 4: Merge and restart**

```bash
git checkout main
git merge --no-ff dietary-kitchen -m "Merge dietary-kitchen: dietary capture → kitchen sheets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
nohup npm run dev >/tmp/seatmap-dev.log 2>&1 &
sleep 12 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/venues   # expect 200
```

- [ ] **Step 5: Remind the user**

- Run `alter table guests add column if not exists dietary jsonb;` in Supabase SQL editor if not yet done (Task 2 Step 4).
- Push + redeploy Vercel to take the feature live.
- Demo dietary data appears after the next "Reset demo event".
