import * as THREE from 'three'

/**
 * Canvas-texture label sprites. Sprites billboard toward the camera so text
 * is NEVER edge-on. Textures are cached by content+style — 24 labels
 * re-rasterised on every keystroke is expensive, and the scene rebuilds on
 * every inspector change. Cached textures are deliberately never disposed.
 */

// Safari only shipped roundRect in 16.4 and a good share of guests are on
// older iPhones.
if (
  typeof CanvasRenderingContext2D !== 'undefined' &&
  !CanvasRenderingContext2D.prototype.roundRect
) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | DOMPointInit | (number | DOMPointInit)[],
  ) {
    const rad = Math.min(typeof r === 'number' ? r : 8, w / 2, h / 2)
    this.moveTo(x + rad, y)
    this.arcTo(x + w, y, x + w, y + h, rad)
    this.arcTo(x + w, y + h, x, y + h, rad)
    this.arcTo(x, y + h, x, y, rad)
    this.arcTo(x, y, x + w, y, rad)
    this.closePath()
    return this
  }
}

export interface LabelStyle {
  fontPx: number
  fg: string
  bg: string
  border?: string
  sub?: string // second line, smaller
  subFg?: string
}

const cache = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>()

export function labelTexture(
  text: string,
  style: LabelStyle,
): { texture: THREE.CanvasTexture; aspect: number } {
  const key = `${text}|${JSON.stringify(style)}`
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `bold ${style.fontPx}px -apple-system, "Segoe UI", "Noto Sans SC", sans-serif`
  const subFont = `600 ${Math.round(style.fontPx * 0.55)}px -apple-system, "Segoe UI", sans-serif`
  ctx.font = font
  const textW = ctx.measureText(text).width
  ctx.font = subFont
  const subW = style.sub ? ctx.measureText(style.sub).width : 0
  const padX = style.fontPx * 0.6
  const padY = style.fontPx * 0.35
  const w = Math.ceil(Math.max(textW, subW) + padX * 2)
  const lineH = style.fontPx * 1.15
  const subH = style.sub ? style.fontPx * 0.75 : 0
  const h = Math.ceil(lineH + subH + padY * 2)
  canvas.width = w
  canvas.height = h

  ctx.beginPath()
  ctx.roundRect(1, 1, w - 2, h - 2, h * 0.28)
  ctx.fillStyle = style.bg
  ctx.fill()
  if (style.border) {
    ctx.strokeStyle = style.border
    ctx.lineWidth = Math.max(2, style.fontPx * 0.08)
    ctx.stroke()
  }

  ctx.font = font
  ctx.fillStyle = style.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, padY + lineH / 2)
  if (style.sub) {
    ctx.font = subFont
    ctx.fillStyle = style.subFg ?? style.fg
    ctx.fillText(style.sub, w / 2, padY + lineH + subH / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  // no mipmaps — keeps small text crisp
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  const entry = { texture, aspect: w / h }
  cache.set(key, entry)
  return entry
}
