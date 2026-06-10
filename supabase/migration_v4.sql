-- ============================================================
-- Migration v4 – remove all seeded default field definitions
-- Run this to start with a blank, user-driven Champs section.
-- WARNING: also clears custom_fields values on all leads.
-- ============================================================

-- 1. Wipe seeded field definitions
delete from public.custom_field_definitions;

-- 2. Clear custom_fields values from all leads (they referenced seeded defs)
update public.leads set custom_fields = '{}'::jsonb;

-- 3. Reset the sort_order sequence (optional, cosmetic)
-- No sequence needed since sort_order is just an int.
