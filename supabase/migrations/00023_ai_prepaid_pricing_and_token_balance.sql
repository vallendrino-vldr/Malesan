-- Migration: ai_prepaid_pricing_and_token_balance
--
-- Prepaid token packages, token-quota balances, and an admin charge mode.
-- Additive only: every existing column keeps its meaning and its default.

-- ============================================================
-- 1. PRICING MODE
-- ============================================================
-- Owners buy prepaid token packages ("Rp2.238 for 1,000,000 tokens, 30 days"),
-- not per-million-token USD rates. Forcing them to convert was the reason every
-- cost figure read Rp0: nobody was going to do that arithmetic by hand, so the
-- price stayed empty and every margin on the dashboard was blank.
--
-- direct_usd keeps the existing behaviour and stays the default, because that is
-- what a scan of OpenRouter or OpenAI actually returns.
alter table public.ai_models
  add column if not exists pricing_mode text not null default 'direct_usd'
    check (pricing_mode in ('direct_usd', 'prepaid_package'));

alter table public.ai_models add column if not exists package_price_idr numeric(14, 2);
alter table public.ai_models add column if not exists package_tokens bigint;
alter table public.ai_models add column if not exists package_expires_at date;

comment on column public.ai_models.pricing_mode is
  'direct_usd = per-Mtok USD rates (scanned). prepaid_package = bought N tokens for Rp X; cost per token is derived.';

-- ============================================================
-- 2. TOKEN-QUOTA BALANCES
-- ============================================================
-- Ipeenk and similar gateways report a token quota rather than a currency
-- balance. Reading that number as rupiah would be nonsense, so the unit is
-- stored alongside it.
--
-- Note on what is authoritative: the REMAINING quota shown in the product is
-- computed from ai_usage_log against the package size, not from this endpoint.
-- Ipeenk reports {"total_balance": 99029.9, "currency": "USD"} for a package
-- sold as "1,000,000 tokens" — a figure in a unit that cannot be reconciled with
-- what was bought without guessing. Our own log records the exact token counts
-- the provider returned on every call, so it is both more trustworthy and
-- realtime. The gateway's figure is still stored and displayed as theirs, so a
-- disagreement is visible rather than hidden.
alter table public.ai_providers
  add column if not exists balance_kind text not null default 'currency'
    check (balance_kind in ('currency', 'tokens'));

alter table public.ai_provider_balance add column if not exists total_tokens bigint;
alter table public.ai_provider_balance add column if not exists used_tokens bigint;
alter table public.ai_provider_balance add column if not exists remaining_tokens bigint;

-- ============================================================
-- 3. ADMIN CHARGE MODE
-- ============================================================
-- spend_credits returns early for admins, so an owner testing their own product
-- never exercises the credit path — but the AI cost is real and gets recorded
-- either way. That left the dashboard counting revenue that never happened.
--
-- This does NOT change the SQL function. It tells the route which figure to
-- RECORD: 'free' logs zero credits (the truth), 'simulate' logs what a paying
-- user would have been charged so the margin figures show a realistic shape.
insert into public.app_config (key, value, description) values
  (
    'ai_admin_charge',
    '"free"'::jsonb,
    'Waktu owner/admin nyoba fitur: "free" (gak dipotong, default) atau "simulate" (dicatat seolah kepotong, biar angka di dashboard realistis).'
  )
on conflict (key) do nothing;
