-- Run this once in Supabase Dashboard > SQL Editor.
-- Passwords are managed and hashed by Supabase Auth, never stored here.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  subject text not null check (char_length(subject) between 1 and 200),
  because text not null check (char_length(because) between 1 and 1000),
  priority smallint not null check (priority between 1 and 3),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.speech_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 5000),
  practiced boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;
alter table public.speech_texts enable row level security;

create policy "Users can manage their own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own speech texts" on public.speech_texts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists notes_user_created_idx on public.notes(user_id, created_at desc);
create index if not exists speech_texts_user_created_idx on public.speech_texts(user_id, created_at);

create table if not exists public.moodboards (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 100),
  strokes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists public.moodboard_items (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('text', 'image', 'video')),
  body text not null,
  x integer not null default 40,
  y integer not null default 40,
  created_at timestamptz not null default now()
);

alter table public.moodboards add column if not exists created_at timestamptz not null default now();

alter table public.moodboards enable row level security;
alter table public.moodboard_items enable row level security;

create policy "Users can manage their own moodboards" on public.moodboards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own moodboard items" on public.moodboard_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('moodboard-media', 'moodboard-media', false)
on conflict (id) do nothing;

create policy "Users can upload moodboard media"
on storage.objects for insert to authenticated
with check (bucket_id = 'moodboard-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can read their moodboard media"
on storage.objects for select to authenticated
using (bucket_id = 'moodboard-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users can delete their moodboard media"
on storage.objects for delete to authenticated
using (bucket_id = 'moodboard-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 100),
  notes text not null default '' check (char_length(notes) <= 50000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  notes_updated_at timestamptz
);

alter table public.courses enable row level security;

create policy "Users can manage their own courses" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists courses_user_created_idx on public.courses(user_id, created_at);

alter table public.notes add column if not exists completed_at timestamptz;
