import { getRepo } from './repo'
import { signToken } from './token'
import type {
  Guest,
  GuestConstraint,
  Photo,
  TableObj,
  Venue,
  VenueTableLayout,
  WeddingEvent,
} from './types'

/**
 * One-click pitch world: "Adam & Eve at the Grand Ballroom". Deterministic
 * `demo-` ids, so loading again RESETS the demo — walk-ins, check-ins and
 * uploads from the previous run are wiped and every screen returns to its
 * pristine state. Guests start UNASSIGNED so Auto-allocate lands live.
 * Browser-only (uses canvas to draw the floor plan and photos).
 */

export const DEMO_VENUE_ID = 'demo-v1'
export const DEMO_EVENT_ID = 'demo-e1'
const DEMO_LAYOUT_ID = 'demo-l1'
const DEMO_SECRET = 'demo-secret-adam-eve'

export async function demoExists(): Promise<boolean> {
  return (await getRepo().getEvent(DEMO_EVENT_ID)) !== null
}

function drawFloorplan(): string {
  const c = document.createElement('canvas')
  c.width = 700
  c.height = 420
  const g = c.getContext('2d')!
  g.fillStyle = '#faf8f2'
  g.fillRect(0, 0, 700, 420)
  g.strokeStyle = '#c9c2ae'
  g.lineWidth = 1
  for (let x = 0; x <= 700; x += 20) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 420); g.stroke()
  }
  for (let y = 0; y <= 420; y += 20) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(700, y); g.stroke()
  }
  g.strokeStyle = '#8a8064'
  g.lineWidth = 5
  g.strokeRect(80, 60, 520, 260)
  g.font = 'bold 18px sans-serif'
  g.fillStyle = '#8a8064'
  g.fillText('GRAND BALLROOM · LEVEL 3', 240, 40)
  return c.toDataURL('image/png')
}

function drawPhoto(color: string, label: string): string {
  const cv = document.createElement('canvas')
  cv.width = 640
  cv.height = 480
  const g = cv.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 640, 480)
  gr.addColorStop(0, color)
  gr.addColorStop(1, '#1f2937')
  g.fillStyle = gr
  g.fillRect(0, 0, 640, 480)
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.font = 'bold 44px sans-serif'
  g.fillText(label, 60, 250)
  return cv.toDataURL('image/webp', 0.8)
}

/** Load (or reset) the demo. Returns the demo event id. */
export async function loadDemoEvent(): Promise<string> {
  const repo = getRepo()

  // reset: wipe every trace of a previous demo run
  const oldPhotos = await repo.listPhotos(DEMO_EVENT_ID).catch(() => [])
  for (const ph of oldPhotos) await repo.deletePhoto(ph.id)
  await repo.deleteEvent(DEMO_EVENT_ID)
  await repo.deleteVenue(DEMO_VENUE_ID)

  const venue: Venue = {
    id: DEMO_VENUE_ID,
    org_id: 'local-org',
    name: 'Grand Ballroom @ Hilton KL (demo)',
    address: 'Jalan Sultan Ismail, Kuala Lumpur',
    floorplan_url: drawFloorplan(),
    scale_px_per_metre: 20,
    width_m: 35,
    height_m: 21,
    walls: [
      { x1: 4, y1: 3, x2: 30, y2: 3 },
      { x1: 30, y1: 3, x2: 30, y2: 16 },
      { x1: 30, y1: 16, x2: 4, y2: 16 },
      { x1: 4, y1: 16, x2: 4, y2: 3 },
    ],
    door: { x: 17, y: 16 },
    door_width_m: 2.4,
    registration: { x: 17, y: 18.5, rot: 0 },
    stage: { x: 12, y: 3.4, w: 10, h: 2.2, rot: 0 },
    floorplan_north_offset_deg: null,
    clear_m: 0.25,
  }

  const tables: TableObj[] = []
  let n = 0
  for (const y of [8, 12])
    for (const x of [8, 13, 18, 23]) {
      n++
      tables.push({
        id: `demo-t${n}`,
        layout_id: DEMO_LAYOUT_ID,
        shape: 'round',
        kind: 'seat',
        label: String(n),
        x,
        y,
        rot: 0,
        seats: 10,
        dia: 1.8,
      })
    }
  tables.push({
    id: 'demo-head',
    layout_id: DEMO_LAYOUT_ID,
    shape: 'banquet',
    kind: 'seat',
    label: '9',
    x: 17,
    y: 5.4,
    rot: 0,
    seats: 6,
    len: 4,
    wid: 1,
    ends: false,
  })
  tables.push({
    id: 'demo-buffet',
    layout_id: DEMO_LAYOUT_ID,
    shape: 'buffet',
    kind: 'service',
    label: 'Buffet — Desserts',
    x: 27.5,
    y: 10,
    rot: 90,
    len: 3,
    wid: 0.8,
  })

  const layout: VenueTableLayout = {
    id: DEMO_LAYOUT_ID,
    venue_id: DEMO_VENUE_ID,
    name: '300 pax banquet',
    capacity_total: 86,
  }

  const event: WeddingEvent = {
    id: DEMO_EVENT_ID,
    org_id: 'local-org',
    venue_id: DEMO_VENUE_ID,
    layout_id: DEMO_LAYOUT_ID,
    couple_names: 'Adam & Eve',
    event_date: '2026-09-12',
    starts_at: null,
    photo_mode: 'moderated_only',
    guest_token_secret: DEMO_SECRET,
    menu: [
      { id: 'demo-m1', name: 'Five Happiness Cold Platter', description: '五福拼盘' },
      {
        id: 'demo-m2',
        name: 'Double-boiled Chicken Soup',
        description: '炖鸡汤',
        photo: drawPhoto('#b45309', 'SOUP'),
      },
      { id: 'demo-m3', name: 'Steamed Grouper', description: '清蒸石斑 · light soy & scallions' },
      { id: 'demo-m4', name: 'Golden Fried Rice', description: '黄金炒饭' },
      { id: 'demo-m5', name: 'Chilled Longan & Sea Coconut', description: '龙眼海底椰' },
    ],
  }

  const guestRows: [string, string, string | null, number, Guest['side'], Guest['rsvp'], boolean][] = [
    ['demo-g1', 'Uncle Lim', '012-345 6789', 2, 'groom', 'yes', true],
    ['demo-g2', '陈美玲', '019-888 7777', 3, 'bride', 'yes', false],
    ['demo-g3', 'Jason Wong', null, 2, 'groom', null, false],
    ['demo-g4', 'Beth Chua', '017-111 2222', 3, 'bride', 'yes', false],
    ['demo-g5', 'David Tan', null, 5, 'groom', null, false],
    ['demo-g6', 'Gabe Ng', null, 4, 'both', null, false],
    ['demo-g7', 'Sarah Lee', null, 2, 'bride', 'yes', false],
    ['demo-g8', 'Kyle Teh', null, 5, 'both', null, false],
    ['demo-g9', 'Mary Ho', null, 1, 'both', 'no', false],
  ]
  const guests: Guest[] = []
  for (const [id, name, phone, pax, side, rsvp, vip] of guestRows) {
    guests.push({
      id,
      event_id: DEMO_EVENT_ID,
      name,
      phone,
      email: null,
      party_size: pax,
      side,
      group_tag: side === 'bride' ? 'Bride uni friends' : null,
      is_vip: vip,
      table_id: null, // unassigned on purpose — Auto-allocate is the demo beat
      qr_token: await signToken(DEMO_EVENT_ID, id, DEMO_SECRET),
      checked_in_at: null,
      locked: false,
      rsvp,
    })
  }

  const constraint: GuestConstraint = {
    id: 'demo-c1',
    event_id: DEMO_EVENT_ID,
    guest_a_id: 'demo-g1',
    guest_b_id: 'demo-g2',
    type: 'must_sit_together',
  }

  const now = new Date().toISOString()
  const photos: Photo[] = [
    {
      id: 'demo-p1',
      event_id: DEMO_EVENT_ID,
      guest_id: 'demo-g2',
      storage_path: drawPhoto('#e11d48', 'First dance ❤'),
      thumb_path: null,
      status: 'approved',
      ai_flag_reason: null,
      uploaded_at: now,
      approved_at: now,
      on_screen: false,
    },
    {
      id: 'demo-p2',
      event_id: DEMO_EVENT_ID,
      guest_id: 'demo-g4',
      storage_path: drawPhoto('#0ea5e9', 'Cheers from Table 2'),
      thumb_path: null,
      status: 'pending_human',
      ai_flag_reason: null,
      uploaded_at: now,
      approved_at: null,
      on_screen: false,
    },
  ]

  await repo.saveVenue(venue)
  await repo.saveLayout(layout, tables)
  await repo.saveEvent(event)
  await repo.saveGuests(guests)
  await repo.saveConstraint(constraint)
  for (const ph of photos) await repo.savePhoto(ph)

  return DEMO_EVENT_ID
}
