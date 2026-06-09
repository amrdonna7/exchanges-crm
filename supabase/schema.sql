-- ============================================================
-- Exchanges CRM – Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------
-- PROFILES (mirrors auth.users, one row per user)
-- -------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'sales_rep' check (role in ('admin', 'manager', 'sales_rep')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read all profiles (needed for assignee dropdown)
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Users can update their own profile
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -------------------------------------------------------
-- LEADS
-- -------------------------------------------------------
create table if not exists public.leads (
  id                 uuid primary key default uuid_generate_v4(),
  organization_name  text not null,
  contact_person     text,
  phone              text,
  email              text,
  city               text,
  type               text check (type in ('school', 'university', 'language_center', 'bookstore', 'other')),
  publisher_interest text check (publisher_interest in ('CUP', 'NGL', 'Pearson', 'Other')),
  stage              text not null default 'prospect'
                       check (stage in ('prospect', 'contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost')),
  assigned_to        uuid references public.profiles(id) on delete set null,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.leads enable row level security;

-- All authenticated users can read leads
create policy "leads_select" on public.leads
  for select using (auth.role() = 'authenticated');

-- All authenticated users can insert leads
create policy "leads_insert" on public.leads
  for insert with check (auth.role() = 'authenticated');

-- All authenticated users can update leads
create policy "leads_update" on public.leads
  for update using (auth.role() = 'authenticated');

-- Only creator or admin can delete
create policy "leads_delete" on public.leads
  for delete using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Updated_at trigger for leads
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------
-- ACTIVITIES (audit / activity log per lead)
-- -------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  type        text not null check (type in ('note', 'stage_change', 'field_update', 'call', 'email', 'meeting')),
  content     text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "activities_select" on public.activities
  for select using (auth.role() = 'authenticated');

create policy "activities_insert" on public.activities
  for insert with check (auth.role() = 'authenticated');

create policy "activities_delete" on public.activities
  for delete using (auth.uid() = user_id);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
create index if not exists leads_stage_idx       on public.leads(stage);
create index if not exists leads_assigned_idx    on public.leads(assigned_to);
create index if not exists leads_created_by_idx  on public.leads(created_by);
create index if not exists activities_lead_idx   on public.activities(lead_id);
create index if not exists activities_user_idx   on public.activities(user_id);

-- Full-text search index on leads
create index if not exists leads_fts_idx on public.leads
  using gin(to_tsvector('english',
    coalesce(organization_name, '') || ' ' ||
    coalesce(contact_person, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(phone, '')
  ));

-- -------------------------------------------------------
-- REALTIME (optional – enable for live Kanban updates)
-- -------------------------------------------------------
-- alter publication supabase_realtime add table public.leads;
-- alter publication supabase_realtime add table public.activities;
