'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { demoExists, loadDemoEvent } from '@/lib/demo'

/**
 * One-click pitch world. First click seeds "Adam & Eve at the Grand
 * Ballroom"; every later click RESETS it to pristine (wipes walk-ins,
 * check-ins and uploads from the previous run).
 */
export function DemoButton() {
  const router = useRouter()
  const [exists, setExists] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    demoExists().then(setExists)
  }, [])

  async function run() {
    if (exists && !confirm('Reset the demo event to its original state? Changes made during the last demo will be discarded.'))
      return
    setBusy(true)
    try {
      await loadDemoEvent()
      router.push('/events')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      title="Seed a complete example wedding — venue, tables, guests, menu, photos"
      className="whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50"
    >
      {busy ? 'Loading demo…' : exists ? '↺ Reset demo event' : '✨ Load demo event'}
    </button>
  )
}
