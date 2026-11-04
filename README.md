# Pump Rewards — Backend API

REST API for the Pump Rewards fuel-loyalty app. **Express 5 · Prisma 7 · PostgreSQL · Zod · JWT**, written in TypeScript.
It implements the business rules that currently live in the Expo app's local storage (`src/storage/*` in the Expo app repository), so the app can
move from on-device data to a shared database.

## Quick start

```bash
cp .env.example .env            # then edit DATABASE_URL / JWT_SECRET if needed
docker compose up -d            # local PostgreSQL 16 (or point DATABASE_URL at your own server)
npm install                     # also generates the Prisma client
npm run db:migrate              # creates the tables
npm run db:seed                 # reward catalog, settings, demo staff + customers
npm run dev                     # http://localhost:4100/api/v1
```

Check it: `curl http://localhost:4100/api/v1/health`

> **Database encoding must be UTF-8** (reward icons are emoji). Docker's image already is. With a native Windows
> install, create the database with `CREATE DATABASE pump_rewards ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C';`.

Demo logins after seeding: staff `admin` / `admin123` and `cashier` / `cashier123` (change via `SEED_*_PASSWORD`);
customers `9876543210`, `9123456780`, `9999999999` with PIN `1234`.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with reload (`tsx watch`) |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:migrate` | Create/apply a dev migration and regenerate the client |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:seed` | Idempotent seed |
| `npm run db:studio` | Browse data in Prisma Studio |

## Architecture (MVC + service layer)

```
prisma/schema.prisma            data model (+ migrations/, seed.ts)
src/
  routes/        URL → middleware chain → controller        (what is reachable, and by whom)
  controllers/   thin HTTP adapters: read request, call a service, shape the response
  services/      business rules and transactions            (the frontend's logic lives here)
  models/        all Prisma queries, one module per entity  (the only code that touches the database)
  utils/serializers.ts   "views": JSON shapes returned to clients (never includes PIN/password hashes)
  validators/    Zod schemas for params / query / body
  middlewares/   authenticate, requireRole, validate, upload, rate limits, error handler
  config/ lib/   env parsing, Prisma client, JWT, password hashing, photo storage
```

A request flows `route → validate → controller → service → model → PostgreSQL`, and back through a serializer.
Balance changes happen in one place (`services/points.service.ts`) inside a `prisma.$transaction`, so a balance and its
ledger row always commit together.

## Roles

| Role | Signs in with | Can |
|---|---|---|
| `CUSTOMER` | phone + 4-digit PIN | own profile, vehicles, history; request rewards; submit fuel proofs |
| `CASHIER` | username + password | record fuel entries; manage customers; review fuel proofs and redemption requests |
| `ADMIN` | username + password | everything a cashier can **except recording fuel**; plus dashboard, issue log, staff accounts, settings |

Staff accounts are created by an admin, never by sign-up. Disabling a staff member revokes their access immediately
(staff are re-checked in the database on every request, not only when the token expires).

## API reference (`/api/v1`)

Send `Authorization: Bearer <token>`. Success: `{ "data": …, "meta"?: … }`. Error: `{ "error": { "code", "message", "details"? } }`.
List endpoints take `?page=&pageSize=` and return `meta: { page, pageSize, total, totalPages }`.

**Auth**
| | |
|---|---|
| `POST /auth/register/check` | `{ phone, vehicle?, referralCode? }` — runs the sign-up rules that don't need the code (number free, vehicle format, referral valid), so the app can reject bad details *before* a paid SMS is sent |
| `POST /auth/otp/send` | `{ phone, purpose: "REGISTER" \| "RESET_PIN" }` — texts a 6-digit code (see *SMS & OTP*) |
| `POST /auth/otp/verify` | `{ phone, purpose, otp }` — checks a code **without using it up** (200 `{ verified: true }`, or 400 `Incorrect code.`); optional pre-check; `register` verifies the code itself |
| `POST /auth/customer/register` | `{ name, phone, pin, otp?, vehicle?: { number, model? }, referralCode? }` — `otp` (the code sent to `phone`) is only required when `OTP_ENABLED=true`; referrer earns the bonus |
| `POST /auth/customer/reset-pin` | `{ phone, otp, newPin }` — forgot-PIN, after `otp/send` with `RESET_PIN` |
| `POST /auth/customer/login` | `{ phone, pin }` → `{ token, refreshToken, customer }` |
| `POST /auth/staff/login` | `{ username, password }` → `{ token, refreshToken, staff }` |
| `POST /auth/refresh` | `{ refreshToken }` → a new `{ token, refreshToken }` pair. The access `token` lasts 1 hour; the refresh token lasts 30 days from last use and works **once** (each refresh issues a new one). Re-using an old one after 30 s ends every session of that account |
| `POST /auth/logout` | `{ refreshToken }` — ends this device's session |
| `GET /auth/me` | who am I (customer incl. dashboard stats, or staff) |

**Customer (own account)** — role `CUSTOMER`
| | |
|---|---|
| `GET /me`, `PATCH /me` | profile + tier + `stats { redeemedCount, pendingPoints, availablePoints }`; rename |
| `PATCH /me/pin` | `{ currentPin, newPin }` |
| `GET /me/history` | points ledger, newest first |
| `GET/POST /me/vehicles`, `PATCH/DELETE /me/vehicles/:vehicleId` | multiple vehicles; plate format validated |
| `GET /fuel-claims/mine` | my fuel proofs (recorded by the cashier with each fill-up) and their status |
| `POST /redemption-requests` | `{ rewardId }` |
| `GET /redemption-requests/mine` | my requests |
| `GET /rewards` | the reward catalog (any signed-in user) |

**Staff** — `CASHIER` or `ADMIN`
| | |
|---|---|
| `GET /customers?search=` | by name, phone or vehicle number |
| `POST /customers` | register a walk-in customer (default PIN unless given) |
| `GET /customers/:id`, `GET /customers/:id/history` | profile + ledger |
| `GET /fuel-claims?status=`, `GET /fuel-claims/:id`, `GET /fuel-claims/:id/photo` (add `?as=dataUri` for JSON) | review queue |
| `POST /fuel-claims/:id/approve` | `{ amountRupees? }` — credits points (defaults to the claimed amount) |
| `POST /fuel-claims/:id/reject` | `{ reason? }` — the reason is shown to the customer next to the rejected proof |
| `GET /redemption-requests?status=` | queue |
| `POST /redemption-requests/:id/approve` \| `/reject` | approve deducts points and issues the item |
| `PATCH /staff/me/password` | `{ currentPassword, newPassword }` |

**Cashier only**
| | |
|---|---|
| `POST /fuel-entries` | `{ customerId, amountRupees }` **or** `{ customerId, litres }`, plus `proof: { vehicleId \| vehicleNumber, latitude, longitude, accuracy?, photoDataUri }` (the dashboard photo as a base64 data URI). → points + `unlockedRewards`. The proof is stored as an already-approved fuel proof; the app always sends it |

**Admin only**
| | |
|---|---|
| `GET /reports/dashboard` | totals, pending counts, items issued in the last 45 days |
| `GET /reports/issued-items?days=45` (or `?from=YYYY-MM-DD&to=YYYY-MM-DD` for a custom range) | items handed over; `days` = a number or `all`; includes summary and per-item counts |
| `GET/POST /staff`, `PATCH /staff/:id`, `PATCH /staff/:id/active` | manage staff (edit name/username/password; enable/disable) |
| `PATCH /settings` | `fuelRatePerLitre`, `minFuelAmountRupees`, `referralBonusPoints` (`GET /settings` is public, so the sign-up screen can show the real bonus) |

## Business rules (ported from the app)

- **Points:** 1 point per litre; `points = round(₹ ÷ rate)`. Rate default ₹100/ltr, minimum ₹500 per entry (both admin-editable).
- **Loyalty tiers** from *lifetime* points: Bronze 0 · Silver 5 000 · Gold 20 000 · Platinum 50 000 (spending never lowers a tier).
- **Referral:** a customer's referral code is their phone number. Signing up with a valid code pays **both** people the bonus
  (default 100 points each, admin-editable): the referrer gets a *Referral bonus* and the new customer a *Welcome bonus*, in the same
  transaction as the account. A self-referral or unknown code is rejected and nothing is created (the SMS code stays usable,
  so the customer can correct it). Walk-in customers registered by a cashier with a referral code earn it too.
- **Vehicles:** `MH 36 AD 2861`, `MH 48 D 9886` and Bharat-series `22 BH 8667 CD` formats; stored spaced and uppercased; unique per customer.
- **Redemption:** customers *request*; points are deducted only when staff approve. Points promised to pending requests aren't
  spendable twice, a customer can't have two pending requests for one reward, and an approval can't overdraw (`CHECK points >= 0`).
- **Fuel proofs:** only cashiers create them, as part of recording a fill-up: vehicle + amount + dashboard photo + GPS. The proof is
  stored already approved (the cashier vouches for it) and shows in the customer's history. A fill-up that fails (bad plate,
  amount below the minimum, not an image...) records nothing and leaves no photo behind. Proofs submitted by customers before
  this change can still be approved or rejected by staff. Photos are checked by file signature (JPEG/PNG/WebP, ≤ 5 MB) and
  stored under `UPLOAD_DIR`.
- **Issue log:** nothing is ever deleted — the points ledger and redemption rows are append-only/retained — so the 45-day window
  (or any other) can always be answered.
- **Audit trail:** ledger rows, approvals and rejections record which staff member did them.

## SMS & OTP (Fast2SMS)

> **SMS is switched OFF by default** (`OTP_ENABLED=false`). The app then works without sending any SMS: sign-up needs no code
> (`otp` is optional and ignored), `POST /auth/otp/send`, `/auth/otp/verify` and `/auth/customer/reset-pin` answer **503 `OTP_DISABLED`**,
> and a customer who forgot their PIN asks a cashier/admin, who sets a new one with `POST /customers/:id/reset-pin { newPin }`
> (this also signs the customer out on every device). `GET /settings` returns `otpEnabled` so the app can hide the SMS steps.
> Set `OTP_ENABLED=true` (plus `FAST2SMS_API_KEY`) to bring the flows below back; no code changes are needed.
>
> **Mobile numbers:** anything that creates an account (sign-up, `register/check`, `otp/send`, staff-created customers) requires a
> 10-digit Indian mobile number starting with 6, 7, 8 or 9. Logging in accepts any 10 digits so older accounts keep working.

Customers prove they own a phone number with a one-time code, both to **register** and to **reset a forgotten PIN**.
Staff-registered walk-in customers (`POST /customers`) skip this — the cashier vouches for them.

```
POST /auth/otp/send  { phone, purpose }          →  { sent, expiresInSeconds, resendInSeconds }
POST /auth/otp/verify { phone, purpose, otp }    →  { verified: true }   (does not consume the code)
POST /auth/customer/register  { …, otp }         →  account + token
POST /auth/customer/reset-pin { phone, otp, newPin }
```

**Expo app:** the sign-up screen calls `send` and `verify` through `src/api/otp.js` in the Expo app repository. Point the app at this server with
`EXPO_PUBLIC_API_URL` in the app's `.env.local` (see its `.env.example`) and restart Expo with `npx expo start -c`.
A real phone needs your PC's Wi-Fi IP (not `localhost`), and Windows Firewall must allow port 4100.

- **Setup:** put your key in `.env` as `FAST2SMS_API_KEY` (Fast2SMS → *Settings → API Key*). It is only ever read from the environment.
  On Render, add it under *Environment*. In production the server refuses to start without it.
- **Without a key** (local development) nothing is sent or charged: the code is printed in the server console and returned as `devOtp`.
  `devOtp` is never returned when a real SMS is sent.
- **Transport:** Fast2SMS *Quick SMS* route (`route=q`, ~₹7 per SMS on your plan), which needs no DLT template.
  Fast2SMS's dedicated OTP API needs an approved DLT OTP template (`otp_id`) and KYC; once DLT registration completes, only
  `src/lib/sms.ts` needs to change — the OTP rules below live in `src/services/otp.service.ts`.
- **Fast2SMS error 999** means the account needs a single wallet recharge of at least ₹100 before the API works.
  Errors from Fast2SMS (low balance, bad key, …) are logged on the server and returned to the client as a generic 502.
- **Rules:** 6 digits · valid 5 minutes · 5 wrong guesses kill the code · one use · a new code replaces the old one ·
  30 s between codes · 5 codes per phone per hour · 15 sends per IP per hour. Only a keyed hash of each code is stored.
  A forgot-PIN request for an unregistered number looks identical to a real one, so numbers cannot be enumerated.

## Security notes

- PINs/passwords are bcrypt-hashed; login failures are generic and rate-limited **per account** (10 failures / 15 min) and per IP.
  A 4-digit PIN is inherently weak — the limiter is what protects it. Behind a reverse proxy, set `app.set('trust proxy', …)`.
- Set a strong `JWT_SECRET` (≥ 32 chars is enforced in production) and a specific `CORS_ORIGINS`.
- Change the seeded demo passwords/PINs before any real deployment.
- Fuel photos are served only to staff and to the customer they belong to. Customers cannot upload them: only cashiers do, with a fuel entry.

## Connecting the Expo app

The app still uses on-device storage; nothing here changes it. To switch, replace the `src/storage/*` modules with API calls
(`customerStore` → `/auth`, `/me`, `/customers`; `requestStore` → `/redemption-requests`; `fuelClaimStore` → `/fuel-claims`;
`staffStore` → `/staff`, `/auth/staff/login`). Fuel-entry photos go up as a base64 `data:` URI inside the JSON body.
