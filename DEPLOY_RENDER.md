# Deploying Opendo on Render

Opendo deploys as one Render Web Service: Express serves both the static HTML pages and the API.

## Render Service

Use the included `render.yaml` blueprint or create the service manually with these settings:

- Service type: Web Service
- Runtime: Node
- Plan: paid plan with a persistent disk
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`
- Disk mount path: `/var/data/opendo`
- Initial disk size: `1 GB`

Render's non-disk filesystem is ephemeral. Keep `DATA_DIR` and `UPLOADS_DIR` under the mounted disk path.

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
DATA_DIR=/var/data/opendo/data
UPLOADS_DIR=/var/data/opendo/uploads
AUTO_SAVE_RESEARCH_RESULTS=true
AUTO_MATCH_RESEARCH_RESULTS=true
```

Do not set `PORT`; Render provides it.

## First Run

Start production with a clean slate. The app creates empty JSON files under `DATA_DIR` as each feature is used.

Create the first admin from Render Shell or a one-off job:

```sh
ADMIN_FULL_NAME="Admin User" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="replace-this" npm run create-admin
```

Use a strong temporary password, sign in, then rotate it through your normal admin process.

## Smoke Checks

After deploy:

- Open `/api/health` and expect `200`.
- Open `/api/assistant/status` and confirm `providers` only contains `gemini`.
- Register or create the admin user, sign in, create a profile, upload a document, delete it, and recalculate matches.
- Redeploy or restart the service and confirm the user/profile JSON data remains under the persistent disk.
