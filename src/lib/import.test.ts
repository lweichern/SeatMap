import { describe, it, expect } from 'vitest'
import { detectColumns, rowsToGuests } from './import'

describe('detectColumns', () => {
  it('matches clean english headers', () => {
    const m = detectColumns(['Name', 'Phone', 'Email', 'Side', 'Group', 'VIP'])
    expect(m.name).toBe(0)
    expect(m.phone).toBe(1)
    expect(m.email).toBe(2)
    expect(m.side).toBe(3)
    expect(m.group_tag).toBe(4)
    expect(m.is_vip).toBe(5)
  })

  it('matches messy real-world headers', () => {
    const m = detectColumns(['Guest Name ', 'Mobile No.', 'No. of Pax', 'Category'])
    expect(m.name).toBe(0)
    expect(m.phone).toBe(1)
    expect(m.party_size).toBe(2)
    expect(m.group_tag).toBe(3)
  })

  it('matches chinese headers', () => {
    const m = detectColumns(['名字', '电话', '人数'])
    expect(m.name).toBe(0)
    expect(m.phone).toBe(1)
    expect(m.party_size).toBe(2)
  })

  it('leaves unknown columns unmapped', () => {
    const m = detectColumns(['Name', 'Dietary'])
    expect(m.name).toBe(0)
    expect(m.phone).toBeNull()
  })
})

describe('rowsToGuests', () => {
  const mapping = {
    name: 0,
    phone: 1,
    email: null,
    party_size: 2,
    side: 3,
    group_tag: 4,
    is_vip: 5,
  }

  it('converts rows with defaults and trimming', () => {
    const rows = [
      ['  Uncle Lim ', '0123456789', '3', 'groom', 'Family', 'yes'],
      ['Aunty Tan', '', '', 'BRIDE', '', ''],
    ]
    const gs = rowsToGuests(rows, mapping, 'e1')
    expect(gs.length).toBe(2)
    expect(gs[0].name).toBe('Uncle Lim')
    expect(gs[0].party_size).toBe(3)
    expect(gs[0].side).toBe('groom')
    expect(gs[0].group_tag).toBe('Family')
    expect(gs[0].is_vip).toBe(true)
    expect(gs[0].event_id).toBe('e1')
    expect(gs[1].party_size).toBe(1)
    expect(gs[1].side).toBe('bride')
    expect(gs[1].is_vip).toBe(false)
    expect(gs[1].phone).toBeNull()
  })

  it('skips rows with empty names', () => {
    const gs = rowsToGuests([['', '1', '', '', '', ''], ['  ', '', '', '', '', '']], mapping, 'e1')
    expect(gs).toEqual([])
  })

  it('recognises vip variants and numeric party size junk', () => {
    const rows = [
      ['A', '', 'x', '', '', 'TRUE'],
      ['B', '', '-2', '', '', '1'],
      ['C', '', '10', '', '', 'no'],
    ]
    const gs = rowsToGuests(rows, mapping, 'e1')
    expect(gs[0].party_size).toBe(1) // 'x' -> default
    expect(gs[0].is_vip).toBe(true)
    expect(gs[1].party_size).toBe(1) // negative -> default
    expect(gs[1].is_vip).toBe(true)
    expect(gs[2].party_size).toBe(10)
    expect(gs[2].is_vip).toBe(false)
  })
})
