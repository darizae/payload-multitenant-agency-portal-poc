# Payload Multi-Tenant Agency Portal POC

A fully runnable proof-of-concept for the multi-tenant agency / customer user-management model described in the supplied draft spec and transcript.

This repo uses:

- Payload CMS v3 on the current stable 3.79 line
- Next.js App Router
- SQLite for a zero-infrastructure local run
- A custom Material UI portal for the operational workflow
- Payload's own admin for backend inspection and direct CRUD

## What this prototype demonstrates

- Agency as the top-level tenant
- Agency users scoped to one agency
- Customers scoped to one agency
- Customer users scoped to one customer
- Assignment-based visibility for restricted agency users
- Invite-based user creation flow
- Last-admin protections for agency admins and customer admins
- Audit logging for key mutations and logins
- A runnable MUI portal plus the Payload admin UI

## Boot the app

1. Install dependencies

```bash
npm install
```

2. Generate Payload types/import map and seed the SQLite database

```bash
npm run bootstrap
```

3. Start the app

```bash
npm run dev
```

4. Open the app

- MUI portal: `http://localhost:3000/login`
- Payload admin: `http://localhost:3000/admin`

## Demo credentials

All seeded accounts use the password:

```text
Passw0rd!Demo
```

Main demo logins:

- `platform.admin@poc.local` — platform admin
- `alpha.admin@poc.local` — agency admin
- `alpha.manager@poc.local` — agency manager
- `alpha.user@poc.local` — restricted agency user
- `store1.admin@poc.local` — customer admin
- `store1.user@poc.local` — customer standard user

There is also a pending invite account created during seed:

- `pending.invite@poc.local`

To activate it, sign in as a privileged user, inspect the latest invite token in the agency/customer view, then open the shown `/activate-invite/<token>` URL.

## Project structure

- `payload.config.ts` — Payload configuration and SQLite adapter
- `src/collections` — collections for agencies, users, customers, assignments, invites, audit logs
- `src/lib/rules.ts` — business-rule engine used in hooks and tests
- `src/lib/actions/portal.ts` — server actions for MUI portal workflows
- `scripts/seed.ts` — idempotent seed data
- `dev_notes/FULL_COVERAGE_SPEC.md` — authoritative implementation spec
- `dev_notes/NAVIGATION_GUIDE.md` — walkthrough showing how to demonstrate the POC

## Useful commands

```bash
npm run dev
npm run build
npm run start
npm run seed
npm run typecheck
npm run test
npm run check
```

## Notes on UI

The custom portal is intentionally Material UI based and tuned for slim, readable forms and tables. Payload's own generated admin UI remains available for direct CRUD, debugging, and validating that the schema and hooks are really powered by Payload rather than mocked front-end state.
