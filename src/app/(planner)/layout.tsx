import Link from 'next/link'

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-6 border-b border-slate-200 bg-white px-5 py-3">
        <Link href="/venues" className="text-lg font-bold tracking-tight text-slate-900">
          SeatMap
        </Link>
        <nav className="flex gap-4 text-sm text-slate-600">
          <Link href="/venues" className="hover:text-slate-900">
            Venues
          </Link>
        </nav>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}
