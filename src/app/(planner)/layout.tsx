import Link from 'next/link'
import { NavLinks } from '@/components/NavLinks'

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-7 border-b border-slate-200 bg-white px-5 py-3">
        <Link
          href="/venues"
          className="text-xl font-semibold italic tracking-tight text-slate-900"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          SeatMap<span className="not-italic text-[#a8842c]">.</span>
        </Link>
        <NavLinks />
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}
