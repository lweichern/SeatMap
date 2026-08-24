import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
} from 'remotion';
import { C, serif, sans, goldGradient } from './theme';
import { HallMap } from './components/HallMap';
import { QRCode } from './components/QRCode';
import { AppGuestScreen } from './components/AppGuestScreen';

const FPS = 30;

// ---------- shared bits ----------
const Bg: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 90% at 50% 12%, ${C.card} 0%, ${C.cream} 55%, ${C.creamDeep} 100%)`,
    }}
  >
    {children}
  </AbsoluteFill>
);

const rise = (frame: number, delay = 0, dur = 16) => ({
  opacity: interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }),
  transform: `translateY(${interpolate(frame, [delay, delay + dur], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })}px)`,
});

const Eyebrow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      fontFamily: sans,
      fontSize: 34,
      letterSpacing: 8,
      fontWeight: 600,
      color: C.gold,
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </div>
);

const Headline: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 104,
  style,
}) => (
  <div
    style={{
      fontFamily: serif,
      fontStyle: 'italic',
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.05,
      color: C.ink,
      textAlign: 'center',
      padding: '0 70px',
      ...style,
    }}
  >
    {children}
  </div>
);

// ---------- Scene 1: the hall + value line ----------
const SceneHall: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 70], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <Bg>
      <div style={{ position: 'absolute', top: 190, left: 0, right: 0, ...rise(frame, 6) }}>
        <Eyebrow style={{ textAlign: 'center' }}>Your wedding dinner</Eyebrow>
      </div>
      <div style={{ position: 'absolute', top: 290, width: 620, height: 900, left: 230 }}>
        <HallMap appear={appear} labels={false} />
      </div>
      <div style={{ position: 'absolute', bottom: 300, left: 0, right: 0, ...rise(frame, 30) }}>
        <Headline size={112}>40 tables.</Headline>
        <Headline size={112} style={{ color: C.gold }}>
          350 guests.
        </Headline>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: sans,
          fontSize: 40,
          fontWeight: 600,
          color: C.inkSoft,
          padding: '0 90px',
          lineHeight: 1.35,
          ...rise(frame, 70),
        }}
      >
        The wedding app that walks every guest to their seat.
      </div>
    </Bg>
  );
};

// ---------- Scene 2: the problem ----------
const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bg>
      {/* the hall recedes to a faint backdrop — no highlight, no markers */}
      <div style={{ position: 'absolute', top: 250, width: 560, height: 780, left: 260, opacity: 0.14 }}>
        <HallMap appear={1} highlight={false} labels={false} />
      </div>
      {/* one calm, legible line carries the whole idea */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ marginTop: 120, ...rise(frame, 6) }}>
          <Eyebrow style={{ textAlign: 'center', marginBottom: 40 }}>350 guests, all wondering</Eyebrow>
          <Headline size={104}>“Which table</Headline>
          <Headline size={104}>am I at?”</Headline>
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ---------- Scene 3: scan -> the REAL app guest screen ----------
const Phone: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: 620,
      height: 1290,
      borderRadius: 92,
      background: '#141109',
      padding: 22,
      boxShadow: '0 60px 120px -40px rgba(70,52,10,0.55)',
    }}
  >
    <div style={{ width: '100%', height: '100%', borderRadius: 70, background: C.card, overflow: 'hidden', position: 'relative' }}>
      {children}
    </div>
  </div>
);

const Loader: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.cream, gap: 20 }}>
    <svg width="176" height="13" viewBox="0 0 132 10">
      <line x1="0" y1="5" x2="54" y2="5" stroke={C.goldSoft} strokeWidth="1" />
      <rect x="62" y="1" width="8" height="8" transform="rotate(45 66 5)" fill="none" stroke={C.gold} strokeWidth="1" />
      <line x1="78" y1="5" x2="132" y2="5" stroke={C.goldSoft} strokeWidth="1" />
    </svg>
    <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 40, color: C.inkSoft }}>Finding your seat…</div>
  </div>
);

const SceneScan: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: { damping: 14 } });

  const qrOut = interpolate(frame, [92, 108], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanY = interpolate(frame, [30, 94], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanVisible = frame > 24 && frame < 100;
  const flash = interpolate(frame, [96, 106, 120], [0, 0.85, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const loaderOpacity = interpolate(frame, [106, 120, 142, 154], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const appIn = interpolate(frame, [148, 166], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Bg>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ transform: `translateY(${interpolate(pop, [0, 1], [80, 0])}px)`, opacity: pop }}>
          <Phone>
            {/* Phase A — scanning the QR on the table card */}
            <div style={{ position: 'absolute', inset: 0, background: C.cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, opacity: qrOut }}>
              <div style={{ fontFamily: sans, fontSize: 30, color: C.inkSoft, fontWeight: 600 }}>Scan the QR on your table card</div>
              <div style={{ position: 'relative' }}>
                <QRCode size={380} />
                {scanVisible && (
                  <div style={{ position: 'absolute', left: -8, right: -8, top: 380 * scanY, height: 6, borderRadius: 3, background: C.gold, boxShadow: `0 0 30px 8px ${C.gold}` }} />
                )}
              </div>
            </div>

            {/* lock-on flash */}
            <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />

            {/* Phase B — app loading state (verbatim copy) */}
            {frame > 104 && frame < 158 && (
              <div style={{ position: 'absolute', inset: 0, opacity: loaderOpacity }}>
                <Loader />
              </div>
            )}

            {/* Phase C — the real /g/{token} guest screen */}
            {frame >= 146 && (
              <div style={{ position: 'absolute', inset: 0, opacity: appIn }}>
                <AppGuestScreen frame={frame - 150} />
              </div>
            )}
          </Phone>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          bottom: 70,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: sans,
          fontSize: 40,
          fontWeight: 700,
          color: C.ink,
          opacity: interpolate(frame, [345, 368], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        Found it. In 5 seconds.
      </div>
    </Bg>
  );
};

// ---------- Scene 4: payoff ----------
const ScenePayoff: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bg>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={rise(frame, 2)}>
          <Eyebrow style={{ textAlign: 'center', marginBottom: 40 }}>No queue at the door</Eyebrow>
        </div>
        <div style={rise(frame, 12)}>
          <Headline size={100}>Every guest,</Headline>
          <Headline size={100} style={{ color: C.gold }}>
            walked to their seat.
          </Headline>
        </div>
        <div style={{ marginTop: 60, fontFamily: sans, fontSize: 34, color: C.inkSoft, ...rise(frame, 24) }}>
          Works even with zero wifi bars.
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ---------- Scene 5: CTA ----------
const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = spring({ frame: frame - 6, fps: FPS, config: { damping: 13 } });
  return (
    <Bg>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={rise(frame, 2)}>
          <Eyebrow style={{ textAlign: 'center' }}>Digital invite · RSVP · seating</Eyebrow>
        </div>
        <div style={{ marginTop: 40, ...rise(frame, 10) }}>
          <Headline size={110}>Getting married</Headline>
          <Headline size={110}>in KL?</Headline>
        </div>
        <div
          style={{
            marginTop: 80,
            transform: `scale(${pop})`,
            opacity: pop,
            background: goldGradient,
            color: '#fffdf6',
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 52,
            padding: '34px 74px',
            borderRadius: 90,
            letterSpacing: 1,
            boxShadow: '0 40px 70px -30px rgba(125,95,26,0.7)',
          }}
        >
          DM “SEAT” to book
        </div>
        <div style={{ marginTop: 70, fontFamily: serif, fontStyle: 'italic', fontSize: 60, fontWeight: 600, letterSpacing: 6, color: C.ink, ...rise(frame, 30) }}>
          SeatMap
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ---------- master timeline ----------
export const Promo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={135}>
        <SceneHall />
      </Sequence>
      <Sequence from={135} durationInFrames={120}>
        <SceneProblem />
      </Sequence>
      <Sequence from={255} durationInFrames={415}>
        <SceneScan />
      </Sequence>
      <Sequence from={670} durationInFrames={110}>
        <ScenePayoff />
      </Sequence>
      <Sequence from={780} durationInFrames={120}>
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
