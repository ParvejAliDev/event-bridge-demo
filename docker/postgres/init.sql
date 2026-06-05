create table if not exists processed_events (
  event_id text primary key,
  order_id text not null,
  event_type text not null,
  status text not null,
  payload jsonb not null,
  attempt_count integer not null default 0,
  last_error text,
  processed_at timestamptz not null default now()
);

create table if not exists event_attempts (
  id serial primary key,
  event_id text not null,
  attempt_number integer not null,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists retry_schedules (
  id serial primary key,
  event_id text not null,
  next_attempt_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists dead_letter_events (
  event_id text primary key,
  reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists consumer_checkpoints (
  id serial primary key,
  topic text not null,
  partition_id integer not null,
  offset_value bigint not null,
  updated_at timestamptz not null default now(),
  unique (topic, partition_id)
);

create table if not exists processing_audit_logs (
  id serial primary key,
  event_id text not null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
