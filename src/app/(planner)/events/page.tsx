"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { newTableId } from "@/lib/layout-ops";
import type { Venue, VenueTableLayout, WeddingEvent } from "@/lib/types";
import { DemoButton } from "@/components/DemoButton";

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [layouts, setLayouts] = useState<VenueTableLayout[]>([]);
  const [form, setForm] = useState({
    couple: "",
    date: "",
    venueId: "",
    layoutId: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dateEdit, setDateEdit] = useState<{ id: string; value: string } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    const repo = getRepo();
    const [es, vs] = await Promise.all([repo.listEvents(), repo.listVenues()]);
    setEvents(es);
    setVenues(vs);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!form.venueId) {
      setLayouts([]);
      return;
    }
    getRepo()
      .listLayouts(form.venueId)
      .then((ls) => setLayouts(ls));
  }, [form.venueId]);

  async function createEvent() {
    if (!form.couple.trim() || !form.date || !form.venueId || !form.layoutId)
      return;
    const id = newTableId();
    await getRepo().saveEvent({
      id,
      org_id: "local-org",
      venue_id: form.venueId,
      layout_id: form.layoutId,
      couple_names: form.couple.trim(),
      event_date: form.date,
      starts_at: null,
      photo_mode: "moderated_only",
      guest_token_secret: newTableId(),
      menu: [],
    });
    router.push(`/events/${id}/guests`);
  }

  const venueName = (id: string) =>
    venues.find((v) => v.id === id)?.name ?? "—";

  async function saveDate(e: WeddingEvent) {
    if (!dateEdit || dateEdit.id !== e.id) return;
    const value = dateEdit.value;
    setDateEdit(null);
    if (!value || value === e.event_date) return;
    // spread the freshly listed row so nothing else on the event is lost
    await getRepo().saveEvent({ ...e, event_date: value });
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <DemoButton />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        One wedding = one event, on a venue layout from your library.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          value={form.couple}
          onChange={(e) => setForm({ ...form, couple: e.target.value })}
          placeholder="Couple, e.g. Adam and Eve"
          className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={form.venueId}
          onChange={(e) =>
            setForm({ ...form, venueId: e.target.value, layoutId: "" })
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Choose venue…</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={form.layoutId}
          onChange={(e) => setForm({ ...form, layoutId: e.target.value })}
          disabled={!form.venueId}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Choose layout…</option>
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.capacity_total} pax)
            </option>
          ))}
        </select>
        <button
          onClick={createEvent}
          disabled={!form.couple.trim() || !form.date || !form.layoutId}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Create event
        </button>
      </div>

      {menuFor && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
      )}
      <div className="mt-8 space-y-3">
        {loaded && events.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            No events yet.{" "}
            {venues.length === 0 && "Map a venue first, then come back."}
          </p>
        )}
        {events.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <div>
              <h2 className="font-semibold text-slate-900">{e.couple_names}</h2>
              <p className="flex items-center gap-1 text-xs text-slate-400">
                {dateEdit?.id === e.id ? (
                  <input
                    type="date"
                    autoFocus
                    value={dateEdit.value}
                    onChange={(ev) =>
                      setDateEdit({ id: e.id, value: ev.target.value })
                    }
                    onBlur={() => saveDate(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") ev.currentTarget.blur();
                      if (ev.key === "Escape") setDateEdit(null);
                    }}
                    className="rounded border border-slate-300 px-1 py-0.5 text-xs text-slate-700"
                  />
                ) : (
                  <button
                    onClick={() =>
                      setDateEdit({ id: e.id, value: e.event_date })
                    }
                    title="Change date"
                    className="rounded px-0.5 underline decoration-dotted underline-offset-2 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {e.event_date} ✎
                  </button>
                )}
                <span>· {venueName(e.venue_id)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/events/${e.id}/guests`)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Guests
              </button>
              <button
                onClick={() => router.push(`/events/${e.id}/allocate`)}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                Seating →
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuFor(menuFor === e.id ? null : e.id)}
                  aria-label="More actions"
                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                >
                  ⋯
                </button>
                {menuFor === e.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    {(
                      [
                        ["Photos", "photos"],
                        ["Menu", "menu"],
                        ["E-invite studio", "einvite"],
                        ["Kitchen sheet", "kitchen"],
                      ] as const
                    ).map(([label, path]) => (
                      <button
                        key={path}
                        onClick={() => {
                          setMenuFor(null);
                          router.push(`/events/${e.id}/${path}`);
                        }}
                        className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {label}
                      </button>
                    ))}
                    <div className="my-1 h-px bg-slate-100" />
                    <button
                      onClick={async () => {
                        setMenuFor(null);
                        if (confirm(`Delete event “${e.couple_names}”?`)) {
                          await getRepo().deleteEvent(e.id);
                          refresh();
                        }
                      }}
                      className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete event
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
