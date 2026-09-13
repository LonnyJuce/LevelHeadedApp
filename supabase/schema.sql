create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  level integer not null default 1,
  total_xp integer not null default 0,
  character_class text not null default 'Initiate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text,
  habit_type text not null check (habit_type in ('positive', 'negative')),
  attribute text not null check (attribute in ('Strength', 'Constitution', 'Dexterity', 'Intelligence', 'Willpower', 'Charisma')),
  target_per_week integer not null default 1 check (target_per_week > 0),
  xp_per_completion integer not null default 10 check (xp_per_completion > 0),
  bonus_xp_for_full_week integer not null default 0,
  reset_period text not null default 'weekly' check (reset_period in ('daily', 'weekly')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_completions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_at timestamptz not null default now(),
  quantity integer not null default 1 check (quantity > 0),
  xp_delta integer not null,
  notes text
);

create index if not exists habits_user_id_idx on public.habits(user_id);
create index if not exists habit_completions_habit_id_idx on public.habit_completions(habit_id);
create index if not exists habit_completions_user_id_idx on public.habit_completions(user_id);

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can manage their habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage their completion log" on public.habit_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'User must be signed in to delete an account.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_current_user() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
