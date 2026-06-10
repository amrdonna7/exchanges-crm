-- Migration v6 – Multiple Pipelines + safe column additions
-- Safe to run on existing database — no table drops, no data loss

-- 1. Add pipeline_id to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pipeline_id UUID;

-- 2. Add avatar_url if not already present (idempotent)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Drop stage/type/publisher check constraints to allow free-form values
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_type_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_publisher_interest_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_priority_check;

-- 4. Make FK columns nullable
ALTER TABLE public.leads ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN created_by DROP NOT NULL;

-- 5. Pipelines table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipelines' AND policyname='pipelines_select') THEN
    CREATE POLICY "pipelines_select" ON public.pipelines FOR SELECT USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipelines' AND policyname='pipelines_insert') THEN
    CREATE POLICY "pipelines_insert" ON public.pipelines FOR INSERT WITH CHECK (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipelines' AND policyname='pipelines_update') THEN
    CREATE POLICY "pipelines_update" ON public.pipelines FOR UPDATE USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipelines' AND policyname='pipelines_delete') THEN
    CREATE POLICY "pipelines_delete" ON public.pipelines FOR DELETE USING (auth.role()='authenticated');
  END IF;
END $$;

-- 6. Pipeline stages table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipeline_stages' AND policyname='stages_select') THEN
    CREATE POLICY "stages_select" ON public.pipeline_stages FOR SELECT USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipeline_stages' AND policyname='stages_insert') THEN
    CREATE POLICY "stages_insert" ON public.pipeline_stages FOR INSERT WITH CHECK (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipeline_stages' AND policyname='stages_update') THEN
    CREATE POLICY "stages_update" ON public.pipeline_stages FOR UPDATE USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pipeline_stages' AND policyname='stages_delete') THEN
    CREATE POLICY "stages_delete" ON public.pipeline_stages FOR DELETE USING (auth.role()='authenticated');
  END IF;
END $$;

-- 7. Add pipeline_id to custom_field_definitions (existing table)
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- 8. Storage bucket for lead avatars (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lead-avatars','lead-avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='lead_avatars_public_read') THEN
    CREATE POLICY "lead_avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id='lead-avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='lead_avatars_auth_write') THEN
    CREATE POLICY "lead_avatars_auth_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id='lead-avatars' AND auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='lead_avatars_auth_update') THEN
    CREATE POLICY "lead_avatars_auth_update" ON storage.objects FOR UPDATE USING (bucket_id='lead-avatars' AND auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='lead_avatars_auth_delete') THEN
    CREATE POLICY "lead_avatars_auth_delete" ON storage.objects FOR DELETE USING (bucket_id='lead-avatars' AND auth.role()='authenticated');
  END IF;
END $$;
