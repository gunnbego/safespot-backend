# SafeSpot Backend (Fastify + Prisma on Vercel)

Node/TypeScript rewrite of the SafeSpot Spring Boot backend, following the same
deployment model as TirGeo: one Vercel project containing the React/Vite
frontend, a Fastify API running as a Vercel Function under `/api`, PostgreSQL,
and Prisma migrations.

```
Vercel project
├─ frontend/            React/Vite SPA (unchanged from safeSpot-app)
├─ api/index.ts         Vercel Function entry → src/vercel-handler.ts → src/app.ts
├─ src/                 Fastify app (routes, plugins, lib)
├─ prisma/              schema.prisma + migrations + seed-company.ts
└─ scripts/             prisma-with-env.mjs, stage-frontend-for-vercel.mjs
```

## Stack

- Fastify 5 (helmet, cors, rate-limit, multipart, swagger at `/docs`)
- Prisma 6 + PostgreSQL (Neon/Vercel Postgres compatible)
- JWT auth (`@fastify/jwt`) — claims: `sub` (userId), `username`, `role`,
  `organisationId`, `organisationSlug`
- bcrypt password hashing (cost 12)
- New photos stored in Vercel Blob with protected API image routes; legacy
  DB-backed photos are still rendered as base64 `dataUrl` values

## API contract (unchanged for the existing frontend)

```
POST   /api/auth/register        POST /api/auth/login
POST|GET /api/auth/validate      GET  /api/auth/me
PUT    /api/auth/me              PUT  /api/auth/profile   (SPA alias)
GET    /api/users/me

GET    /api/tenant/context       GET  /api/tenant/me      (SPA alias)
GET    /api/tenant/members       POST /api/tenant/invite
PUT    /api/tenant/members/:id   PATCH /api/tenant/members/:id/password
DELETE /api/tenant/members/:id

GET|POST /api/teams              GET /api/teams/me
GET|PUT|DELETE /api/teams/:id

POST   /api/audits               (JSON, or multipart: "audit" + "photos")
GET    /api/audits/mine          GET /api/audits/team
GET    /api/audits/team/:teamId  GET /api/audits/:id
PATCH  /api/audits/:id/resolve   (JSON, or multipart: "resolution" + "photos")
```

Business rules preserved: strict tenant isolation from JWT claims (never from
the request body); members submit reports only for their own team and see other
creators as `anonymous`; managers/owners see all organisation reports, resolve
reports, and manage users/teams; first registered user of an organisation
becomes MANAGER; an organisation with no manager promotes the next login.
`OWNER` is presented as `MANAGER` on the wire so the untouched frontend keeps
working. Photo purpose is `HAZARD` (creation) or `RESOLUTION` (resolve).

## Local development

```bash
npm install
cp .env.example .env             # set DATABASE_URL + JWT_SECRET (32+ chars)
npm run db:migrate               # prisma migrate dev
npm run dev                      # Fastify on :3000

npm --prefix frontend install
npm --prefix frontend run dev    # Vite on :4173, proxies /api → :3000
```

## Database workflow (TirGeo-style)

```bash
npm run db:migrate               # create/apply migrations in dev
npm run db:migrate:deploy        # apply committed migrations
npm run db:migrate:status
npm run db:seed:company          # idempotent company/user seed
```

`scripts/prisma-with-env.mjs` picks the first Postgres URL from:
`DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, or the
`safespot_db_prod_*` equivalents, so it works with Vercel/Neon env pulls.

### Seeding safety-man / jimmcd

```bash
SEED_COMPANY_SLUG="safety-man" SEED_COMPANY_NAME="safety-man" \
SEED_USER_NAME="jimmcd" SEED_USER_PASSWORD="rallye123" SEED_ROLE="MANAGER" \
npm run db:seed:company
```

Or against production via Vercel env:

```bash
npx vercel env run -e production -- sh -c 'SEED_COMPANY_SLUG="safety-man" SEED_COMPANY_NAME="safety-man" SEED_USER_NAME="jimmcd" SEED_USER_PASSWORD="rallye123" npm run db:seed:company'
```

The seed upserts the organisation (tier `pro`, status `active`), a default
"Safety Management" team, and the user (bcrypt-hashed password, assigned to the
team), so re-running it is safe.

## Deployment

```bash
npm run vercel-build   # builds frontend → frontend/dist → public/, prisma generate, tsc
npx vercel --prod
```

Required Vercel env vars: a Postgres URL (any of the names above, e.g. from the
attached Neon/Vercel Postgres integration), `JWT_SECRET`, and
`BLOB_READ_WRITE_TOKEN` from the connected Vercel Blob store. No
`SAFESPOT_BACKEND_URL` proxy is needed — the API runs inside Vercel as `/api`
(`vercel.json` rewrites `/api/(.*)` → `/api/index` and everything else →
`/index.html`).
