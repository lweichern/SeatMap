-- SeatMap initial schema. All geometry stored in METRES (see CLAUDE.md).
-- Multi-tenant: everything hangs off organizations, RLS on org membership.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tenants

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('owner', 'staff'))
);

-- Membership helper used by every RLS policy.
create or replace function public.user_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------- venues

create table venues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  address text not null default '',
  floorplan_url text,
  scale_px_per_metre double precision,
  width_m double precision,
  height_m double precision,
  walls jsonb not null default '[]'::jsonb,       -- [{x1,y1,x2,y2}] metres
  entrance jsonb,                                  -- {x,y,facing_deg}
  stage jsonb,                                     -- {x,y,w,h}
  created_at timestamptz not null default now()
);

create table venue_table_layouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  name text not null,
  capacity_total int not null default 0,
  created_at timestamptz not null default now()
);

create table venue_tables (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references venue_table_layouts (id) on delete cascade,
  label text not null,
  x double precision not null,                     -- metres, origin top-left
  y double precision not null,
  seats int not null default 10,
  shape text not null default 'round' check (shape in ('round', 'rect')),
  diameter_m double precision not null default 1.8,
  w_m double precision,
  h_m double precision
);

create index venue_tables_layout_idx on venue_tables (layout_id);

-- ---------------------------------------------------------------- events

create table events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  venue_id uuid not null references venues (id),
  layout_id uuid not null references venue_table_layouts (id),
  couple_names text not null,
  event_date date not null,
  starts_at timestamptz,
  photo_mode text not null default 'moderated_only'
    check (photo_mode in ('live_feed', 'moderated_only', 'off')),
  guest_token_secret uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  party_size int not null default 1,
  side text not null default 'both' check (side in ('bride', 'groom', 'both')),
  group_tag text,
  is_vip boolean not null default false,
  table_id uuid references venue_tables (id),
  locked boolean not null default false,
  qr_token text unique,
  checked_in_at timestamptz,
  checked_in_by uuid references users (id)
);

create index guests_event_idx on guests (event_id);

create table guest_constraints (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  guest_a_id uuid not null references guests (id) on delete cascade,
  guest_b_id uuid not null references guests (id) on delete cascade,
  type text not null check (type in ('must_sit_together', 'must_not_sit_together'))
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  guest_id uuid references guests (id),
  storage_path text not null,
  thumb_path text,
  status text not null default 'pending_ai'
    check (status in ('pending_ai', 'pending_human', 'approved', 'rejected')),
  ai_flag_reason text,
  uploaded_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references users (id),
  on_screen boolean not null default false
);

create index photos_event_status_idx on photos (event_id, status);

-- Append-only, written by the greeter app on sync. Never mutated.
-- id is the natural key "guest:device:timestamp" so resubmission is idempotent.
create table checkin_log (
  id text primary key,
  event_id uuid not null references events (id) on delete cascade,
  guest_id uuid not null references guests (id) on delete cascade,
  checked_in_at timestamptz not null,
  device_id text not null,
  synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS

alter table organizations enable row level security;
alter table users enable row level security;
alter table venues enable row level security;
alter table venue_table_layouts enable row level security;
alter table venue_tables enable row level security;
alter table events enable row level security;
alter table guests enable row level security;
alter table guest_constraints enable row level security;
alter table photos enable row level security;
alter table checkin_log enable row level security;

create policy org_self on organizations
  for all using (id = public.user_org_id());

create policy users_same_org on users
  for select using (org_id = public.user_org_id());

create policy venues_org on venues
  for all using (org_id = public.user_org_id());

create policy layouts_org on venue_table_layouts
  for all using (
    venue_id in (select id from venues where org_id = public.user_org_id())
  );

create policy tables_org on venue_tables
  for all using (
    layout_id in (
      select l.id from venue_table_layouts l
      join venues v on v.id = l.venue_id
      where v.org_id = public.user_org_id()
    )
  );

create policy events_org on events
  for all using (org_id = public.user_org_id());

create policy guests_org on guests
  for all using (
    event_id in (select id from events where org_id = public.user_org_id())
  );

create policy constraints_org on guest_constraints
  for all using (
    event_id in (select id from events where org_id = public.user_org_id())
  );

create policy photos_org on photos
  for all using (
    event_id in (select id from events where org_id = public.user_org_id())
  );

create policy checkin_org on checkin_log
  for all using (
    event_id in (select id from events where org_id = public.user_org_id())
  );

-- Guest-facing access (unauthenticated, qr_token-gated) is added in Phase 5
-- via security-definer RPCs that verify the HMAC token — NOT via anon table grants.
