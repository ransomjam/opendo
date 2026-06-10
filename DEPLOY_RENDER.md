# Deploying Opendo on Render Free

Opendo can run on Render's free Web Service tier as a demo. Free web services do not support persistent disks, so local JSON data and uploaded documents can reset after restart or redeploy.

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

Do not add a disk. Do not set `DATA_DIR` or `UPLOADS_DIR` for the free demo.

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
```

Do not set `PORT`; Render provides it.

## First Run

For a demo, you can create the first admin from Render Shell:

```sh
ADMIN_FULL_NAME="Admin User" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="replace-this" npm run create-admin
```

Because this is a free demo without persistent storage, the admin account can disappear after restart or redeploy. Re-run the command when needed.

## Smoke Checks

After deploy:

- Open `/api/health` and expect `200`.
- Open `/api/assistant/status` and confirm `providers` only contains `gemini`.
- Open `/` and confirm the dashboard loads.
- Register or create an admin account, sign in, and try a profile update.
