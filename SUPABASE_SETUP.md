# Supabase Setup for Opendo

Opendo can use Supabase for durable Render Free storage. The app stores core records in structured tables and uploaded document files in Supabase Storage.

## 1. Create the Supabase Project

1. Open Supabase and create a new project.
2. Open **SQL Editor**.
3. Paste and run the SQL from `supabase/schema.sql`.

This creates:

- `public.users`
- `public.user_profiles`
- `public.opportunities`
- `public.user_documents`
- `public.user_opportunity_matches`
- `public.action_steps`
- private Storage bucket `opendo-documents`
- legacy `public.opendo_json_store`, kept only for migration/rollback while old data is moved

## 2. Get API Values

In Supabase, open **Project Settings** -> **API** and copy:

- Project URL
- `service_role` key

Use the `service_role` key only in the server or Render environment. Do not paste it into frontend code.

## 3. Configure Render

Add these environment variables to the Render Web Service:

```text
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service_role key>
SUPABASE_STORAGE_BUCKET=opendo-documents
```

Optional, only needed if migrating from the legacy JSON bridge:

```text
SUPABASE_JSON_TABLE=opendo_json_store
```

Keep these unset on Render Free:

```text
DATA_DIR=
UPLOADS_DIR=
```

The app automatically uses Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present. If they are missing, it falls back to local JSON files.

## 4. Migrate Existing Supabase JSON Rows

If your current Supabase project already has data inside `opendo_json_store`, run this locally after setting the Supabase env vars:

```sh
npm run migrate-supabase-json-store
```

This reads the old JSON rows and writes them into the structured tables.
It only inserts or updates matching records; it does not delete structured-table rows that are not present in the old JSON bridge.

If you intentionally want to copy local JSON records from `src/data` into Supabase instead, run:

```sh
npm run migrate-json-to-supabase
```

Do not import local test users or private data unless you really want them in the Supabase project.
This import also inserts or updates records only.

## 5. Redeploy

After setting the Render environment variables, redeploy the latest commit.

Smoke checks:

- Register or log in.
- Save a profile.
- Research an opportunity.
- Recalculate matches.
- Upload and delete a document.
- Restart/redeploy the Render service and confirm saved data remains.
- In Supabase Table Editor, confirm rows appear in the structured tables, not only in `opendo_json_store`.
