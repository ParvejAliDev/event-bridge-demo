create table if not exists processed_events (
  event_id text primary key,
  order_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists event_attempts (
  id serial primary key,
  event_id text not null,
  attempt_number integer not null,
  created_at timestamptz not null default now()
);

create table if not exists dead_letter_events (
  event_id text primary key,
  reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
