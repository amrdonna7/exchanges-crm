-- ============================================================
-- Migration v5 – lead avatar_url + Supabase Storage bucket
-- ============================================================

-- 1. Add avatar_url to leads
alter table public.leads
  add column if not exists avatar_url text;

-- 2. Create the lead-avatars storage bucket (public reads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-avatars',
  'lead-avatars',
  true,
  5242880,  -- 5 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- 3. Storage RLS policies
create policy "lead_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'lead-avatars');

create policy "lead_avatars_auth_write"
  on storage.objects for insert
  with check (bucket_id = 'lead-avatars' and auth.role() = 'authenticated');

create policy "lead_avatars_auth_update"
  on storage.objects for update
  using (bucket_id = 'lead-avatars' and auth.role() = 'authenticated');

create policy "lead_avatars_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'lead-avatars' and auth.role() = 'authenticated');

-- 4. Ensure custom_field_definitions table exists with correct structure
create table if not exists public.custom_field_definitions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'text'
                check (type in (
                  'text','number','percentage','checkbox','date',
                  'phone','email','dropdown','url','long_note',
                  'currency','stars'
                )),
  options     jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Enable RLS if not already
alter table public.custom_field_definitions enable row level security;

-- Recreate policies (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'custom_field_definitions' and policyname = 'field_defs_select'
  ) then
    create policy "field_defs_select" on public.custom_field_definitions
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'custom_field_definitions' and policyname = 'field_defs_insert'
  ) then
    create policy "field_defs_insert" on public.custom_field_definitions
      for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'custom_field_definitions' and policyname = 'field_defs_update'
  ) then
    create policy "field_defs_update" on public.custom_field_definitions
      for update using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'custom_field_definitions' and policyname = 'field_defs_delete'
  ) then
    create policy "field_defs_delete" on public.custom_field_definitions
      for delete using (auth.role() = 'authenticated');
  end if;
end $$;
