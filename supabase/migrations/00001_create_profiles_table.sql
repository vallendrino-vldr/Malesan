-- Migration: create_profiles_table
-- Step 2. The core user table.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  credits_free int not null default 5 check (credits_free >= 0),
  credits_paid int not null default 0 check (credits_paid >= 0),
  last_refill_date date not null default current_date,
  is_pro boolean not null default false,
  onboarding_completed boolean not null default false,
  free_trial_used boolean not null default false,
  referral_code text unique not null,
  referred_by uuid references public.profiles(id),
  fingerprint_hash text,
  signup_ip_hash text,
  is_banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
