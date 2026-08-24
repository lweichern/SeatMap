import React from 'react';
import { C } from '../theme';

// Deterministic QR-ish matrix (fixed seed → identical every render).
const SIZE = 25;
function buildMatrix(): boolean[][] {
  let seed = 987654321;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const m: boolean[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => rnd() > 0.52),
  );
  const finder = (r0: number, c0: number) => {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const r = r0 + i;
        const c = c0 + j;
        if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
        const inBox = i >= 0 && i <= 6 && j >= 0 && j <= 6;
        if (!inBox) {
          m[r][c] = false; // quiet border
          continue;
        }
        const ring = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[r][c] = ring || core;
      }
    }
  };
  finder(0, 0);
  finder(0, SIZE - 7);
  finder(SIZE - 7, 0);
  return m;
}

const MATRIX = buildMatrix();

export const QRCode: React.FC<{ size: number }> = ({ size }) => {
  const cell = size / SIZE;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!MATRIX[r][c]) continue;
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={c * cell}
          y={r * cell}
          width={cell}
          height={cell}
          rx={cell * 0.18}
          fill={C.ink}
        />,
      );
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect x={0} y={0} width={size} height={size} rx={size * 0.06} fill="#fff" />
      {rects}
    </svg>
  );
};
