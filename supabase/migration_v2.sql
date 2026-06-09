-- ============================================================
-- Migration v2 – upgrade existing v1 database to v2 schema
-- Run ONLY if you already ran the v1 schema.sql.
-- ============================================================

-- 1. Add new columns to leads
alter table public.leads
  add column if not exists priority text default 'normale'
    check (priority in ('urgente','normale','basse')),
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- 2. Update stage CHECK constraint (drop old, add new)
alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads
  add constraint leads_stage_check
  check (stage in (
    'prospect_qualifie','contact','visite','proposition',
    'negociation','conclu','non_conclu','acheve'
  ));

-- 3. Migrate old English stage values → new French keys
update public.leads set stage = 'prospect_qualifie' where stage = 'prospect';
update public.leads set stage = 'contact'           where stage = 'contacted';
update public.leads set stage = 'visite'            where stage = 'meeting_scheduled';
update public.leads set stage = 'proposition'       where stage = 'proposal_sent';
update public.leads set stage = 'negociation'       where stage = 'negotiation';
update public.leads set stage = 'conclu'            where stage = 'won';
update public.leads set stage = 'non_conclu'        where stage = 'lost';

-- Fallback: any remaining old stage → prospect_qualifie
update public.leads set stage = 'prospect_qualifie'
  where stage not in (
    'prospect_qualifie','contact','visite','proposition',
    'negociation','conclu','non_conclu','acheve'
  );

-- 4. Update publisher_interest CHECK
alter table public.leads drop constraint if exists leads_publisher_interest_check;
alter table public.leads
  add constraint leads_publisher_interest_check
  check (publisher_interest in ('CUP','NGL','Pearson','Autre'));

-- 5. Create custom_field_definitions table
create table if not exists public.custom_field_definitions (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text not null default 'text'
                check (type in ('text','number','percentage','checkbox','date','dropdown','phone','email')),
  options     jsonb,
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

-- 6. Seed default field definitions
insert into public.custom_field_definitions (name, type, sort_order) values
  ('Ville',                       'text',     1),
  ('Catégorie',                   'text',     2),
  ('Cycle validé au Collège',     'checkbox', 3),
  ('Cycle validé au Lycée',       'checkbox', 4),
  ('Cycle validé au Préscolaire', 'checkbox', 5),
  ('Cycle validé au Primaire',    'checkbox', 6),
  ('Date de contact',             'date',     7),
  ('Date dernière adoption',      'date',     8),
  ('Décisionnaire',               'text',     9),
  ('Effectif Collège',            'number',   10),
  ('Effectif Lycée',              'number',   11),
  ('Effectif Préscolaire',        'number',   12),
  ('Effectif Primaire',           'number',   13),
  ('Effectif est.',               'number',   14),
  ('Email',                       'email',    15),
  ('Maroc',                       'checkbox', 16),
  ('Méthode utilisée',            'text',     17),
  ('Programme Collège',           'text',     18),
  ('Programme Lycée',             'text',     19),
  ('Programme Maternelle',        'text',     20),
  ('Programme Primaire',          'text',     21),
  ('Solution adoptée',            'text',     22),
  ('Téléphone',                   'phone',    23),
  ('Volume Horaire',              'text',     24)
on conflict do nothing;

-- 7. Add indexes
create index if not exists leads_priority_idx   on public.leads(priority);
create index if not exists field_defs_order_idx on public.custom_field_definitions(sort_order);
