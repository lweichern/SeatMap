"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { newTableId } from "@/lib/layout-ops";
import type { Venue, VenueTableLayout, WeddingEvent } from "@/lib/types";

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
    });
    router.push(`/events/${id}/guests`);
  }

  const venueName = (id: string) =>
    venues.find((v) => v.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Events</h1>
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
              <p className="text-xs text-slate-400">
                {e.event_date} · {venueName(e.venue_id)}
              </p>
            </div>
            <div className="flex gap-2">
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
                Seating
              </button>
              <button
                onClick={() => router.push(`/events/${e.id}/photos`)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Photos
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Delete event “${e.couple_names}”?`)) {
                    await getRepo().deleteEvent(e.id);
                    refresh();
                  }
                }}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
