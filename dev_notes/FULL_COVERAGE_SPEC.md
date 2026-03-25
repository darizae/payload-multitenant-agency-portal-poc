# Full Coverage Functional Specification — Phase 2 (Postgres + Store Analytics)

## Purpose

Extend the existing multitenant user-management POC to prove tenant-scoped BI analytics behavior with a production-like Postgres runtime.

## Locked architecture decisions

- Postgres adapter in Payload (`@payloadcms/db-postgres`)
- Docker Compose runtime with:
  - `postgres`
  - `adminer`
- Single login page; role-based routing after authentication
- Tenant-themed UI (agency branding), no domain/subdomain routing in this phase
- Destructive reseed workflow (`db:reseed`) as the canonical reset path
- No backwards compatibility with SQLite/customer-era schema

## Canonical role model

- `storehero-root`
- `storehero-member`
- `agency-root`
- `agency-member`
- `store-root`
- `store-member`

### Role semantics

- `storehero-root`: full platform control
- `storehero-member`: cross-tenant operator; cannot manage Storehero root/member accounts
- `agency-root`: full agency control
- `agency-member`: assignment-scoped by default; can be agency-wide if `hasGlobalStoreAccess=true`
- `store-root`: own store administration
- `store-member`: own store access with no admin privileges

## Canonical collections

- `agencies` (tenant entity)
- `stores`
- `users`
- `agency-store-assignments`
- `invite-tokens`
- `audit-logs`
- `store-daily-metrics`

## Analytics model

`store-daily-metrics` fields:

- `tenant` -> relationship to `agencies`
- `store` -> relationship to `stores`
- `source` -> `shopify` (only source in v1)
- `metricDate` -> UTC day
- `netSales`
- `grossProfit`
- `marketingAdSpend`
- `mer`

Uniqueness constraint:

- `(tenant, store, metricDate)` must be unique

## Analytics query contract

Request:

- `from`
- `to`
- `granularity` (`day|week|month|year`)
- optional `storeId`

Response:

- `totalsCurrent`
- `totalsPrevious`
- `deltas`
- `buckets[]`

Comparison mode:

- Previous equal period only

## Seed data requirements

- 3 agencies
- 5 stores per agency (15 total)
- Role-based users for each agency/store
- Assignment rows for agency members
- One invited store-member account
- Metrics fixture from committed parquet:
  - `data/fixtures/shopify_metrics_daily.parquet`
  - 10,950 rows (3 × 5 × 730)

## Data generation workflow

- Python generator script:
  - `scripts/data/generate_shopify_metrics_parquet.py`
- Python deps:
  - `scripts/data/requirements.txt`
- Seed importer loads parquet rows into Payload local API (`store-daily-metrics`)

## Access expectations

- Agency isolation enforced across stores, users, metrics
- Store users only access own store data
- Agency members limited to assigned stores unless global store access flag is enabled
- Storehero roles can operate cross-tenant

## UI expectations

- `/dashboard` performs role-based redirect
- Storehero workspace: `/dashboard/storehero`
- Agency workspace: `/dashboard/agencies/:agencyId`
- Store workspace: `/dashboard/stores/:storeId`
- Analytics UI in Storehero, Agency, and Store workspaces:
  - date range
  - granularity
  - store filter
  - KPI cards (current vs previous)
  - chart
  - tabular bucket breakdown

## Acceptance checklist

- `npm run db:reseed` succeeds from clean Docker runtime
- `npm run check` succeeds
- `npm run build` succeeds with Postgres running
- Payload admin CRUD works on updated collections
- Adminer can inspect Postgres data
- Tenant/store metrics are role-scoped correctly
