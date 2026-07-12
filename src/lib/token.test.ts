import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from './token'

const SECRET = 'a3bb189e-8bf9-3888-9912-ace4e6543002'
const EVENT = 'e7f0c000-1111-2222-3333-444455556666'
const GUEST = 'g1234567-aaaa-bbbb-cccc-ddddeeeeffff'

describe('signToken / verifyToken', () => {
  it('round-trips a valid token', async () => {
    const token = await signToken(EVENT, GUEST, SECRET)
    const payload = await verifyToken(token, SECRET)
    expect(payload).toEqual({ event_id: EVENT, guest_id: GUEST })
  })

  it('produces URL-safe tokens', async () => {
    const token = await signToken(EVENT, GUEST, SECRET)
    expect(token).toMatch(/^[A-Za-z0-9_.-]+$/)
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken(EVENT, GUEST, SECRET)
    const [, sig] = token.split('.')
    const forged =
      Buffer.from(`${EVENT}:different-guest`).toString('base64url') + '.' + sig
    expect(await verifyToken(forged, SECRET)).toBeNull()
  })

  it('rejects a wrong secret', async () => {
    const token = await signToken(EVENT, GUEST, SECRET)
    expect(await verifyToken(token, 'wrong-secret')).toBeNull()
  })

  it('rejects garbage', async () => {
    expect(await verifyToken('not-a-token', SECRET)).toBeNull()
    expect(await verifyToken('', SECRET)).toBeNull()
    expect(await verifyToken('a.b.c.d', SECRET)).toBeNull()
  })

  it('is deterministic (stateless verification)', async () => {
    const t1 = await signToken(EVENT, GUEST, SECRET)
    const t2 = await signToken(EVENT, GUEST, SECRET)
    expect(t1).toBe(t2)
  })
})
