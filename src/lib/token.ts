/**
 * Guest QR tokens: HMAC-SHA256 signed `{event_id, guest_id}`, verifiable
 * STATELESSLY — the greeter tablet checks tokens with zero network using the
 * event secret cached before doors open. Web Crypto only (browser + node 20).
 *
 * Format: base64url("event_id:guest_id") + "." + base64url(hmac[0..16])
 */

export interface TokenPayload {
  event_id: string
  guest_id: string
}

const SIG_BYTES = 16 // truncated HMAC — plenty for a wedding door check

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

async function hmac(message: string, secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return new Uint8Array(sig).slice(0, SIG_BYTES)
}

export async function signToken(
  eventId: string,
  guestId: string,
  secret: string,
): Promise<string> {
  const payload = `${eventId}:${guestId}`
  const sig = await hmac(payload, secret)
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(sig)}`
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<TokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const payloadBytes = b64urlDecode(parts[0])
  const gotSig = b64urlDecode(parts[1])
  if (!payloadBytes || !gotSig || gotSig.length !== SIG_BYTES) return null
  const payload = new TextDecoder().decode(payloadBytes)
  const wantSig = await hmac(payload, secret)
  // constant-time compare
  let diff = 0
  for (let i = 0; i < SIG_BYTES; i++) diff |= wantSig[i] ^ gotSig[i]
  if (diff !== 0) return null
  const idx = payload.indexOf(':')
  if (idx <= 0) return null
  return { event_id: payload.slice(0, idx), guest_id: payload.slice(idx + 1) }
}

/**
 * Decode a token's payload WITHOUT verifying it — for looking up which
 * event's secret to verify against. Never trust the result on its own.
 */
export function peekToken(token: string): TokenPayload | null {
  const payloadBytes = b64urlDecode(token.split('.')[0] ?? '')
  if (!payloadBytes) return null
  const payload = new TextDecoder().decode(payloadBytes)
  const idx = payload.indexOf(':')
  if (idx <= 0) return null
  return { event_id: payload.slice(0, idx), guest_id: payload.slice(idx + 1) }
}

/** The URL a guest QR encodes. */
export function guestUrl(origin: string, token: string): string {
  return `${origin}/g/${token}`
}
