# Supabase Setup for Opendo

Opendo can persist its current JSON-style app data in Supabase. This keeps the app simple for now while surviving Render Free restarts.

## 1. Create the Supabase Project

1. Open Supabase and create a new project.
2. Open **SQL Editor**.
3. Paste and run the SQL from `supabase/schema.sql`.

This creates:

- `public.opendo_json_store` for users, profiles, opportunities, matches, documents metadata, and action steps.
- private Storage bucket `opendo-documents` for uploaded files.

## 2. Get API Values

In Supabase, open **Project Settings** -> **API** and copy:

- Project URL
- `service_role` key

Use the `service_role` key only on the server/Render environment. Do not paste it into frontend code.

## 3. Configure Render

Add these environment variables to the Render Web Service:

```text
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service_role key>
SUPABASE_JSON_TABLE=opendo_json_store
SUPABASE_STORAGE_BUCKET=opendo-documents
```

Keep these unset on Render Free:

```text
DATA_DIR=
UPLOADS_DIR=
```

The app automatically uses Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present. If they are missing, it falls back to local JSON files.

## 4. Redeploy

After setting the Render environment variables, redeploy the latest commit.

Smoke checks:

- Register or log in.
- Save a profile.
- Research an opportunity.
- Recalculate matches.
- Upload and delete a document.
- Restart/redeploy the Render service and confirm the saved data remains.

## Optional Local JSON Import

If you intentionally want to copy local JSON records into Supabase, run this locally with Supabase env vars set:

```sh
npm run migrate-json-to-supabase
```

Do not import local test users or private data unless you really want them in the Supabase project.
