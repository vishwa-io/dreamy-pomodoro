create table if not exists public.pomodoro_stats (
  client_id text not null,
  day date not null,
  sessions integer not null default 0,
  primary key (client_id, day)
);

alter table public.pomodoro_stats enable row level security;

create index if not exists pomodoro_stats_client_day_idx
  on public.pomodoro_stats (client_id, day);

create or replace function public.increment_pomodoro_stat(
  p_client_id text,
  p_day date
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.pomodoro_stats (client_id, day, sessions)
  values (p_client_id, p_day, 1)
  on conflict (client_id, day)
  do update set sessions = public.pomodoro_stats.sessions + 1;
$$;
