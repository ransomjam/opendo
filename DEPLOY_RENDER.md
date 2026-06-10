# Deploying Opendo on Render Free

Opendo can run on Render's free Web Service tier. Free web services do not support persistent disks, so use Supabase for durable app data and uploaded documents.

## Create the Service

Create the service manually instead of using a Render Blueprint.

- Render menu: **New +** -> **Web Service**
- Repository: `ransomjam/opendo`
- Branch: `main`
- Runtime: `Node`
- Plan: `Free`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

Do not add a disk. Do not set `DATA_DIR` or `UPLOADS_DIR` on Render Free.

## Environment Variables

Configure these in Render. Do not upload or commit `.env`.

```text
NODE_ENV=production
AI_ENABLED=true
GEMINI_API_KEY=<rotated production key>
GEMINI_RESEARCH_MODEL=gemini-2.5-flash
GEMINI_WRITING_MODEL=gemini-2.5-flash
JWT_SECRET=<strong random secret>
JWT_EXPIRES_IN=7d
AUTO_SAVE_RESEARCH_RESULTS=true
AUTO_MATCH_RESEARCH_RESULTS=true
ADMIN_FULL_NAME=Admin User
ADMIN_EMAIL=<your admin email>
ADMIN_PASSWORD=<strong admin password>
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service_role key>
SUPABASE_JSON_TABLE=opendo_json_store
SUPABASE_STORAGE_BUCKET=opendo-documents
```

Do not set `PORT`; Render provides it.

## First Run

Before deploying, run `supabase/schema.sql` in Supabase SQL Editor and set the Supabase environment variables above. See `SUPABASE_SETUP.md`.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render before deploying. On every startup, the app creates that admin user if missing, or promotes/resets that user if it already exists.

If Supabase is not configured, Render Free stores data on temporary local disk and it can disappear after restart or redeploy.

## Smoke Checks

After deploy:

- Open `/api/health` and expect `200`.
- Open `/api/assistant/status` and confirm `providers` only contains `gemini`.
- Open `/` and confirm the dashboard loads.
- Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Try `/api/documents` only after logging in; unauthenticated requests should return `401`, not static-host `404`.
- Restart/redeploy and confirm users, profiles, matches, opportunities, and document metadata remain.

## Common Free-Tier Issues

- `401` on `/api/profile`, `/api/documents`, `/api/dashboard/summary`, or `/api/matches`: log out and log back in. If Supabase is not configured, Render Free restarts can reset local JSON users while your browser still has an old token.
- `401` on `/api/auth/login`: confirm `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in Render Environment, then redeploy.
- `Gemini research failed`: confirm `GEMINI_API_KEY`, `GEMINI_RESEARCH_MODEL`, and `GEMINI_WRITING_MODEL` are set in Render Environment. Check Render logs for the exact Gemini error.
- `Supabase read/write failed`: confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the SQL schema from `supabase/schema.sql`.
