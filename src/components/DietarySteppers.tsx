'use client'

import { DIETARY_CATEGORIES, type DietaryCountKey } from '@/lib/kitchen'
import type { Dietary } from '@/lib/types'

/** Stepper rows for the fixed dietary categories + one allergy line.
 *  Counts are clamped to [0, max] (max = party size). */
export function DietarySteppers({
  value,
  max,
  onChange,
  tone,
}: {
  value: Dietary
  max: number
  onChange: (d: Dietary) => void
  tone: 'light' | 'dark'
}) {
  const t =
    tone === 'dark'
      ? {
          row: 'text-slate-300',
          btn: 'border-slate-600 bg-slate-800 text-slate-200',
          num: 'text-slate-100',
          input:
            'border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500',
        }
      : {
          row: 'text-slate-600',
          btn: 'border-slate-300 bg-white text-slate-700',
          num: 'text-slate-900',
          input: 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
        }

  const set = (key: DietaryCountKey, n: number) =>
    onChange({ ...value, [key]: Math.max(0, Math.min(max, n)) })

  return (
    <div className="space-y-2">
      {DIETARY_CATEGORIES.map((c) => {
        const n = value[c.key] ?? 0
        return (
          <div key={c.key} className={`flex items-center justify-between text-sm ${t.row}`}>
            <span>
              {c.emoji} {c.label}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Fewer ${c.label}`}
                onClick={() => set(c.key, n - 1)}
                className={`h-7 w-7 rounded-full border text-base leading-none ${t.btn}`}
              >
                −
              </button>
              <span className={`w-5 text-center font-semibold ${t.num}`}>{n}</span>
              <button
                type="button"
                aria-label={`More ${c.label}`}
                onClick={() => set(c.key, n + 1)}
                className={`h-7 w-7 rounded-full border text-base leading-none ${t.btn}`}
              >
                ＋
              </button>
            </span>
          </div>
        )
      })}
      <input
        value={value.allergy ?? ''}
        onChange={(e) => onChange({ ...value, allergy: e.target.value })}
        placeholder="Allergies? e.g. peanut — for the kitchen"
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${t.input}`}
      />
    </div>
  )
}
