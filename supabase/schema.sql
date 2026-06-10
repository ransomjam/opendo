create table if not exists public.opendo_json_store (
  file_name text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.opendo_json_store enable row level security;

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
