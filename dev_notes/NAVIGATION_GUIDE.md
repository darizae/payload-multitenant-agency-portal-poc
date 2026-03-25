# Navigation Guide (Phase 2)

This walkthrough validates the Postgres + store-analytics expansion.

## Start-up

1. `npm install`
2. `npm run bootstrap`
3. `npm run dev`
4. Open `http://localhost:3000/login`

Run only one `npm run dev` process for this repo at a time.

Role-specific login pages:

- `http://localhost:3000/login/storehero-root`
- `http://localhost:3000/login/storehero-member`
- `http://localhost:3000/login/agency-root`
- `http://localhost:3000/login/agency-member`
- `http://localhost:3000/login/store-root`
- `http://localhost:3000/login/store-member`

## Key seeded users

- `storehero.root@poc.local` / `Passw0rd!Demo`
- `storehero.member@poc.local` / `Passw0rd!Demo`
- `aurora.agency+root@poc.local` / `Passw0rd!Demo`
- `aurora.agency+member@poc.local` / `Passw0rd!Demo`
- `aurora.bikes+root@poc.local` / `Passw0rd!Demo`
- `aurora.bikes+member@poc.local` (invited; activate first)

Role-specific login pages enforce role match. If you log in on the wrong role page, the session is rejected and you must use the matching route (or generic `/login`).

## Walkthrough

### 1) Storehero scope

Login as `storehero.root@poc.local`.

Go to `/dashboard/storehero` and verify:

- all agencies are visible
- all stores are visible
- cross-tenant analytics renders with filters and previous-period deltas

### 2) Agency scope

Login as `aurora.agency+root@poc.local`.

Go to `/dashboard/agencies/<aurora-id>` from Agencies list and verify:

- only Aurora stores/users are visible
- create store and invite agency/store users from the forms
- agency analytics renders tenant-scoped results only

### 3) Assignment-limited agency member

Login as `aurora.agency+member@poc.local`.

Verify:

- only assigned stores are visible
- unassigned stores are hidden
- analytics respects assignment scope

### 4) Store scope

Login as `aurora.bikes+root@poc.local`.

Go to `/dashboard/stores/<aurora-bikes-id>` and verify:

- only own store users are visible/manageable
- store analytics renders only own store data

### 5) Invite activation

- open latest invite token shown in UI or Payload admin
- visit `/activate-invite/<token>`
- set password
- login with invited account

## DB inspection

- Adminer: `http://localhost:8080`
- Payload admin: `http://localhost:3000/admin`

Inspect these tables/collections:

- `agencies`
- `stores`
- `users`
- `agency-store-assignments`
- `store-daily-metrics`
- `invite-tokens`
- `audit-logs`

## Quick checks

- Cross-agency reads are blocked for agency/store users.
- Removing last active `agency-root` is blocked.
- Removing last active `store-root` is blocked.
- `store-daily-metrics` reads are role-scoped by tenant/store.

If auth appears stuck locally, run:

1. `npm run db:reseed`
2. restart `npm run dev`
