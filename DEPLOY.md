# Deploying the Oasis Fuel Rewards API

Express + Prisma + PostgreSQL on **Render**.

## Deploy on Render

You already have a Render PostgreSQL database. This repository has a Blueprint (`render.yaml`) that creates the web service.

1. Render dashboard → **New → Blueprint** → connect this GitHub repository → pick the `main` branch.
2. Render reads `render.yaml` and asks for two secrets:
   - `DATABASE_URL` → your database's **Internal** URL (dashboard → your PostgreSQL → *Connections* → *Internal Database URL*).
     Use the Internal URL here (same region as the service); the External URL is only for your own PC and needs `?sslmode=require`.
   - `FAST2SMS_API_KEY` → your Fast2SMS key. (Use a *new* key — the old one was pasted in chat.)
3. Click **Apply**. Render builds, runs `prisma migrate deploy` (creates/updates tables), then starts the server.
   `JWT_SECRET` is generated automatically.
4. When it shows **Live**, open `https://<your-service>.onrender.com/api/v1/health` — you should see `{"data":{"status":"ok","database":"up"}}`.
5. **Seed once** (rewards, settings, admin/cashier, demo customers) from your PC, using the *External* database URL:
   ```bash
   npm run db:seed
   ```
   (`.env` → `DATABASE_URL` must be the External URL with `?sslmode=require`.) Skip this if you already seeded.

Your API base URL is `https://<your-service>.onrender.com/api/v1`.

**Costs and limits to know**
- `render.yaml` uses the **Starter** plan because fuel-proof photos need a persistent disk (`/var/data`) — Render's disk is wiped on every deploy otherwise — and pre-deploy migrations need a paid plan.
- On the **Free** plan the service sleeps after 15 minutes idle (the first request then takes ~30–60 s, longer than the app waits) and uploaded photos are lost on each deploy. Fine for a quick demo only: delete the `disk:` block and `preDeployCommand`, and put `npm run db:deploy` at the end of `buildCommand`.
- Render's free PostgreSQL expires after 30 days. Upgrade it before then or you lose the data.

## Check it
- Open `https://<your-service>.onrender.com/api/v1/health` → `{"data":{"status":"ok","database":"up"}}`.
- Staff login: `admin` / `cashier` (passwords from `SEED_ADMIN_PASSWORD` / `SEED_CASHIER_PASSWORD`, defaults `admin123` / `cashier123` — change them).
- Watch **Render → your service → Logs**: every request and every OTP/SMS result is logged.

## Updating later
Push to `main` → Render redeploys automatically (and applies new migrations).

Your API base URL is `https://<your-service>.onrender.com/api/v1` — put it in the Expo app's `EXPO_PUBLIC_API_URL` (see the app repository's `DEPLOY.md`).
