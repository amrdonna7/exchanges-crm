-- ============================================================
-- Migration v3 – extend custom_field_definitions type enum
-- Run after migration_v2.sql
-- ============================================================

-- Drop old type check and replace with expanded list
alter table public.custom_field_definitions
  drop constraint if exists custom_field_definitions_type_check;

alter table public.custom_field_definitions
  add constraint custom_field_definitions_type_check
  check (type in (
    'text', 'number', 'percentage', 'checkbox', 'date',
    'phone', 'email', 'dropdown', 'url', 'long_note',
    'currency', 'stars'
  ));
