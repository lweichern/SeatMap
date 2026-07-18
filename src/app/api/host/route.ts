import { NextResponse } from 'next/server'
import os from 'os'

/**
 * The server's LAN address — used instead of "localhost" when building QR
 * and invite links, so a phone on the same wifi can actually open them.
 */
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const port = new URL(req.url).port || '3000'
  let ip: string | null = null
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address
        break
      }
    }
    if (ip) break
  }
  return NextResponse.json({ origin: ip ? `http://${ip}:${port}` : null })
}
