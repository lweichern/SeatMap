import { loadFont as loadSerif } from '@remotion/google-fonts/CormorantGaramond';
import { loadFont as loadSans } from '@remotion/google-fonts/Karla';

// Exact fonts from the app's guest layout: Cormorant Garamond (display) + Karla (body).
export const serif = loadSerif().fontFamily;
export const sans = loadSans().fontFamily;

// Palette lifted verbatim from `.gv-shell` in src/app/(guest)/layout.tsx.
export const C = {
  cream: '#faf5ea', // --ivory
  creamDeep: '#f1e3c4',
  card: '#fffdf6', // --card
  ink: '#392e1e', // --ink
  inkSoft: '#6f6046', // --ink-soft
  inkFaint: '#a08c66', // --ink-faint
  gold: '#a8842c', // --gold
  goldLo: '#7d5f1a', // --gold-deep
  goldHi: '#d3b465',
  goldSoft: '#d9c48e', // --gold-soft
  line: '#e7dcbf', // --line
  // ballroom map (Hall2D)
  hallBg: '#14100a',
  hallFloor: '#241b10',
  hallWall: '#8a7350',
  hallStage: '#5b2144',
  hallStageText: '#e8c6d8',
  hallTable: '#4a3b28',
  hallTableText: '#ead9b6',
  hallGuest: '#f6c14d',
  hallGuestText: '#4a3106',
  hallRoute: '#e0b64e',
  hallDoor: '#10b981',
  hallDoorText: '#6ee7b7',
  hallReg: '#0ea5e9',
  hallRegText: '#7dd3fc',
} as const;

// The exact gv-tablenum gradient.
export const tableNumGradient = 'linear-gradient(165deg,#caa54b 5%,#8a6a1f 48%,#d3b465 90%)';
export const goldGradient = `linear-gradient(160deg, ${C.goldHi}, ${C.goldLo})`;
