# Phase 2 — Guest Import + Auto-Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A planner creates an event on a venue layout, imports a messy guest spreadsheet, and one click seats 300 guests respecting constraints — then overrides anything by drag.

**Architecture:** Extends the Phase 1 repo pattern (local/supabase behind one interface) with events/guests/constraints. Import parsing and the allocator are pure, unit-tested modules; the allocator runs in a Web Worker for instant re-runs. UI: `/events` list, `/events/[id]/guests` (list + import + constraints), `/events/[id]/allocate` (table cards + drag override + locks).

**Tech Stack:** existing stack + `xlsx` (SheetJS — CSV+XLSX parsing).

## Global Constraints

- Allocation is client-side in a Web Worker (300 guests, instant re-run).
- Never break a hard constraint (`must_not_sit_together`, seats capacity); surface unsatisfiable clearly.
- `party_size` consumes that many seats at one table. VIPs seeded nearest stage. `group_tag` is a soft cluster. Locked guests excluded from re-allocation.
- Import must fuzzy-match headers (`Name`/`Guest Name`/`名字` etc.), preview before commit, allow manual column mapping.

---

### Task 1: Domain types + repo extension (TDD)
`src/lib/types.ts` add `WeddingEvent`, `Guest`, `GuestConstraint`. Repo interface + local/supabase impls: `listEvents/getEvent/saveEvent/deleteEvent`, `listGuests(eventId)/saveGuests(bulk)/saveGuest/deleteGuest`, `listConstraints/saveConstraint/deleteConstraint`. Test local impl round-trips.

### Task 2: Spreadsheet import parsing (TDD)
`src/lib/import.ts`: `detectColumns(headers): ColumnMapping` (fuzzy: name/guest name/名字/姓名, phone/mobile/tel/电话, email, pax/party/plus, side/bride/groom, group/tag/category, vip), `rowsToGuests(rows, mapping, eventId): Guest[]` (party_size default 1, side default both, trims, skips empty names). `parseSpreadsheet(file): Promise<{headers, rows}>` via SheetJS (thin, untested).

### Task 3: Allocator (TDD)
`src/lib/allocate.ts`: `allocate(guests, tables, constraints, opts): AllocationResult`.
Greedy seed (merge must-sit-together into units; units carry total party size; VIP units → tables sorted by distance-to-stage; best-fit-decreasing) + hill-climb swaps (~2000 iters, seeded RNG for determinism in tests) scoring: broken must-not −1000, same group_tag +10/pair, VIP stage distance penalty, fill efficiency. Locked guests pinned. Returns `{ assignments: Map<guestId, tableId>, unseated: Guest[], brokenConstraints: [] }`.
`src/workers/allocate.worker.ts`: thin postMessage wrapper.

### Task 4: Events pages
`/events`: list + create (pick venue + layout, couple names, date). `/events/[eventId]` redirects to guests.

### Task 5: Guests page
`/events/[eventId]/guests`: table (search, filter side/group/VIP, inline edit name/side/group/party/vip, delete), Import dialog (file → parse → auto-mapping shown → adjust per-column via selects → preview first 5 rows → commit), constraints panel (pick two guests + type, list + remove).

### Task 6: Allocation page
`/events/[eventId]/allocate`: run allocator in worker; render table cards (label, fill n/seats, distance-sorted) with guest chips (VIP badge, party size ×N, lock toggle); drag chip → other card (capacity-checked); "Re-allocate" respects locks; unsatisfiable banner lists broken pairs.

### Task 7: E2E verification
Playwright: create event → import CSV fixture (messy headers incl. 名字) → preview/commit → add constraints → allocate → verify no broken constraints, VIP near stage, drag override, lock + re-run stability. Merge to main after green.
