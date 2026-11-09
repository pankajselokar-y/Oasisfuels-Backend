# Deploying the Oasis Fuel Rewards API

Express + Prisma + PostgreSQL on **Render**.

## Deploy on Render

You already have a Render PostgreSQL database. This repository has a Blueprint (`render.yaml`) that creates the web service.

1. Render dashboard → **New → Blueprint** → connect this GitHub repository → pick the `main` branch.
2. Render reads `render.yaml` and asks for its secrets:
   - `DATABASE_URL` → your database's **Internal** URL (dashboard → your PostgreSQL → *Connections* → *Internal Database URL*).
     Use the Internal URL here (same region as the service); the External URL is only for your own PC and needs `?sslmode=require`.
   - `FAST2SMS_API_KEY` → leave blank. It is only used if you later set `OTP_ENABLED=true` to turn SMS verification on (use a *new* key then).
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
- `render.yaml` uses the **Starter** plan because pre-deploy migrations need a paid plan. Its persistent disk (`/var/data`) now only holds fuel-proof photos saved before they moved into the database; new photos are stored in PostgreSQL.
- On the **Free** plan the service sleeps after 15 minutes idle (the first request then takes ~30–60 s, longer than the app waits). Fine for a quick demo only: delete the `disk:` block and `preDeployCommand`, and put `npm run db:deploy` at the end of `buildCommand`.
- Render's free PostgreSQL expires after 30 days. Upgrade it before then or you lose the data.

## Check it
- Open `https://<your-service>.onrender.com/api/v1/health` → `{"data":{"status":"ok","database":"up"}}`.
- Staff login: `admin` / `cashier` (passwords from `SEED_ADMIN_PASSWORD` / `SEED_CASHIER_PASSWORD`, defaults `admin123` / `cashier123` — change them).
- Watch **Render → your service → Logs**: every request and every OTP/SMS result is logged.

## Updating later
Push to `main` → Render redeploys automatically (and applies new migrations).

Your API base URL is `https://<your-service>.onrender.com/api/v1` — put it in the Expo app's `EXPO_PUBLIC_API_URL` (see the app repository's `DEPLOY.md`).

## Deploying on Vercel (alternative to Render)

`vercel.json`, `api/index.js` and `public/` make this repository deployable on Vercel as a serverless function. In the
Vercel project settings use **Framework Preset: Other** and leave the build/output settings empty (they come from `vercel.json`).

Environment variables (Project → Settings → Environment Variables, enable for Production **and** Preview):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Render's **External** URL with `?sslmode=require` (Vercel cannot use the internal one) |
| `JWT_SECRET` | a random string of at least 32 characters |
| `OTP_ENABLED` | leave unset (SMS verification is off). `true` also needs `FAST2SMS_API_KEY` |
| `CORS_ORIGINS` | `*`, or your app's origins separated by commas |

Database migrations are **not** run by Vercel. Run them from your machine whenever the schema changes:
`npm run db:deploy` (with `DATABASE_URL` pointing at the database).

Limits compared with Render:
- Fuel-proof photos are stored in the database (about 70 KB each), so they persist on Vercel. Run `npm run db:deploy` **before**
  deploying a version that adds the photo column (migration `store_photos_in_database`). Photos from before that migration were files
  and are gone unless they were on Render's disk.
- Rate limits are counted per serverless instance, so they are weaker than on a single server.
- Each instance keeps at most 3 database connections.
