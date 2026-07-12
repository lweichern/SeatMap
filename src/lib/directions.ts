import { dist } from './geometry'
import type { Venue, VenueTable } from './types'

/**
 * Plain-language location line: "Back-right of the hall, near the entrance."
 * "Front" = the stage end when a stage exists, else the far end from the
 * entrance, else plan-top. Left/right in floor-plan terms.
 */
export function describeTablePosition(table: VenueTable, venue: Venue): string {
  const w = venue.width_m ?? 40
  const h = venue.height_m ?? 25

  // which end of the hall is "front"?
  let frontIsTop = true
  if (venue.stage) frontIsTop = venue.stage.y + venue.stage.h / 2 < h / 2
  else if (venue.entrance) frontIsTop = venue.entrance.y > h / 2

  const depth = table.y / h // 0 = top, 1 = bottom
  const frontness = frontIsTop ? depth : 1 - depth // 0 = front, 1 = back
  const lateral = table.x / w // 0 = left, 1 = right

  const band = (v: number, lo: string, mid: string, hi: string) =>
    v < 0.34 ? lo : v > 0.66 ? hi : mid

  const fb = band(frontness, 'front', 'middle', 'back')
  const lr = band(lateral, 'left', 'centre', 'right')

  let where: string
  if (fb === 'middle' && lr === 'centre') where = 'Right in the middle of the hall'
  else if (fb === 'middle') where = `Middle of the hall, ${lr} side`
  else if (lr === 'centre') where = `${cap(fb)}-centre of the hall`
  else where = `${cap(fb)}-${lr} of the hall`

  // nearest landmark clause
  const landmarks: { name: string; d: number }[] = []
  if (venue.stage) {
    landmarks.push({
      name: 'the stage',
      d: dist(table.x, table.y, venue.stage.x + venue.stage.w / 2, venue.stage.y + venue.stage.h / 2),
    })
  }
  if (venue.entrance) {
    landmarks.push({
      name: 'the entrance',
      d: dist(table.x, table.y, venue.entrance.x, venue.entrance.y),
    })
  }
  landmarks.sort((a, b) => a.d - b.d)
  const near = landmarks[0]
  const clause = near && near.d < Math.max(w, h) * 0.4 ? `, near ${near.name}` : ''

  return `${where}${clause}.`
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}
