create table if not exists public.pomodoro_stats (
  client_id text not null,
  day date not null,
  sessions integer not null default 0,
  primary key (client_id, day)
);

alter table public.pomodoro_stats enable row level security;

create index if not exists pomodoro_stats_client_day_idx
  on public.pomodoro_stats (client_id, day);
