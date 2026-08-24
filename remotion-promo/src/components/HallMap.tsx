import React from 'react';
import { interpolate } from 'remotion';
import { C } from '../theme';

// A 5x8 grid of round banquet tables in a hall, entrance at bottom-centre.
// viewBox space is 300 x 480 so it drops cleanly into a phone screen or a page.
const COLS = 5;
const ROWS = 8;
const LEFT = 42;
const TOP = 54; // leaves clear air below the stage strip
const COL_GAP = 54;
const ROW_GAP = 46;

export const tableXY = (col: number, row: number) => ({
  x: LEFT + col * COL_GAP,
  y: TOP + row * ROW_GAP,
});

// Highlighted "your" table — matches the "Table 12" label used in the script.
export const HL_COL = 1;
export const HL_ROW = 2;
export const HL_NUMBER = HL_ROW * COLS + HL_COL + 1; // 12

const ENTRANCE = { x: 150, y: 470 };

export const HallMap: React.FC<{
  appear?: number; // 0..1 stagger-in of tables
  pathProgress?: number; // 0..1 draws the route
  glow?: number; // 0..1 highlight-table intensity (pulse)
  dim?: boolean; // fade non-highlight tables when routing
  labels?: boolean; // show STAGE / ENTRANCE text
  highlight?: boolean; // gild + mark the guest table (off for the "problem" scene)
}> = ({ appear = 1, pathProgress = 0, glow = 0, dim = false, labels = true, highlight = true }) => {
  const hl = tableXY(HL_COL, HL_ROW);
  const tables: React.ReactNode[] = [];
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = tableXY(c, r);
      const isHL = highlight && c === HL_COL && r === HL_ROW;
      // stagger appearance diagonally
      const t = idx / (ROWS * COLS);
      const a = interpolate(appear, [t * 0.6, t * 0.6 + 0.4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const baseOpacity = isHL ? 1 : dim ? 0.28 : 0.9;
      tables.push(
        <circle
          key={`${r}-${c}`}
          cx={x}
          cy={y}
          r={14 * a}
          fill={isHL ? C.gold : C.card}
          stroke={isHL ? C.goldLo : C.line}
          strokeWidth={isHL ? 2 : 1.5}
          opacity={a * baseOpacity}
        />,
      );
      idx++;
    }
  }

  // Route: entrance -> up the centre aisle -> across to the highlighted table.
  const d = `M ${ENTRANCE.x} ${ENTRANCE.y} L ${ENTRANCE.x} ${hl.y + 6} L ${hl.x} ${hl.y}`;

  return (
    <svg viewBox="0 0 300 480" style={{ width: '100%', height: '100%' }}>
      {/* faint stage strip at top */}
      <rect x={90} y={6} width={120} height={14} rx={6} fill={C.creamDeep} />
      {labels && (
        <text x={150} y={13} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={C.inkFaint} fontFamily="sans-serif">
          STAGE
        </text>
      )}

      {tables}

      {/* the walking route */}
      {pathProgress > 0 && (
        <path
          d={d}
          fill="none"
          stroke={C.gold}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - pathProgress}
          opacity={0.95}
        />
      )}

      {/* glow ring on the highlighted table */}
      {glow > 0 && (
        <circle
          cx={hl.x}
          cy={hl.y}
          r={14 + glow * 12}
          fill="none"
          stroke={C.gold}
          strokeWidth={3}
          opacity={0.5 * (1 - glow)}
        />
      )}

      {/* entrance marker (only in the labelled/detail view) */}
      {labels && (
        <>
          <circle cx={ENTRANCE.x} cy={ENTRANCE.y} r={5} fill={C.inkSoft} />
          <text
            x={ENTRANCE.x}
            y={ENTRANCE.y + 16}
            textAnchor="middle"
            fontSize={9}
            fill={C.inkFaint}
            fontFamily="sans-serif"
          >
            ENTRANCE
          </text>
        </>
      )}
    </svg>
  );
};
