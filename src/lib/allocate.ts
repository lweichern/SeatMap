import { dist } from './geometry'
import type { Guest, GuestConstraint, Stage, VenueTable } from './types'

export interface AllocationInput {
  guests: Guest[]
  tables: VenueTable[]
  constraints: GuestConstraint[]
  stage: Stage | null
  seed?: number
  iterations?: number
}

export interface BrokenConstraint {
  type: GuestConstraint['type']
  guest_a_id: string
  guest_b_id: string
}

export interface AllocationResult {
  /** guestId -> tableId */
  assignments: Record<string, string>
  /** guest ids that could not be seated anywhere */
  unseated: string[]
  /** hard constraints that could not be satisfied */
  broken: BrokenConstraint[]
}

/**
 * A unit is the atomic thing we seat: one guest, or a must-sit-together
 * cluster. Units never split across tables.
 */
interface Unit {
  guests: Guest[]
  size: number
  isVip: boolean
  groupTag: string | null
  /** table id if any member is locked */
  pinnedTo: string | null
}

// Deterministic LCG so allocation is reproducible (and testable) per seed.
function makeRng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function buildUnits(
  guests: Guest[],
  constraints: GuestConstraint[],
): { units: Unit[]; broken: BrokenConstraint[] } {
  const broken: BrokenConstraint[] = []
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  for (const g of guests) parent.set(g.id, g.id)
  const byId = new Map(guests.map((g) => [g.id, g]))

  for (const c of constraints) {
    if (c.type !== 'must_sit_together') continue
    if (!byId.has(c.guest_a_id) || !byId.has(c.guest_b_id)) continue
    parent.set(find(c.guest_a_id), find(c.guest_b_id))
  }

  const clusters = new Map<string, Guest[]>()
  for (const g of guests) {
    const root = find(g.id)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(g)
  }

  // must_not inside a must-sit cluster is unsatisfiable by construction
  for (const c of constraints) {
    if (c.type !== 'must_not_sit_together') continue
    if (!byId.has(c.guest_a_id) || !byId.has(c.guest_b_id)) continue
    if (find(c.guest_a_id) === find(c.guest_b_id)) {
      broken.push({ type: c.type, guest_a_id: c.guest_a_id, guest_b_id: c.guest_b_id })
    }
  }

  const units: Unit[] = []
  for (const members of clusters.values()) {
    const tags = members.map((g) => g.group_tag).filter(Boolean) as string[]
    const pins = [
      ...new Set(members.filter((g) => g.locked && g.table_id).map((g) => g.table_id!)),
    ]
    units.push({
      guests: members,
      size: members.reduce((s, g) => s + g.party_size, 0),
      isVip: members.some((g) => g.is_vip),
      groupTag: tags[0] ?? null,
      pinnedTo: pins[0] ?? null,
    })
  }
  return { units, broken }
}

export function allocate(input: AllocationInput): AllocationResult {
  const { guests, constraints, stage } = input
  // Guests are never seated at a buffet — service objects don't exist here.
  const tables = input.tables.filter((t) => t.kind === 'seat')
  const iterations = input.iterations ?? 2000
  const rng = makeRng(input.seed ?? 1)

  const { units, broken } = buildUnits(guests, constraints)

  // tables sorted by distance to stage centre (VIP proximity order)
  const stageC = stage
    ? { x: stage.x + stage.w / 2, y: stage.y + stage.h / 2 }
    : null
  const rankedTables = [...tables].sort((a, b) => {
    if (!stageC) return a.label.localeCompare(b.label, undefined, { numeric: true })
    return dist(a.x, a.y, stageC.x, stageC.y) - dist(b.x, b.y, stageC.x, stageC.y)
  })
  const stageRank = new Map(rankedTables.map((t, i) => [t.id, i]))

  const free = new Map<string, number>(tables.map((t) => [t.id, t.seats ?? 0]))
  const seatOf = new Map<Unit, string>()

  const place = (u: Unit, tableId: string) => {
    seatOf.set(u, tableId)
    free.set(tableId, free.get(tableId)! - u.size)
  }

  // 1. pinned units first — locked guests are non-negotiable
  const unpinned: Unit[] = []
  for (const u of units) {
    if (u.pinnedTo && free.has(u.pinnedTo)) place(u, u.pinnedTo)
    else unpinned.push(u)
  }

  // 2. seed: VIP units nearest stage, then best-fit-decreasing for the rest
  const seatBestFit = (u: Unit, ordered: VenueTable[]): boolean => {
    let best: string | null = null
    let bestFree = Infinity
    for (const t of ordered) {
      const f = free.get(t.id)!
      if (f >= u.size && f < bestFree) {
        best = t.id
        bestFree = f
      }
    }
    if (best) place(u, best)
    return best !== null
  }

  const unseatedUnits: Unit[] = []
  const vips = unpinned.filter((u) => u.isVip).sort((a, b) => b.size - a.size)
  for (const u of vips) {
    // VIPs: first table (nearest stage) with room, not best-fit
    const t = rankedTables.find((t) => free.get(t.id)! >= u.size)
    if (t) place(u, t.id)
    else unseatedUnits.push(u)
  }
  const rest = unpinned.filter((u) => !u.isVip).sort((a, b) => b.size - a.size)
  for (const u of rest) {
    if (!seatBestFit(u, rankedTables)) unseatedUnits.push(u)
  }

  // scoring
  const mustNot = constraints.filter((c) => c.type === 'must_not_sit_together')
  const tableOfGuest = (): Map<string, string> => {
    const m = new Map<string, string>()
    for (const [u, tid] of seatOf) for (const g of u.guests) m.set(g.id, tid)
    return m
  }

  const score = (): number => {
    const gt = tableOfGuest()
    let s = 0
    for (const c of mustNot) {
      const ta = gt.get(c.guest_a_id)
      if (ta !== undefined && ta === gt.get(c.guest_b_id)) s -= 1000
    }
    // group cohesion: +10 per same-table pair within a tag
    const tagTables = new Map<string, Map<string, number>>()
    for (const [u, tid] of seatOf) {
      for (const g of u.guests) {
        if (!g.group_tag) continue
        if (!tagTables.has(g.group_tag)) tagTables.set(g.group_tag, new Map())
        const m = tagTables.get(g.group_tag)!
        m.set(tid, (m.get(tid) ?? 0) + 1)
      }
    }
    for (const m of tagTables.values()) {
      for (const n of m.values()) s += 10 * ((n * (n - 1)) / 2)
    }
    // VIP proximity: penalise stage-distance rank
    for (const [u, tid] of seatOf) {
      if (u.isVip) s -= 5 * (stageRank.get(tid) ?? 0)
    }
    // fill efficiency: fuller tables score higher
    const used = new Map<string, number>()
    for (const [u, tid] of seatOf) used.set(tid, (used.get(tid) ?? 0) + u.size)
    for (const t of tables) {
      const n = used.get(t.id) ?? 0
      if (n > 0) s += (n / (t.seats ?? 1)) * 5
    }
    return s
  }

  // 3. hill climbing: swap two movable units or move one to spare capacity
  const movable = unpinned.filter((u) => seatOf.has(u))
  let current = score()
  if (movable.length >= 1) {
    for (let i = 0; i < iterations; i++) {
      const a = movable[Math.floor(rng() * movable.length)]
      const ta = seatOf.get(a)!
      if (rng() < 0.5 && movable.length >= 2) {
        const b = movable[Math.floor(rng() * movable.length)]
        const tb = seatOf.get(b)!
        if (a === b || ta === tb) continue
        // capacity check for swap
        if (free.get(ta)! + a.size - b.size < 0) continue
        if (free.get(tb)! + b.size - a.size < 0) continue
        seatOf.set(a, tb)
        seatOf.set(b, ta)
        free.set(ta, free.get(ta)! + a.size - b.size)
        free.set(tb, free.get(tb)! + b.size - a.size)
        const next = score()
        if (next >= current) current = next
        else {
          seatOf.set(a, ta)
          seatOf.set(b, tb)
          free.set(ta, free.get(ta)! - a.size + b.size)
          free.set(tb, free.get(tb)! - b.size + a.size)
        }
      } else {
        const t = tables[Math.floor(rng() * tables.length)]
        if (t.id === ta || free.get(t.id)! < a.size) continue
        seatOf.set(a, t.id)
        free.set(ta, free.get(ta)! + a.size)
        free.set(t.id, free.get(t.id)! - a.size)
        const next = score()
        if (next > current) current = next
        else {
          seatOf.set(a, ta)
          free.set(ta, free.get(ta)! - a.size)
          free.set(t.id, free.get(t.id)! + a.size)
        }
      }
    }
  }

  // retry unseated units into any capacity freed up by the search
  const stillUnseated: Unit[] = []
  for (const u of unseatedUnits) {
    if (!seatBestFit(u, rankedTables)) stillUnseated.push(u)
  }

  // final broken must_not report
  const gt = tableOfGuest()
  for (const c of mustNot) {
    const ta = gt.get(c.guest_a_id)
    if (ta !== undefined && ta === gt.get(c.guest_b_id)) {
      broken.push({ type: c.type, guest_a_id: c.guest_a_id, guest_b_id: c.guest_b_id })
    }
  }

  const assignments: Record<string, string> = {}
  for (const [gid, tid] of gt) assignments[gid] = tid
  return {
    assignments,
    unseated: stillUnseated.flatMap((u) => u.guests.map((g) => g.id)),
    broken,
  }
}
