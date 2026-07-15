'use client'

import Link from 'next/link'
import { use, useEffect, useRef, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { newTableId } from '@/lib/layout-ops'
import { resizeImage } from '@/lib/photos'
import type { MenuItem, WeddingEvent } from '@/lib/types'

/** Square dish-photo control: click to upload, ✕ to clear. */
function CoursePhoto({
  photo,
  onChange,
}: {
  photo: string | null
  onChange: (photo: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative shrink-0">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          // resized hard: 8 dish photos must not blow the storage budget
          if (f) onChange(await resizeImage(f, 800))
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        title={photo ? 'Replace photo' : 'Add a dish photo'}
        className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xl text-slate-300 hover:border-slate-300"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Dish" className="h-full w-full object-cover" />
        ) : (
          '🍽'
        )}
      </button>
      {photo && (
        <button
          onClick={() => onChange(null)}
          title="Remove photo"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-red-500 shadow-sm hover:bg-red-50"
        >
          ✕
        </button>
      )}
    </div>
  )
}

const COURSE_PRESETS = [
  'Cold Platter',
  'Soup',
  'Roast Chicken',
  'Steamed Fish',
  'Prawns',
  'Braised Mushroom & Vegetables',
  'Fried Rice',
  'Dessert',
]

/**
 * The dinner menu, in serving order. Guests see this on their phone page —
 * the answer to "what course is this and how many are left".
 */
export default function MenuPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [saveState, setSaveState] = useState<'clean' | 'saving' | 'saved'>('clean')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getRepo().getEvent(eventId).then(setEvent)
  }, [eventId])

  function commit(next: WeddingEvent) {
    setEvent(next)
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await getRepo().saveEvent(next)
      setSaveState('saved')
    }, 600)
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-sm text-slate-400">Loading…</div>
    )
  }

  const menu = event.menu ?? []

  const patch = (id: string, p: Partial<MenuItem>) =>
    commit({ ...event, menu: menu.map((m) => (m.id === id ? { ...m, ...p } : m)) })

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= menu.length) return
    const next = [...menu]
    ;[next[i], next[j]] = [next[j], next[i]]
    commit({ ...event, menu: next })
  }

  const addCourse = (name = '') =>
    commit({
      ...event,
      menu: [...menu, { id: newTableId(), name, description: '' }],
    })

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/events" className="text-sm text-slate-400 hover:text-slate-700">
          ← Events
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          Dinner menu — {event.couple_names}
        </h1>
        <span className="ml-auto text-xs text-slate-400">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved ✓'}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Courses in serving order — guests see this on their phone under the
        “Menu” tab.
      </p>

      <ol className="mt-6 space-y-2">
        {menu.map((m, i) => (
          <li
            key={m.id}
            className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {i + 1}
            </span>
            <CoursePhoto
              photo={m.photo ?? null}
              onChange={(photo) => patch(m.id, { photo })}
            />
            <div className="min-w-0 flex-1">
              <input
                value={m.name}
                onChange={(e) => patch(m.id, { name: e.target.value })}
                placeholder="Course name, e.g. Steamed Fish"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-medium"
              />
              <input
                value={m.description}
                onChange={(e) => patch(m.id, { description: e.target.value })}
                placeholder="Optional detail, e.g. 清蒸石斑 · with light soy & scallions"
                className="mt-1.5 w-full rounded border border-slate-100 px-2 py-1 text-xs text-slate-600"
              />
            </div>
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded border border-slate-200 px-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                title="Serve earlier"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === menu.length - 1}
                className="rounded border border-slate-200 px-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                title="Serve later"
              >
                ↓
              </button>
              <button
                onClick={() => commit({ ...event, menu: menu.filter((x) => x.id !== m.id) })}
                className="rounded border border-red-100 px-1.5 text-xs text-red-500 hover:bg-red-50"
                title="Remove course"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => addCourse()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Add course
        </button>
        {menu.length === 0 && (
          <button
            onClick={() =>
              commit({
                ...event,
                menu: COURSE_PRESETS.map((name) => ({
                  id: newTableId(),
                  name,
                  description: '',
                })),
              })
            }
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Start from an 8-course banquet
          </button>
        )}
      </div>

      {menu.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No courses yet — while the menu is empty, guests don&apos;t see a Menu
          tab at all.
        </p>
      )}
    </div>
  )
}
