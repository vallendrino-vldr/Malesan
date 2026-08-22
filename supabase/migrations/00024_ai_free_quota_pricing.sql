-- Migration: ai_free_quota_pricing
--
-- The runtime and admin UI support providers whose usage is covered by a free
-- quota. Keep that state explicit: zero-cost quota is known pricing, while an
-- empty direct-API price means the owner still needs to configure pricing.
--
-- Additive reconciliation only. Existing rows and prices are untouched.

alter table public.ai_models
  drop constraint if exists ai_models_pricing_mode_check;

alter table public.ai_models
  add constraint ai_models_pricing_mode_check
  check (pricing_mode in ('direct_usd', 'prepaid_package', 'free_quota'));

comment on column public.ai_models.pricing_mode is
  'direct_usd = per-Mtok USD rates; prepaid_package = bought N tokens for Rp X; free_quota = provider quota with known zero marginal cost.';
