-- Migration v8 – Ensure all columns exist on new database
-- Safe: only ADD COLUMN IF NOT EXISTS, no drops, no data loss
-- Run this in the Supabase SQL Editor.

-- ── leads: core columns that may be missing ──────────────────────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pipeline_id   UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes         TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority      TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to   UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by    UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stage         TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone         TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city          TEXT;

-- ── leads: 20 default field columns ─────────────────────────────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS categorie              TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_college          BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_lycee            BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_prescolaire      BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cycle_primaire         BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS date_contact           DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS date_derniere_adoption DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS decisionnaire          TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_college       INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_lycee         INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_prescolaire   INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_primaire      INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif_estime        INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS methode_utilisee       TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_college      TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_lycee        TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_maternelle   TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS programme_primaire     TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS volume_horaire         TEXT;

-- ── custom_field_definitions: pipeline_id ────────────────────────────────────
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS pipeline_id UUID;
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS options     JSONB;
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS sort_order  INTEGER DEFAULT 0;

-- ── pipelines & pipeline_stages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipelines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at trigger on leads (idempotent) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN new.updated_at = NOW(); RETURN new; END;
$$;

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── Storage bucket for lead avatars ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-avatars', 'lead-avatars', true)
ON CONFLICT (id) DO NOTHING;
