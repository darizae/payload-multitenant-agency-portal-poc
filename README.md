# Payload Multi-Tenant Agency Portal POC (Phase 2)

A runnable multitenant POC that demonstrates tenant-scoped user management and Shopify-style BI analytics on Postgres.

## Stack

- Payload CMS v3.80
- Next.js App Router
- Postgres 16 (Docker)
- Adminer for DB inspection
- Material UI portal
- Parquet synthetic metrics fixture generated with Python

## What this POC demonstrates

- Agency tenants with strict tenant isolation
- Role model:
  - `storehero-root`
  - `storehero-member`
  - `agency-root`
  - `agency-member`
  - `store-root`
  - `store-member`
- Store scoping with assignment overlays for agency members
- Invite activation flow
- Agency/store/user CRUD with Payload access + hooks
- Daily Shopify metrics (`store-daily-metrics`) scoped by tenant/store
- BI dashboard filters:
  - date range
  - granularity (`day|week|month|year`)
  - store selector
  - previous equal period comparison
- Tenant-specific theming after login via agency branding fields

## Bootstrap

1. Install dependencies

```bash
npm install
```

2. (Optional) Regenerate parquet fixture

```bash
python3 -m pip install -r scripts/data/requirements.txt
npm run data:generate
```

3. Bootstrap the app (resets DB volume, waits for Postgres, generates types/import map, seeds data)

```bash
npm run bootstrap
```

`bootstrap` is destructive by design for this phase and always rebuilds the local DB state from seed.

4. Start dev server

```bash
npm run dev
```

Keep a single `next dev` process for this workspace.

5. Open:

- Portal: `http://localhost:3000/login`
- Payload admin: `http://localhost:3000/admin`
- Adminer: `http://localhost:8080`

## DB Ops Commands

```bash
npm run db:up
npm run db:down
npm run db:reset
npm run db:status
npm run db:poll
npm run db:logs
npm run db:reseed
```

## Runtime DB behavior

- Runtime commands (`dev`, `build`, `start`) run with `PAYLOAD_PUSH_SCHEMA=false`.
- Schema push is enabled only for seeding/bootstrap (`PAYLOAD_PUSH_SCHEMA=true` in `seed`).
- If local state is inconsistent, run `npm run db:reseed`.

## Seeded credentials

All seeded active users use:

```text
Passw0rd!Demo
```

Primary accounts:

- `storehero.root@poc.local` (`storehero-root`)
- `storehero.member@poc.local` (`storehero-member`)
- `aurora.agency+root@poc.local` (`agency-root`)
- `aurora.agency+member@poc.local` (`agency-member`)
- `aurora.bikes+root@poc.local` (`store-root`)

Pending invite demo account:

- `aurora.bikes+member@poc.local` (`store-member`, invited)

Activate with:

`/activate-invite/<token>`

Find token in the agency/store workspace invite list or in Payload admin (`invite-tokens`).

## Data model highlights

- `agencies`
- `stores`
- `users`
- `agency-store-assignments`
- `store-daily-metrics`
- `invite-tokens`
- `audit-logs`

Synthetic metrics fixture:

- `data/fixtures/shopify_metrics_daily.parquet`
- 10,950 rows (3 agencies × 5 stores × 730 days)

## Quality gates

```bash
npm run check
npm run build
```

## Notes

- This phase is intentionally breaking versus the original SQLite/customer model.
- Postgres is the source of truth for local and deployment-like behavior.
- Source dimension is Shopify-only in this phase.
