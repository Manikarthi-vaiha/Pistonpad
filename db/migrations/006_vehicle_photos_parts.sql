-- Photos of used bikes (bike, damage, documents) and their owners. Resized in the browser before upload,
-- so a full image is a few hundred KB and the thumbnail a few KB.
create table vehicle_photos (
  id          bigserial primary key,
  vehicle_id  bigint not null references vehicles(id) on delete cascade,
  kind        text not null default 'vehicle' check (kind in ('vehicle', 'damage', 'document', 'owner')),
  caption     text not null default '',
  mime        text not null,
  data        bytea not null,
  thumb       bytea not null,
  user_id     int references users(id),
  created_at  timestamptz not null default now()
);
create index vehicle_photos_vehicle_idx on vehicle_photos (vehicle_id, kind, id);

-- Condition report: what's damaged, what was repaired or recently replaced, and any warranty on it.
create table vehicle_parts (
  id            bigserial primary key,
  vehicle_id    bigint not null references vehicles(id) on delete cascade,
  part          text not null,
  status        text not null default 'ok' check (status in ('ok', 'damaged', 'repaired', 'replaced')),
  detail        text not null default '',            -- brand / model / what exactly is wrong
  changed_on    date,
  odometer_km   int,
  cost          numeric(12,2) not null default 0,
  warranty_till date,
  -- Repaired/replaced parts also appear in the history; the cost is counted there (once), not here.
  event_id      bigint references vehicle_events(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index vehicle_parts_vehicle_idx on vehicle_parts (vehicle_id, status);
