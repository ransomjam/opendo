create table if not exists public.opendo_json_store (
  file_name text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key,
  full_name text not null default '',
  email text not null unique,
  password_hash text not null default '',
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key,
  user_id uuid not null unique references public.users(id) on delete cascade,
  country text not null default '',
  city text not null default '',
  profession text not null default '',
  education_level text not null default '',
  skills jsonb not null default '[]'::jsonb,
  business_type text not null default '',
  business_stage text not null default '',
  sector_interests jsonb not null default '[]'::jsonb,
  funding_needs text not null default '',
  travel_available boolean not null default false,
  passport_available boolean not null default false,
  business_registered boolean not null default false,
  preferred_opportunity_types jsonb not null default '[]'::jsonb,
  bio text not null default '',
  portfolio_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id text primary key,
  title text not null default '',
  organisation text not null default '',
  category text not null default '',
  description text not null default '',
  country_scope text not null default '',
  location text not null default '',
  deadline text,
  funding_amount text not null default '',
  benefits text not null default '',
  eligibility text not null default '',
  required_documents text not null default '',
  application_steps text not null default '',
  application_link text not null default '',
  source_url text not null default '',
  risk_level text not null default 'unverified',
  status text not null default 'draft',
  created_by_user_id uuid references public.users(id) on delete set null,
  visibility text not null default 'public',
  source_citations jsonb not null default '[]'::jsonb,
  raw_research_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_documents (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  document_type text not null default '',
  original_name text not null default '',
  stored_name text not null default '',
  file_path text not null default '',
  mime_type text not null default '',
  size bigint not null default 0,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_opportunity_matches (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  match_score integer not null default 0,
  match_level text not null default 'not_recommended',
  eligibility_status text not null default 'unclear',
  eligibility_score integer not null default 0,
  relevance_score integer not null default 0,
  readiness_score integer not null default 0,
  urgency_score integer not null default 0,
  value_score integer not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  possible_concerns jsonb not null default '[]'::jsonb,
  available_documents jsonb not null default '[]'::jsonb,
  missing_documents jsonb not null default '[]'::jsonb,
  recommended_next_steps jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  ai_enhanced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create table if not exists public.action_steps (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  status text not null default 'not_started',
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists user_profiles_user_id_idx on public.user_profiles (user_id);
create index if not exists opportunities_status_idx on public.opportunities (status);
create index if not exists opportunities_visibility_idx on public.opportunities (visibility);
create index if not exists opportunities_created_by_user_id_idx on public.opportunities (created_by_user_id);
create index if not exists opportunities_category_idx on public.opportunities (category);
create index if not exists user_documents_user_id_idx on public.user_documents (user_id);
create index if not exists user_opportunity_matches_user_id_idx on public.user_opportunity_matches (user_id);
create index if not exists user_opportunity_matches_opportunity_id_idx on public.user_opportunity_matches (opportunity_id);
create index if not exists action_steps_user_id_idx on public.action_steps (user_id);
create index if not exists action_steps_opportunity_id_idx on public.action_steps (opportunity_id);

alter table public.opendo_json_store enable row level security;
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.user_documents enable row level security;
alter table public.user_opportunity_matches enable row level security;
alter table public.action_steps enable row level security;

insert into public.opendo_json_store (file_name, data)
values
  ('users.json', '[]'::jsonb),
  ('userProfiles.json', '[]'::jsonb),
  ('userDocuments.json', '[]'::jsonb),
  ('opportunities.json', '[]'::jsonb),
  ('userOpportunityMatches.json', '[]'::jsonb),
  ('actionSteps.json', '[]'::jsonb)
on conflict (file_name) do nothing;

insert into storage.buckets (id, name, public)
values ('opendo-documents', 'opendo-documents', false)
on conflict (id) do nothing;
