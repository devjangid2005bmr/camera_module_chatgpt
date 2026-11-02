create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  photo_notice_shown_at timestamptz,
  photo_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_photos (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  camera_type text not null check (camera_type in ('front','rear')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.lead_photos enable row level security;
-- No public table policies. Backend accesses Supabase using the service-role key.

insert into storage.buckets (id, name, public)
values ('batgpt-photos', 'batgpt-photos', false)
on conflict (id) do nothing;
