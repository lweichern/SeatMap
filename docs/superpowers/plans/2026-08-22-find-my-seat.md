# Find My Seat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared entrance QR that identifies a guest (cookie from RSVP, else name + phone last-4 with a masked confirm card) and hands off to the existing `/g/[token]` page for table + 3D wayfinding.

**Architecture:** Pure matching logic in `src/lib/selfid.ts`; a new ivory-themed `/find/[token]` page under the `(guest)` route group; one localStorage line on the RSVP page; one menu item on the planner guests page. Spec: `docs/superpowers/specs/2026-08-22-find-my-seat-design.md`.

**Tech Stack:** Next.js 15 App Router client pages, TypeScript, Tailwind v4, vitest@3, existing HMAC token helpers (`src/lib/token.ts`).

## Global Constraints

- Branch `find-my-seat`, merged `--no-ff` to `main` at the end. Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- v1 WRITES NOTHING from /find — no check-in, no timestamps, no schema change.
- Kiosk token: `signToken(eventId, 'kiosk', event.guest_token_secret)`; /find requires `guest_id === 'kiosk'` from BOTH peek and verify.
- localStorage key: `seatmap.selfid.<eventId>` holding the guest id (set by RSVP submit and by /find on confirm).
- Declined guests (`rsvp === 'no'`) never match.
- Repo has NO lint script — gates are `npx tsc --noEmit`, `npx vitest run`, and (controller-only) `NEXT_DIST_DIR=.next-build npm run build`.
- NEVER run a bare `npm run build`; never start a second dev server (predev guard enforces); the dev server on :3000 talks to the user's REAL Supabase — e2e uses only the resettable demo event.
- Guest-facing pages use the `(guest)` layout theme: `gv-shell`, `gv-display`, `gv-caps`, `gv-rise`, CSS vars `--ink/--ink-soft/--ink-faint/--gold/--line/--card`, `Flourish` from `@/components/guest/Flourish`.

---

### Task 1: Matching logic (`selfid.ts`)

**Files:**
- Create: `src/lib/selfid.ts`
- Test: `src/lib/selfid.test.ts`

**Interfaces:**
- Consumes: `Guest` from `src/lib/types.ts`.
- Produces (Task 3 relies on exact names): `normalizeName(s: string): string`, `maskPhone(phone: string | null | undefined): string | null`, `matchGuests(guests: Guest[], name: string, last4?: string): Guest[]`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git checkout -b find-my-seat
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/selfid.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { matchGuests, maskPhone, normalizeName } from './selfid'
import type { Guest } from './types'

const guest = (over: Partial<Guest>): Guest => ({
  id: 'g1',
  event_id: 'e1',
  name: 'Guest',
  phone: null,
  email: null,
  party_size: 2,
  side: 'both',
  group_tag: null,
  is_vip: false,
  table_id: null,
  qr_token: null,
  checked_in_at: null,
  locked: false,
  ...over,
})

describe('normalizeName', () => {
  it('ignores case, spacing, punctuation and diacritics', () => {
    expect(normalizeName('  David  TAN ')).toBe('davidtan')
    expect(normalizeName('José-Luís')).toBe('joseluis')
    expect(normalizeName('陈美玲')).toBe('陈美玲')
  })
})

describe('maskPhone', () => {
  it('masks to last 4 digits, null when too short/absent', () => {
    expect(maskPhone('012-345 6789')).toBe('••••6789')
    expect(maskPhone('123')).toBeNull()
    expect(maskPhone(null)).toBeNull()
  })
})

describe('matchGuests', () => {
  const guests = [
    guest({ id: 'a', name: 'David Tan', phone: '012-111 2222' }),
    guest({ id: 'b', name: 'David Tan', phone: '019-333 4444' }),
    guest({ id: 'c', name: '陈美玲', phone: '019-888 7777' }),
    guest({ id: 'd', name: 'Kelly Teo', rsvp: 'no' }),
  ]

  it('matches by normalized name, both-ways contains', () => {
    expect(matchGuests(guests, 'david tan').map((g) => g.id)).toEqual(['a', 'b'])
    expect(matchGuests(guests, 'DAVID').map((g) => g.id)).toEqual(['a', 'b'])
    expect(matchGuests(guests, '陈美玲').map((g) => g.id)).toEqual(['c'])
  })

  it('last-4 digits narrow the candidates', () => {
    expect(matchGuests(guests, 'david tan', '4444').map((g) => g.id)).toEqual(['b'])
  })

  it('wrong digits fall back to name-only matches', () => {
    expect(matchGuests(guests, 'david tan', '9999').map((g) => g.id)).toEqual(['a', 'b'])
  })

  it('excludes declined guests and empty input', () => {
    expect(matchGuests(guests, 'kelly teo')).toEqual([])
    expect(matchGuests(guests, '   ')).toEqual([])
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/selfid.test.ts`
Expected: FAIL — cannot resolve `./selfid`.

- [ ] **Step 4: Implement `src/lib/selfid.ts`**

```ts
import type { Guest } from './types'

/**
 * Self-identification matching for the shared "Find my seat" entrance QR.
 * Pure functions — the /find page provides the UI and confirmation gate.
 */

/** Lowercase, strip diacritics, keep only letters/digits (CJK included). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** '••••1234' for the confirm card; null when no usable phone. */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 4) return null
  return `••••${digits.slice(-4)}`
}

/**
 * Candidates for "who scanned the poster": normalized name equality or
 * both-ways containment, narrowed by phone last-digits when they help.
 * A wrong digit must not hide an obvious name match, so an empty digit
 * filter falls back to the name matches. Declined guests never match.
 */
export function matchGuests(guests: Guest[], name: string, last4?: string): Guest[] {
  const n = normalizeName(name)
  if (!n) return []
  const byName = guests.filter((g) => {
    if (g.rsvp === 'no') return false
    const gn = normalizeName(g.name)
    return gn === n || gn.includes(n) || n.includes(gn)
  })
  const digits = (last4 ?? '').replace(/\D/g, '')
  if (digits.length >= 2) {
    const filtered = byName.filter((g) =>
      (g.phone ?? '').replace(/\D/g, '').endsWith(digits),
    )
    if (filtered.length > 0) return filtered
  }
  return byName
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/selfid.test.ts` → PASS (6 tests). Also `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/selfid.ts src/lib/selfid.test.ts
git commit -m "feat: self-identification matching for the shared entrance QR

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: RSVP cookie + planner poster QR

**Files:**
- Modify: `src/app/(guest)/rsvp/[token]/page.tsx` (submit(), after `await repo.saveGuest(guest)` ~line 70)
- Modify: `src/app/(planner)/events/[eventId]/guests/page.tsx` (helper next to `downloadInviteQr` ~line 153; menu item in the `menu === 'invite'` dropdown ~line 210)

**Interfaces:**
- Consumes: `signToken`, `getShareOrigin` (both already imported in the guests page); `mergeRsvp`'s returned `guest` (in scope in the RSVP submit).
- Produces: localStorage key `seatmap.selfid.<eventId>`; "Seat-finder poster QR" menu item downloading `find-my-seat-<slug>.png`.

- [ ] **Step 1: RSVP page — remember who this phone belongs to**

In `submit()` in `src/app/(guest)/rsvp/[token]/page.tsx`, directly after `await repo.saveGuest(guest)`:

```ts
      // remember who this phone belongs to — the /find entrance QR
      // recognizes them instantly next time
      try {
        localStorage.setItem(`seatmap.selfid.${event.id}`, guest.id)
      } catch {}
```

- [ ] **Step 2: Guests page — poster QR download**

Add below `downloadInviteQr()`:

```ts
  async function downloadFindQr() {
    if (!event) return
    const token = await signToken(event.id, 'kiosk', event.guest_token_secret)
    const url = `${await getShareOrigin()}/find/${token}`
    const QRCode = await import('qrcode')
    const dataUrl = await QRCode.toDataURL(url, { width: 800, margin: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `find-my-seat-${event.couple_names.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }
```

In the `menu === 'invite'` dropdown, after the "Download invite QR" MenuItem, add:

```tsx
              <MenuItem
                label="Seat-finder poster QR"
                hint="One QR at the entrance — guests find their own table"
                onClick={() => {
                  setMenu('')
                  downloadFindQr()
                }}
              />
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` → clean. `npx vitest run` → all pass. If the dev server responds (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/events/demo-e1/guests` → 200) that suffices; do NOT click through the UI (real database).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(guest)/rsvp/[token]/page.tsx" "src/app/(planner)/events/[eventId]/guests/page.tsx"
git commit -m "feat: RSVP remembers the guest on-device; seat-finder poster QR export

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `/find/[token]` page

**Files:**
- Create: `src/app/(guest)/find/[token]/page.tsx`

**Interfaces:**
- Consumes: `matchGuests`, `maskPhone` (Task 1); `peekToken`, `verifyToken`, `signToken` from `@/lib/token`; `getRepo`; `Flourish` from `@/components/guest/Flourish`; the `(guest)` layout theme classes.
- Produces: the complete find-my-seat flow ending in `router.push('/g/<personal token>')`.

- [ ] **Step 1: Create the page** (verbatim)

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { peekToken, signToken, verifyToken } from '@/lib/token'
import { matchGuests, maskPhone } from '@/lib/selfid'
import { Flourish } from '@/components/guest/Flourish'
import type { Guest, WeddingEvent } from '@/lib/types'

const SIDE_LABEL = {
  bride: "Bride's side",
  groom: "Groom's side",
  both: 'Friend of both',
} as const

/**
 * The shared entrance-poster QR: identify the guest with as little
 * friction as possible, then hand off to their personal /g page.
 * v1 deliberately writes nothing — attendance truth stays at the desk.
 */
export default function FindPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<WeddingEvent | null | 'loading'>('loading')
  const [guests, setGuests] = useState<Guest[]>([])
  const [recognized, setRecognized] = useState<Guest | null>(null)
  const [name, setName] = useState('')
  const [last4, setLast4] = useState('')
  const [candidates, setCandidates] = useState<Guest[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const payload = peekToken(token)
        if (!payload || payload.guest_id !== 'kiosk') return setEvent(null)
        const repo = getRepo()
        const e = await repo.getEvent(payload.event_id)
        if (!e) return setEvent(null)
        const ok = await verifyToken(token, e.guest_token_secret)
        if (!ok || ok.guest_id !== 'kiosk') return setEvent(null)
        const gs = await repo.listGuests(e.id)
        setEvent(e)
        setGuests(gs)
        const savedId = localStorage.getItem(`seatmap.selfid.${e.id}`)
        const saved = savedId
          ? (gs.find((g) => g.id === savedId && g.rsvp !== 'no') ?? null)
          : null
        if (saved) setRecognized(saved)
      } catch {
        setEvent(null)
      }
    })()
  }, [token])

  async function goToSeat(g: Guest) {
    if (!event || event === 'loading' || busy) return
    setBusy(true)
    try {
      localStorage.setItem(`seatmap.selfid.${event.id}`, g.id)
    } catch {}
    router.push(`/g/${await signToken(event.id, g.id, event.guest_token_secret)}`)
  }

  if (event === 'loading') {
    return (
      <Shell>
        <div className="gv-rise pt-36 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-2xl italic text-(--ink-soft)">One moment…</p>
        </div>
      </Shell>
    )
  }

  if (!event) {
    return (
      <Shell>
        <div className="gv-rise mx-auto mt-28 max-w-sm px-6 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-3xl italic">This code isn&apos;t valid</p>
          <p className="mt-3 text-[15px] leading-relaxed text-(--ink-soft)">
            Please see the greeter at the entrance desk — they&apos;ll find your table
            in seconds.
          </p>
        </div>
      </Shell>
    )
  }

  const input =
    'mt-1.5 w-full rounded-xl border border-(--line) bg-(--card) px-3.5 py-2.5 text-[15px] normal-case tracking-normal text-(--ink) placeholder:text-(--ink-faint) focus:border-(--gold-soft) focus:outline-none'
  const label = 'gv-caps block text-[10px] text-(--ink-faint)'

  return (
    <Shell>
      <div className="mx-auto max-w-md px-6 pt-12">
        <p className="gv-caps gv-rise text-center text-[11px] text-(--gold)">
          {event.couple_names}
        </p>
        <h1
          className="gv-display gv-rise mt-2 text-center text-4xl italic"
          style={{ animationDelay: '.08s' }}
        >
          Find your seat
        </h1>
        <Flourish className="gv-rise mx-auto mt-4" delay=".16s" />

        {recognized ? (
          <div className="gv-rise mt-8" style={{ animationDelay: '.24s' }}>
            <p className="text-center text-[15px] text-(--ink-soft)">
              Welcome back — is this you?
            </p>
            <GuestCard g={recognized} onYes={() => goToSeat(recognized)} busy={busy} />
            <button
              onClick={() => {
                setRecognized(null)
                setCandidates(null)
              }}
              className="mx-auto mt-3 block text-sm text-(--ink-faint) underline-offset-2 hover:underline"
            >
              Not me — search instead
            </button>
          </div>
        ) : (
          <div className="gv-rise mt-8 space-y-4" style={{ animationDelay: '.24s' }}>
            <label className={label}>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As it was given for the guest list"
                className={input}
              />
            </label>
            <label className={label}>
              Last 4 digits of your phone (optional)
              <input
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="Helps when names repeat"
                className={input}
              />
            </label>
            <button
              onClick={() => setCandidates(matchGuests(guests, name, last4))}
              disabled={!name.trim()}
              className="w-full rounded-full py-3 text-[15px] font-bold text-[#fffdf6] shadow-[0_16px_32px_-14px_rgba(140,105,35,.55)] transition-transform active:scale-[.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(165deg,#b3903f,#7d5f1a)' }}
            >
              Find my table
            </button>

            {candidates !== null && candidates.length === 0 && (
              <p className="pt-2 text-center text-[15px] leading-relaxed text-(--ink-soft)">
                We couldn&apos;t find you — please see the greeter at the entrance desk,
                they&apos;ll sort you out in seconds.
              </p>
            )}
            {candidates !== null && candidates.length > 5 && (
              <p className="pt-2 text-center text-[15px] leading-relaxed text-(--ink-soft)">
                That matches quite a few guests — add your phone digits above, or see
                the greeter at the entrance desk.
              </p>
            )}
            {candidates !== null && candidates.length >= 1 && candidates.length <= 5 && (
              <div className="pt-1">
                <p className="text-center text-sm text-(--ink-faint)">
                  {candidates.length === 1 ? 'Is this you?' : 'Which one is you?'}
                </p>
                {candidates.map((g) => (
                  <GuestCard key={g.id} g={g} onYes={() => goToSeat(g)} busy={busy} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

function GuestCard({ g, onYes, busy }: { g: Guest; onYes: () => void; busy: boolean }) {
  const mask = maskPhone(g.phone)
  return (
    <div className="mt-3 rounded-2xl border border-(--line) bg-(--card) p-4">
      <p className="gv-display text-xl font-semibold">{g.name}</p>
      <p className="mt-0.5 text-sm text-(--ink-soft)">
        {SIDE_LABEL[g.side]} · party of {g.party_size}
        {mask ? ` · ${mask}` : ''}
      </p>
      <button
        onClick={onYes}
        disabled={busy}
        className="mt-3 w-full rounded-full py-2.5 text-sm font-bold text-[#fffdf6] transition-transform active:scale-[.98] disabled:opacity-60"
        style={{ background: 'linear-gradient(165deg,#c5a04a,#8a6a1f)' }}
      >
        {busy ? 'Opening…' : 'Yes — show me my seat'}
      </button>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="gv-shell pb-12">{children}</div>
}
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit` → clean. `npx vitest run` → all pass. Dev-server compile check if reachable: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/find/x` → 200 (invalid-code state renders). Do not drive the UI further.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(guest)/find"
git commit -m "feat: /find — shared entrance QR identifies the guest, hands off to /g

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4 (controller-driven): E2E, suite, build, final review, merge

- [ ] Playwright probe on the demo event (`demo-e1`, secret `demo-secret-adam-eve`), phone viewport, restoring all state:
  1. Fresh context: `/find/<kiosk token>` → type `陈美玲` → confirm card shows party of 3 + ••••7777 → tap → lands on /g with "Your table".
  2. Same context revisits /find → recognized instantly ("Welcome back").
  3. RSVP context: submit an RSVP → visit /find → recognized without typing → cleanup: delete the probe guest via REST.
  4. Ambiguity: name-only search matching multiple demo guests → picker; nonsense name → greeter fallback; wrong last-4 falls back to name match.
- [ ] `npx vitest run` (expect 137), `npx tsc --noEmit`, `NEXT_DIST_DIR=.next-build npm run build` (dev server stays up), `rm -rf .next-build`.
- [ ] Final whole-branch review (most capable model) with review package from merge-base; fix loop if needed.
- [ ] `git checkout main && git merge --no-ff find-my-seat`; remind user to push/redeploy. No SQL migration needed.
