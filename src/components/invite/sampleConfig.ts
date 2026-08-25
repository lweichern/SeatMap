import type { InviteConfig } from '@/lib/types'

/**
 * Curated sample photo sets (bundled under /public/samples) so planners can
 * preview each template fully dressed before uploading their own shoot.
 * PREVIEW-ONLY — merged over the draft for display, never saved.
 */
const S = (n: string) => `/samples/${n}.jpg`

export function samplePhotos(
  template: InviteConfig['template'],
): Pick<InviteConfig, 'photos' | 'gallery'> {
  switch (template) {
    case 'editorial':
      return {
        photos: { hero: S('sparklers'), candid1: S('toast'), candid2: S('bridge') },
        gallery: [S('studio'), S('bridge'), S('mamak')],
      }
    case 'polaroid':
      return {
        photos: { hero: S('piggyback'), candid1: S('garden'), candid2: S('sparklers') },
        gallery: [S('mamak'), S('rooftop'), S('toast')],
      }
    default:
      return {
        photos: {
          hero: S('studio-tall'),
          editorial: S('rooftop'),
          candid1: S('garden'),
          candid2: S('bridge'),
        },
      }
  }
}
