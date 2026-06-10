-- ============================================================
-- Exchanges CRM – Supabase Schema v2 (French pipeline)
-- Run this in the Supabase SQL editor to set up the database.
-- If upgrading from v1, run supabase/migration_v2.sql instead.
-- ============================================================

create extension if not exists "uuid-ossp";

-- -------------------------------------------------------
-- PROFILES
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

create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

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
-- CUSTOM FIELD DEFINITIONS (global field schema)
-- -------------------------------------------------------
create table if not exists public.custom_field_definitions (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text not null default 'text'
                check (type in ('text','number','percentage','checkbox','date','dropdown','phone','email')),
  options     jsonb,          -- dropdown options: ["Option A","Option B"]
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.custom_field_definitions enable row level security;

create policy "field_defs_select" on public.custom_field_definitions
  for select using (auth.role() = 'authenticated');

create policy "field_defs_insert" on public.custom_field_definitions
  for insert with check (auth.role() = 'authenticated');

create policy "field_defs_update" on public.custom_field_definitions
  for update using (auth.role() = 'authenticated');

create policy "field_defs_delete" on public.custom_field_definitions
  for delete using (auth.role() = 'authenticated');

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
  type               text check (type in ('school','university','language_center','bookstore','other')),
  publisher_interest text check (publisher_interest in ('CUP','NGL','Pearson','Autre')),
  stage              text not null default 'prospect_qualifie'
                       check (stage in (
                         'prospect_qualifie','contact','visite','proposition',
                         'negociation','conclu','non_conclu','acheve'
                       )),
  priority           text default 'normale'
                       check (priority in ('urgente','normale','basse')),
  custom_fields      jsonb not null default '{}'::jsonb,
  assigned_to        uuid references public.profiles(id) on delete set null,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "leads_select" on public.leads
  for select using (auth.role() = 'authenticated');

create policy "leads_insert" on public.leads
  for insert with check (auth.role() = 'authenticated');

create policy "leads_update" on public.leads
  for update using (auth.role() = 'authenticated');

create policy "leads_delete" on public.leads
  for delete using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

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
-- ACTIVITIES
-- -------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  type        text not null check (type in ('note','stage_change','field_update','call','email','meeting')),
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
create index if not exists leads_stage_idx      on public.leads(stage);
create index if not exists leads_assigned_idx   on public.leads(assigned_to);
create index if not exists leads_priority_idx   on public.leads(priority);
create index if not exists activities_lead_idx  on public.activities(lead_id);
create index if not exists field_defs_order_idx on public.custom_field_definitions(sort_order);

-- No default fields seeded — the Champs section starts blank.
-- Users add fields from the lead detail page using the "+" button.
