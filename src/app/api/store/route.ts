import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/**
 * Dev/demo shared store: the whole database as ONE JSON document, so every
 * device sees the same data. Storage ladder:
 *
 *   1. Upstash Redis (or Vercel KV) when its env vars exist — survives
 *      serverless deploys; add the free "Upstash for Redis" integration in
 *      Vercel and redeploy.
 *   2. A local file (.data/store.json) — dev machines / LAN pitching.
 *   3. Neither available on Vercel → 501, and the client falls back to
 *      per-browser localStorage instead of silently losing writes.
 *
 * Production proper uses Supabase, not this route.
 */
export const runtime = 'nodejs'

const FILE = path.join(process.cwd(), '.data', 'store.json')
const KEY = 'seatmap-store'

function kv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

async function kvCommand(cmd: unknown[]): Promise<{ result: unknown }> {
  const { url, token } = kv()!
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  if (!res.ok) throw new Error(`kv ${res.status}: ${await res.text()}`)
  return res.json()
}

const noStore = () =>
  NextResponse.json(
    { error: 'no shared storage configured — add the Upstash Redis integration' },
    { status: 501 },
  )

export async function GET() {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  if (kv()) {
    try {
      const { result } = await kvCommand(['GET', KEY])
      return new NextResponse(typeof result === 'string' && result ? result : 'null', { headers })
    } catch (err) {
      console.error('kv read failed', err)
      return noStore()
    }
  }
  if (process.env.VERCEL) return noStore()
  try {
    return new NextResponse(await fs.readFile(FILE, 'utf8'), { headers })
  } catch {
    return new NextResponse('null', { headers })
  }
}

export async function PUT(req: Request) {
  const body = await req.text()
  if (kv()) {
    try {
      await kvCommand(['SET', KEY, body])
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('kv write failed', err)
      return noStore()
    }
  }
  if (process.env.VERCEL) return noStore()
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true })
    await fs.writeFile(FILE, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('file write failed', err)
    return noStore()
  }
}
