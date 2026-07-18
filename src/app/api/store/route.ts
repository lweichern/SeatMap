import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/**
 * Dev/demo shared store: the whole database as one JSON document on the
 * server's disk. Every browser on the network reads and writes the SAME
 * data through this route — which is what makes scanning a QR with a real
 * phone work in demo mode. Production uses Supabase instead.
 */
export const runtime = 'nodejs'

const FILE = path.join(process.cwd(), '.data', 'store.json')

export async function GET() {
  try {
    const text = await fs.readFile(FILE, 'utf8')
    return new NextResponse(text, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    return new NextResponse('null', {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}

export async function PUT(req: Request) {
  const body = await req.text()
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, body)
  return NextResponse.json({ ok: true })
}
