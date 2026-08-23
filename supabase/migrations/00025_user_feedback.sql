-- 00025_user_feedback.sql
-- Lightweight user feedback system for Malesan

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('kendala', 'saran', 'pertanyaan', 'lainnya')),
  message text not null,
  status text not null default 'baru' check (status in ('baru', 'ditinjau', 'diproses', 'selesai')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_feedback_user_id on public.user_feedback(user_id);
create index if not exists idx_user_feedback_status on public.user_feedback(status);
create index if not exists idx_user_feedback_created_at on public.user_feedback(created_at desc);

alter table public.user_feedback enable row level security;
