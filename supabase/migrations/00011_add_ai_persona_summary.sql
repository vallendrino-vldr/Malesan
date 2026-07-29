-- Migration: add_ai_persona_summary
-- Add a column to store the generated AI persona summary.

alter table public.creator_dna add column ai_persona_summary text;
