import React from 'react';
import { interpolate } from 'remotion';
import { C, serif, sans, tableNumGradient } from '../theme';

// ---- fixed demo venue geometry (metres), mirroring the real Hall2D ----
const W = 40;
const H = 25;
const PAD = 2.5;
// Entrance sits in the vertical aisle beside table 12's column, so the
// walking route can follow the aisles (like the app's A* solver) instead
// of cutting diagonally across tables.
const AISLE_X = 16.2; // between column x=12.8 and column x=19.6
const DOOR = { x: AISLE_X, y: 25 };
const DOOR_W = 3;
const STAGE = { x: 14, y: 1.5, w: 12, h: 3 };
const REG = { x: 28, y: 22 };

type Tbl = { x: number; y: number; label: string; guest?: boolean };
const TABLES: Tbl[] = (() => {
  const cols = [6, 12.8, 19.6, 26.4, 33.2];
  const rows = [6.5, 11.5, 16.5, 21.5];
  const out: Tbl[] = [];
  let n = 1;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      out.push({ x: cols[c], y: rows[r], label: String(n) });
      n++;
    }
  }
  // highlight table "12" (row 2, col 2 → nicely central, a few rows from stage)
  const g = out.find((t) => t.label === '12')!;
  g.guest = true;
  return out;
})();

const GUEST = TABLES.find((t) => t.guest)!;
// Aisle-following route: up the vertical aisle to the table's row, then
// straight in along the gap between tables to table 12's edge.
const ROUTE = [
  DOOR,
  { x: AISLE_X, y: GUEST.y },
  { x: GUEST.x + 0.9, y: GUEST.y },
];

function pointOnPath(pts: { x: number; y: number }[], t: number) {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(d);
    total += d;
  }
  let dist = t * total;
  for (let i = 1; i < pts.length; i++) {
    if (dist <= segs[i - 1] || i === pts.length - 1) {
      const f = segs[i - 1] ? dist / segs[i - 1] : 0;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
      };
    }
    dist -= segs[i - 1];
  }
  return pts[pts.length - 1];
}

// ---- the dark ballroom map (faithful to Hall2D.tsx) ----
const Hall: React.FC<{ routeT: number; pulse: number }> = ({ routeT, pulse }) => {
  const lead = pointOnPath(ROUTE, routeT);
  const shownRoute = ROUTE; // dotted route fades in via opacity
  return (
    <svg viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect x={-PAD} y={-PAD} width={W + PAD * 2} height={H + PAD * 2} fill={C.hallBg} />
      <rect x={0} y={0} width={W} height={H} rx={0.5} fill={C.hallFloor} />

      {/* walls with a doorway gap on the bottom edge */}
      {(() => {
        const s = { stroke: C.hallWall, strokeWidth: 0.35, strokeLinecap: 'round' as const };
        const gapA = DOOR.x - DOOR_W / 2;
        const gapB = DOOR.x + DOOR_W / 2;
        return (
          <g>
            <line x1={0} y1={0} x2={W} y2={0} {...s} />
            <line x1={W} y1={0} x2={W} y2={H} {...s} />
            <line x1={0} y1={0} x2={0} y2={H} {...s} />
            <line x1={0} y1={H} x2={gapA} y2={H} {...s} />
            <line x1={gapB} y1={H} x2={W} y2={H} {...s} />
          </g>
        );
      })()}

      {/* stage */}
      <rect x={STAGE.x} y={STAGE.y} width={STAGE.w} height={STAGE.h} fill={C.hallStage} opacity={0.85} rx={0.3} />
      <text
        x={STAGE.x + STAGE.w / 2}
        y={STAGE.y + STAGE.h / 2}
        fill={C.hallStageText}
        fontSize={1.2}
        textAnchor="middle"
        dominantBaseline="central"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        STAGE
      </text>

      {/* dashed walking route */}
      <polyline
        points={shownRoute.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={C.hallRoute}
        strokeWidth={0.28}
        strokeDasharray="0.7 0.4"
        strokeLinecap="round"
        opacity={interpolate(routeT, [0, 0.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
      {/* travelling glow dot */}
      {routeT > 0.02 && routeT < 0.999 && (
        <circle cx={lead.x} cy={lead.y} r={0.55} fill={C.hallGuest} opacity={0.95} />
      )}

      {/* tables */}
      {TABLES.map((t) => {
        const isG = !!t.guest;
        return (
          <g key={t.label} transform={`translate(${t.x} ${t.y})`}>
            {isG && (
              <circle r={0.9 + 0.5 + pulse * 0.4} fill="none" stroke={C.hallGuest} strokeWidth={0.2} opacity={0.3 + pulse * 0.6} />
            )}
            <circle r={0.9} fill={isG ? C.hallGuest : C.hallTable} />
            <text
              fill={isG ? C.hallGuestText : C.hallTableText}
              fontSize={isG ? 1.1 : 0.7}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="sans-serif"
            >
              {t.label}
            </text>
          </g>
        );
      })}

      {/* entrance */}
      <circle cx={DOOR.x} cy={DOOR.y} r={0.45} fill={C.hallDoor} />
      <text x={DOOR.x} y={DOOR.y + 1.3} fill={C.hallDoorText} fontSize={0.75} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
        ENTRANCE
      </text>

      {/* registration desk */}
      <rect x={REG.x - 0.9} y={REG.y - 0.35} width={1.8} height={0.7} rx={0.15} fill={C.hallReg} />
      <text x={REG.x} y={REG.y + 1.35} fill={C.hallRegText} fontSize={0.7} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
        REGISTRATION
      </text>
    </svg>
  );
};

// stagger helper matching the app's gv-rise delays
const rise = (frame: number, delayFrames: number) => {
  const p = interpolate(frame, [delayFrames, delayFrames + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity: p, transform: `translateY(${(1 - p) * 16}px)` };
};

/**
 * Faithful port of the /g/{token} guest page (map tab).
 * `frame` is local to the reveal so elements rise in the app's order.
 */
export const AppGuestScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const routeT = interpolate(frame, [80, 190], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(130% 55% at 50% -10%, #f6ead0 0%, rgba(246,234,208,0) 60%), radial-gradient(120% 45% at 50% 112%, #f1e3c4 0%, rgba(241,227,196,0) 55%), #faf5ea',
        color: C.ink,
        fontFamily: sans,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 34,
        overflow: 'hidden',
      }}
    >
      {/* eyebrow */}
      <div style={{ ...rise(frame, 0), fontSize: 17, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, color: C.gold }}>
        The wedding celebration of
      </div>
      {/* couple names */}
      <div style={{ ...rise(frame, 3), fontFamily: serif, fontStyle: 'italic', fontWeight: 600, fontSize: 62, lineHeight: 1.05, marginTop: 6, color: C.ink }}>
        Wei &amp; Hui
      </div>
      {/* flourish */}
      <svg width="176" height="13" viewBox="0 0 132 10" style={{ marginTop: 12, ...rise(frame, 6) }}>
        <line x1="0" y1="5" x2="54" y2="5" stroke={C.goldSoft} strokeWidth="1" />
        <rect x="62" y="1" width="8" height="8" transform="rotate(45 66 5)" fill="none" stroke={C.gold} strokeWidth="1" />
        <line x1="78" y1="5" x2="132" y2="5" stroke={C.goldSoft} strokeWidth="1" />
      </svg>
      {/* welcome */}
      <div style={{ ...rise(frame, 9), fontSize: 21, color: C.inkSoft, marginTop: 16 }}>
        Welcome, <span style={{ fontWeight: 700, color: C.ink }}>Auntie Lim</span>
      </div>
      {/* your table */}
      <div style={{ ...rise(frame, 13), fontSize: 15, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, color: C.inkFaint, marginTop: 18 }}>
        Your table
      </div>
      <div
        style={{
          ...rise(frame, 13),
          fontFamily: serif,
          fontWeight: 600,
          fontSize: 150,
          lineHeight: 0.9,
          background: tableNumGradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(0 10px 24px rgba(160,124,42,.28))',
        }}
      >
        {GUEST.label}
      </div>
      <div style={{ ...rise(frame, 13), fontSize: 20, color: C.inkSoft, marginTop: 6 }}>
        A few rows from the stage, on the left
      </div>

      {/* tab bar */}
      <div
        style={{
          ...rise(frame, 17),
          display: 'flex',
          gap: 36,
          marginTop: 26,
          borderBottom: `1px solid ${C.line}`,
          paddingBottom: 2,
          width: '86%',
          justifyContent: 'center',
        }}
      >
        {['Find my table', 'Menu', 'Photos'].map((t, i) => (
          <div key={t} style={{ position: 'relative', paddingBottom: 12 }}>
            <span style={{ fontSize: 15, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, color: i === 0 ? C.ink : C.inkFaint }}>
              {t}
            </span>
            {i === 0 && (
              <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -1, height: 3, width: 40, borderRadius: 3, background: C.gold }} />
            )}
          </div>
        ))}
      </div>

      {/* ballroom map card */}
      <div style={{ ...rise(frame, 20), width: '90%', marginTop: 22 }}>
        <div style={{ borderRadius: 34, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.hallBg, boxShadow: '0 24px 60px -24px rgba(90,66,20,.45)' }}>
          {/* card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.line}`, background: C.card, padding: '12px 18px' }}>
            <span style={{ fontSize: 13, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, color: C.inkSoft }}>Ballroom map</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 15, color: C.inkFaint }}>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: C.hallGuest, boxShadow: `0 0 8px ${C.hallGuest}` }} />
                Your table
              </span>
              <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 999, border: `1px solid ${C.line}`, fontSize: 14, fontWeight: 700 }}>
                <span style={{ padding: '5px 14px', color: C.inkFaint }}>3D</span>
                <span style={{ padding: '5px 14px', background: C.gold, color: C.card }}>2D</span>
              </div>
            </div>
          </div>
          {/* map (height matches the 45:30 viewBox so there's no dead space) */}
          <div style={{ height: 346 }}>
            <Hall routeT={routeT} pulse={pulse} />
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 15, color: C.inkFaint, marginTop: 14 }}>
          The glowing dots trace your walk from the entrance to your table.
        </div>
      </div>
    </div>
  );
};
