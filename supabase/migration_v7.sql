-- Migration v7 – Default lead fields as columns
-- Safe: only ADD COLUMN IF NOT EXISTS, no drops

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS categorie             TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_college         BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_lycee           BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_prescolaire     BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_primaire        BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS date_contact          DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS date_derniere_adoption DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS decisionnaire         TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_college      INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_lycee        INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_prescolaire  INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_primaire     INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_estime       INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS methode_utilisee      TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_college     TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_lycee       TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_maternelle  TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_primaire    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS volume_horaire        TEXT;

-- Also widen the type CHECK on custom_field_definitions if it's still narrow
-- (idempotent: DROP then ADD)
ALTER TABLE public.custom_field_definitions
  DROP CONSTRAINT IF EXISTS custom_field_definitions_type_check;

ALTER TABLE public.custom_field_definitions
  ADD CONSTRAINT custom_field_definitions_type_check
  CHECK (type IN (
    'text','number','percentage','checkbox','date',
    'phone','email','dropdown','url','long_note','currency','stars'
  ));
