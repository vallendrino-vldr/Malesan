-- Migration: 00026_content_brain_phase1.sql
-- Additive columns for Pipeline Calendar View and AI Scoring

ALTER TABLE public.pipeline_cards 
  ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_score int DEFAULT NULL CHECK (ai_score >= 0 AND ai_score <= 100);

-- Partial index for calendar date range queries
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_user_scheduled 
  ON public.pipeline_cards (user_id, scheduled_date) 
  WHERE scheduled_date IS NOT NULL;

-- Default credit cost for AI 7-Day Strategy Generator (can be adjusted by admin)
INSERT INTO public.app_config (key, value, description)
VALUES ('cost_content_strategy', '5'::jsonb, 'Biaya kredit untuk membuat strategi konten 7 hari')
ON CONFLICT (key) DO NOTHING;
