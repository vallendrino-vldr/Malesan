-- Migration: dashboard_notice_config
-- One owner-editable line shown on the user dashboard.
--
-- setConfig() refuses any key that does not already exist (admin.ts) — a guard
-- against typos writing junk rows — so a new live-editable setting has to be
-- seeded here before the admin panel can touch it. Empty string means "hide it".
insert into public.app_config (key, value, description)
values (
  'dashboard_notice',
  '""'::jsonb,
  'Pengumuman satu baris di dashboard user. Kosongin buat sembunyiin.'
)
on conflict (key) do nothing;
