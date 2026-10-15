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
