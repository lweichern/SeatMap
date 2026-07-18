/**
 * The origin to bake into QR codes and invite links. "localhost" is
 * meaningless on a guest's phone, so when the app is being browsed via
 * localhost we ask the server for its LAN address instead.
 */
export async function getShareOrigin(): Promise<string> {
  const here = window.location
  if (here.hostname !== 'localhost' && here.hostname !== '127.0.0.1') {
    return here.origin
  }
  try {
    const res = await fetch('/api/host')
    const { origin } = (await res.json()) as { origin: string | null }
    return origin ?? here.origin
  } catch {
    return here.origin
  }
}
