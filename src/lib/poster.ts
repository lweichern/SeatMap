/**
 * Print-ready poster PNGs (A4 @ ~150 dpi) in the guest-page ivory/gold
 * stationery style — for the shared RSVP invite and the entrance
 * seat-finder QR. Pure canvas: no fonts to load, serif via Georgia.
 */

const W = 1240
const H = 1754
const INK = '#392e1e'
const INK_SOFT = '#6f6046'
const INK_FAINT = '#a08c66'
const GOLD = '#a8842c'
const GOLD_SOFT = '#d9c48e'
const IVORY = '#faf5ea'
const CARD = '#fffdf6'

function spaced(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  gap: number,
) {
  // manual letter-spacing (canvas letterSpacing isn't everywhere yet)
  const widths = [...text].map((c) => g.measureText(c).width)
  const total = widths.reduce((s, w) => s + w, 0) + gap * (text.length - 1)
  let cx = x - total / 2
  ;[...text].forEach((c, i) => {
    g.fillText(c, cx + widths[i] / 2, y)
    cx += widths[i] + gap
  })
}

function flourish(g: CanvasRenderingContext2D, cx: number, y: number) {
  g.strokeStyle = GOLD_SOFT
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx - 160, y)
  g.lineTo(cx - 24, y)
  g.moveTo(cx + 24, y)
  g.lineTo(cx + 160, y)
  g.stroke()
  g.strokeStyle = GOLD
  g.save()
  g.translate(cx, y)
  g.rotate(Math.PI / 4)
  g.strokeRect(-9, -9, 18, 18)
  g.restore()
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export async function downloadPosterPng(opts: {
  eyebrow: string
  title: string
  subtitle: string
  instruction: string
  url: string
  filename: string
}) {
  const QRCode = await import('qrcode')
  const qrData = await QRCode.toDataURL(opts.url, {
    width: 620,
    margin: 1,
    color: { dark: INK, light: CARD },
  })

  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'

  // paper + soft champagne glow
  g.fillStyle = IVORY
  g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W / 2, 0, 120, W / 2, H * 0.25, H * 0.9)
  glow.addColorStop(0, 'rgba(246,234,208,.95)')
  glow.addColorStop(1, 'rgba(246,234,208,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, W, H)

  // double border frame
  g.strokeStyle = GOLD_SOFT
  g.lineWidth = 3
  g.strokeRect(56, 56, W - 112, H - 112)
  g.strokeStyle = GOLD
  g.lineWidth = 1.5
  g.strokeRect(76, 76, W - 152, H - 152)

  // eyebrow
  g.fillStyle = GOLD
  g.font = '600 30px "Avenir Next", "Trebuchet MS", sans-serif'
  spaced(g, opts.eyebrow.toUpperCase(), W / 2, 300, 9)

  // couple names — shrink to fit
  g.fillStyle = INK
  let size = 116
  do {
    g.font = `italic 600 ${size}px Georgia, "Times New Roman", serif`
    size -= 4
  } while (g.measureText(opts.title).width > W - 260 && size > 48)
  g.fillText(opts.title, W / 2, 460)

  flourish(g, W / 2, 540)

  // subtitle (date · venue)
  g.fillStyle = INK_SOFT
  g.font = '400 40px Georgia, "Times New Roman", serif'
  g.fillText(opts.subtitle, W / 2, 632)

  // QR card
  const qs = 620
  const qx = (W - qs) / 2
  const qy = 730
  g.save()
  g.shadowColor = 'rgba(90,66,20,.32)'
  g.shadowBlur = 60
  g.shadowOffsetY = 26
  roundRect(g, qx - 44, qy - 44, qs + 88, qs + 88, 36)
  g.fillStyle = CARD
  g.fill()
  g.restore()
  g.strokeStyle = GOLD_SOFT
  g.lineWidth = 2
  roundRect(g, qx - 44, qy - 44, qs + 88, qs + 88, 36)
  g.stroke()

  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('QR image failed'))
    img.src = qrData
  })
  g.drawImage(img, qx, qy, qs, qs)

  // instruction
  g.fillStyle = INK
  g.font = '600 48px "Avenir Next", "Trebuchet MS", sans-serif'
  g.fillText(opts.instruction, W / 2, qy + qs + 168)
  g.fillStyle = INK_FAINT
  g.font = '400 30px "Avenir Next", "Trebuchet MS", sans-serif'
  g.fillText('Point your phone camera at the code', W / 2, qy + qs + 224)

  // footer wordmark
  g.fillStyle = INK_FAINT
  g.font = '600 24px "Avenir Next", "Trebuchet MS", sans-serif'
  spaced(g, 'SEATMAP', W / 2, H - 120, 8)

  const a = document.createElement('a')
  a.href = cv.toDataURL('image/png')
  a.download = opts.filename
  a.click()
}
