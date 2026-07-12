import { newTableId } from './layout-ops'
import { getRepo } from './repo'
import type { Photo } from './types'

/**
 * Client-side resize before anything leaves the phone — ballroom 4G cannot
 * carry 12MP originals from 200 phones. Max 2000px long edge, WebP.
 */
export async function resizeImage(file: File, maxEdge = 2000): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface ModerationVerdict {
  safe: boolean
  reason: string
}

/** AI pre-moderation via the server route (Gemini when configured). */
export async function moderateImage(dataUrl: string): Promise<ModerationVerdict> {
  try {
    const res = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    })
    if (!res.ok) throw new Error(`moderate ${res.status}`)
    return (await res.json()) as ModerationVerdict
  } catch (err) {
    // Moderation being down must not kill the feed — photos fall back to the
    // human queue instead of auto-approval.
    console.warn('AI moderation unavailable', err)
    return { safe: true, reason: 'ai-unavailable' }
  }
}

/**
 * Full upload pipeline: resize → AI verdict → persist with tiered status.
 *  safe   → pending_human (live feed now, ballroom screen after human ✓)
 *  unsafe → rejected (hidden from feed/screen; couple's album still has it)
 */
export async function uploadPhoto(
  eventId: string,
  guestId: string | null,
  file: File,
): Promise<Photo> {
  const dataUrl = await resizeImage(file)
  const verdict = await moderateImage(dataUrl)
  const photo: Photo = {
    id: newTableId(),
    event_id: eventId,
    guest_id: guestId,
    storage_path: dataUrl,
    thumb_path: null,
    status: verdict.safe ? 'pending_human' : 'rejected',
    ai_flag_reason: verdict.safe ? null : verdict.reason,
    uploaded_at: new Date().toISOString(),
    approved_at: null,
    on_screen: false,
  }
  await getRepo().savePhoto(photo)
  return photo
}

/** Live feed = anything the AI passed (pending_human) or a human approved. */
export const LIVE_FEED_STATUSES = ['pending_human', 'approved'] as const
