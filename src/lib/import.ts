import { newTableId } from './layout-ops'
import type { Guest, GuestSide } from './types'

/** Column index per guest field, or null if the sheet doesn't have it. */
export interface ColumnMapping {
  name: number | null
  phone: number | null
  email: number | null
  party_size: number | null
  side: number | null
  group_tag: number | null
  is_vip: number | null
}

export const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  party_size: 'Party size',
  side: 'Side',
  group_tag: 'Group',
  is_vip: 'VIP',
}

// Planners live in Excel — headers arrive in every imaginable form.
const PATTERNS: Record<keyof ColumnMapping, RegExp> = {
  name: /^(full\s*)?(guest\s*)?name$|姓名|名字|宾客/i,
  phone: /phone|mobile|contact|whatsapp|tel|电话|手机/i,
  email: /e-?mail|邮箱/i,
  party_size: /pax|party|persons?$|seats?$|plus|人数/i,
  side: /side|bride|groom|方/i,
  group_tag: /group|tag|category|table\s*group|组|类别/i,
  is_vip: /vip|贵宾/i,
}

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    name: null,
    phone: null,
    email: null,
    party_size: null,
    side: null,
    group_tag: null,
    is_vip: null,
  }
  const taken = new Set<number>()
  for (const field of Object.keys(PATTERNS) as (keyof ColumnMapping)[]) {
    const idx = headers.findIndex(
      (h, i) => !taken.has(i) && PATTERNS[field].test(h.trim()),
    )
    if (idx >= 0) {
      mapping[field] = idx
      taken.add(idx)
    }
  }
  return mapping
}

function cell(row: unknown[], idx: number | null): string {
  if (idx === null || idx >= row.length) return ''
  const v = row[idx]
  return v === null || v === undefined ? '' : String(v).trim()
}

function parseSide(raw: string): GuestSide {
  const s = raw.toLowerCase()
  if (/bride|女方|新娘/.test(s)) return 'bride'
  if (/groom|男方|新郎/.test(s)) return 'groom'
  return 'both'
}

function parseVip(raw: string): boolean {
  return /^(y(es)?|true|1|vip|✓)$/i.test(raw.trim())
}

function parsePartySize(raw: string): number {
  const n = parseInt(raw, 10)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function rowsToGuests(
  rows: unknown[][],
  mapping: ColumnMapping,
  eventId: string,
): Guest[] {
  const guests: Guest[] = []
  for (const row of rows) {
    const name = cell(row, mapping.name)
    if (!name) continue
    guests.push({
      id: newTableId(),
      event_id: eventId,
      name,
      phone: cell(row, mapping.phone) || null,
      email: cell(row, mapping.email) || null,
      party_size: parsePartySize(cell(row, mapping.party_size)),
      side: parseSide(cell(row, mapping.side)),
      group_tag: cell(row, mapping.group_tag) || null,
      is_vip: parseVip(cell(row, mapping.is_vip)),
      table_id: null,
      qr_token: null,
      checked_in_at: null,
      locked: false,
    })
  }
  return guests
}

/** Parse CSV/XLSX into headers + data rows. Browser-only (SheetJS). */
export async function parseSpreadsheet(
  file: File,
): Promise<{ headers: string[]; rows: unknown[][] }> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  })
  const headers = (all[0] ?? []).map((h) => String(h))
  return { headers, rows: all.slice(1) }
}
