import type { InviteConfig } from '@/lib/types'

/**
 * Curated sample photo sets (bundled under /public/samples) so planners can
 * preview each template fully dressed before uploading their own shoot.
 * PREVIEW-ONLY — merged over the draft for display, never saved.
 */
const S = (n: string) => `/samples/${n}.jpg`

/** Present locally only — the bundled track is gitignored (licensing is the
 *  planner's call); a missing file degrades to a silent, paused disc. */
const SAMPLE_MUSIC = '/samples/music.mp3'

export function samplePhotos(
  template: InviteConfig['template'],
): Pick<InviteConfig, 'photos' | 'gallery' | 'music'> {
  switch (template) {
    case 'editorial':
      return {
        music: SAMPLE_MUSIC,
        photos: { hero: S('sparklers'), candid1: S('toast'), candid2: S('bridge') },
        gallery: [S('studio'), S('bridge'), S('mamak')],
      }
    case 'polaroid':
      return {
        music: SAMPLE_MUSIC,
        photos: { hero: S('piggyback'), candid1: S('garden'), candid2: S('sparklers') },
        gallery: [S('mamak'), S('rooftop'), S('toast')],
      }
    default:
      return {
        music: SAMPLE_MUSIC,
        photos: {
          hero: S('studio-tall'),
          editorial: S('rooftop'),
          candid1: S('garden'),
          candid2: S('bridge'),
        },
      }
  }
}
