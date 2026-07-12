import { signToken, guestUrl } from './token'
import type { Guest, WeddingEvent } from './types'

/** Fill qr_token for guests that don't have one yet. Pure — returns copies. */
export async function ensureTokens(
  event: WeddingEvent,
  guests: Guest[],
): Promise<Guest[]> {
  return Promise.all(
    guests.map(async (g) =>
      g.qr_token
        ? g
        : { ...g, qr_token: await signToken(event.id, g.id, event.guest_token_secret) },
    ),
  )
}

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'guest'
}

/** ZIP of one PNG per guest, named after the guest — for dropping into invite designs. */
export async function exportPngZip(guests: Guest[], origin: string): Promise<Blob> {
  const [QRCode, JSZip] = await Promise.all([import('qrcode'), import('jszip')])
  const zip = new JSZip.default()
  const used = new Set<string>()
  for (const g of guests) {
    if (!g.qr_token) continue
    const dataUrl = await QRCode.toDataURL(guestUrl(origin, g.qr_token), {
      width: 600,
      margin: 2,
    })
    let base = safeFilename(g.name)
    let name = `${base}.png`
    for (let i = 2; used.has(name); i++) name = `${base} (${i}).png`
    used.add(name)
    zip.file(name, dataUrl.split(',')[1], { base64: true })
  }
  return zip.generateAsync({ type: 'blob' })
}

/**
 * Render a text line to a transparent PNG via canvas. jsPDF's built-in fonts
 * cannot render CJK — and Chinese guest names are the norm at the weddings
 * this is built for — so names go in as images using system fonts.
 */
function textToPng(
  text: string,
  fontPx: number,
  bold: boolean,
  color: string,
): { dataUrl: string; aspect: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `${bold ? 'bold ' : ''}${fontPx}px -apple-system, "Segoe UI", "Noto Sans SC", sans-serif`
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 4
  canvas.width = Math.max(w, 1)
  canvas.height = Math.ceil(fontPx * 1.4)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 2, canvas.height / 2)
  return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height }
}

/** A4 sheet of QR cards (name + QR + cut lines) for printing. */
export async function exportPdfSheet(
  event: WeddingEvent,
  guests: Guest[],
  origin: string,
): Promise<Blob> {
  const [QRCode, { jsPDF }] = await Promise.all([import('qrcode'), import('jspdf')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const COLS = 3
  const ROWS = 4
  const PAGE_W = 210
  const PAGE_H = 297
  const CELL_W = PAGE_W / COLS
  const CELL_H = PAGE_H / ROWS
  const QR_SIZE = 42

  const withTokens = guests.filter((g) => g.qr_token)
  for (let i = 0; i < withTokens.length; i++) {
    const g = withTokens[i]
    const idx = i % (COLS * ROWS)
    if (i > 0 && idx === 0) doc.addPage()
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    const x0 = col * CELL_W
    const y0 = row * CELL_H

    // cut lines
    doc.setDrawColor(200)
    doc.setLineDashPattern([1.5, 1.5], 0)
    doc.rect(x0, y0, CELL_W, CELL_H)
    doc.setLineDashPattern([], 0)

    const qrDataUrl = await QRCode.toDataURL(guestUrl(origin, g.qr_token!), {
      width: 300,
      margin: 1,
    })
    doc.addImage(qrDataUrl, 'PNG', x0 + (CELL_W - QR_SIZE) / 2, y0 + 8, QR_SIZE, QR_SIZE)

    // names as images — survives Chinese/any-script guest names
    const name = textToPng(g.name, 44, true, '#0f172a')
    const nameH = 4.5
    const nameW = Math.min(nameH * name.aspect, CELL_W - 8)
    doc.addImage(
      name.dataUrl,
      'PNG',
      x0 + (CELL_W - nameW) / 2,
      y0 + QR_SIZE + 11,
      nameW,
      nameH,
    )
    const couple = textToPng(event.couple_names, 32, false, '#828a96')
    const coupleH = 3.2
    const coupleW = Math.min(coupleH * couple.aspect, CELL_W - 8)
    doc.addImage(
      couple.dataUrl,
      'PNG',
      x0 + (CELL_W - coupleW) / 2,
      y0 + QR_SIZE + 17,
      coupleW,
      coupleH,
    )
  }
  return doc.output('blob')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
