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
  const [editing, setEditing] = useState<WeddingEvent | null>(null);

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

  async function saveEdit(draft: WeddingEvent) {
    setEditing(null);
    // draft is a spread of the freshly listed row, so nothing else is lost
    await getRepo().saveEvent(draft);
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
              <p className="text-xs text-slate-400">
                {e.event_date}
                {(m => (m ? `, ${m[1]}` : ""))(
                  e.starts_at?.match(/T(\d{2}:\d{2})/),
                )}{" "}
                · {venueName(e.venue_id)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(e)}
                aria-label={`Edit ${e.couple_names}`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Edit
              </button>
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

      {editing && (
        <EditEventModal
          event={editing}
          venueName={venueName(editing.venue_id)}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

/**
 * Popup editor for the per-event fields that are safe to change after
 * creation. Venue and layout stay fixed — seating allocations live on the
 * layout, so moving an event would orphan them.
 */
function EditEventModal({
  event,
  venueName,
  onCancel,
  onSave,
}: {
  event: WeddingEvent;
  venueName: string;
  onCancel: () => void;
  onSave: (draft: WeddingEvent) => void;
}) {
  const [couple, setCouple] = useState(event.couple_names);
  const [date, setDate] = useState(event.event_date);
  // starts_at is stored as "YYYY-MM-DDTHH:MM:SS" — edit just the "HH:MM"
  // and recompose against the (possibly changed) date on save.
  const [startsAt, setStartsAt] = useState(
    event.starts_at?.match(/T(\d{2}:\d{2})/)?.[1] ?? "",
  );
  const valid = couple.trim().length > 0 && date.length > 0;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-label="Edit event"
        onClick={(ev) => ev.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="font-semibold text-slate-900">Edit event</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Venue stays {venueName} — seating is built on its layout.
        </p>
        <label className="mt-4 block text-xs font-medium text-slate-600">
          Couple
          <input
            value={couple}
            onChange={(ev) => setCouple(ev.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">
            Date
            <input
              type="date"
              value={date}
              onChange={(ev) => setDate(ev.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Starts at
            <input
              type="time"
              value={startsAt}
              onChange={(ev) => setStartsAt(ev.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                ...event,
                couple_names: couple.trim(),
                event_date: date,
                starts_at: startsAt ? `${date}T${startsAt}:00` : null,
              })
            }
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
