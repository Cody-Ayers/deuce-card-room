-- Deuce Card Room · Supabase schema
-- Paste into the Supabase SQL editor and run once.

-- Public player cards: name + stats for the leaderboard and brag wall.
create table if not exists public.players (
  user_id    uuid primary key references auth.users on delete cascade,
  name       text not null default '' check (char_length(name) <= 24),
  stats      jsonb not null default '{}'::jsonb check (octet_length(stats::text) < 20000),
  updated_at timestamptz not null default now()
);
alter table public.players enable row level security;

drop policy if exists "Signed-in players can see the leaderboard" on public.players;
create policy "Signed-in players can see the leaderboard" on public.players
  for select to authenticated using (true);

drop policy if exists "Players add their own card" on public.players;
create policy "Players add their own card" on public.players
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own card" on public.players;
create policy "Players update their own card" on public.players
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Private cloud saves: only the owner can read or write.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 200000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;

drop policy if exists "Players read their own save" on public.saves;
create policy "Players read their own save" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Players create their own save" on public.saves;
create policy "Players create their own save" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own save" on public.saves;
create policy "Players update their own save" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Live leaderboard updates.
do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null;
end $$;
