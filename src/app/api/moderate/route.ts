import { NextResponse } from 'next/server'

/**
 * AI photo pre-moderation. Uses Gemini 2.5 Flash when GEMINI_API_KEY is set;
 * without a key it fails open to { safe: true } — the human moderation queue
 * still gates the ballroom screen, so the worst case is an unsavoury photo in
 * the phone-only live feed, never on the projector.
 */
export async function POST(req: Request) {
  let image: string
  try {
    const body = (await req.json()) as { image?: string }
    if (!body.image?.startsWith('data:image/')) {
      return NextResponse.json({ error: 'image data URL required' }, { status: 400 })
    }
    image = body.image
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ safe: true, reason: 'ai-moderation-disabled' })
  }

  try {
    const [meta, base64] = image.split(',')
    const mimeType = meta.slice(5, meta.indexOf(';'))
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'You are moderating guest photo uploads at a wedding for display on a public slideshow. ' +
                    'Flag nudity, violence, offensive gestures, and obviously non-wedding junk (screenshots, memes, blank/black frames). ' +
                    'Normal candid photos of people, food, decor and the venue are safe.',
                },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: {
              type: 'OBJECT',
              properties: {
                safe: { type: 'BOOLEAN' },
                reason: { type: 'STRING' },
              },
              required: ['safe', 'reason'],
            },
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`gemini ${res.status}`)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    const verdict = JSON.parse(text) as { safe: boolean; reason: string }
    return NextResponse.json(verdict)
  } catch (err) {
    console.error('moderation error, failing open to human queue', err)
    return NextResponse.json({ safe: true, reason: 'ai-error' })
  }
}
