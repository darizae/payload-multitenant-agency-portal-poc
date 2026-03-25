# API Showcase Runbook (Question-Driven)

## Questions

1. Where are the API routes actually defined, and where can users see what to call?
2. Can a user authenticate in Postman directly (without UI)?
3. Are permissions enforced in API responses when called from Postman/CLI?
4. If we add a new TypeScript field, does it become available in API responses?
5. Can we restrict that field so certain users cannot see it in API responses?
6. How does local dev -> Vercel deployment work? (deferred)
7. Are branded URLs possible? (deferred)
8. What folder structure should we use for portals and permissions, and does behavior still work?

## 0) Environment Setup (run first)

Commands:

```bash
npm run db:reseed
npm run dev
```

Seeded password:

- `Passw0rd!Demo`

Seeded users used in proofs:

- `storehero.root@poc.local`
- `storehero.member@poc.local`
- `aurora.agency+root@poc.local`
- `aurora.agency+member@poc.local`
- `aurora.bikes+root@poc.local`

If `openapi` endpoints return `404`, restart dev server:

```bash
npm run dev
```

## 1) Where routes are defined and where users can see them

Answer:

- Next.js exposes one catch-all REST entrypoint at `app/(payload)/api/[...slug]/route.ts`.
- Payload auto-registers REST/auth endpoints based on collection config (`payload.config.ts` + `src/collections/*.ts`).
- User-facing documentation is now exposed via OpenAPI:
  - spec: `/api/openapi`
  - docs UI: `/api/docs`

See in src/collections/*.ts.

View docs in browser:

```bash
open http://localhost:3000/api/docs
```

## 2) Postman authentication (no UI)

Answer:

- Login is `POST /api/users/login`, then use bearer token for authenticated calls.

Postman steps:

1. Create request:
- Method: `POST`
- URL: `{{baseUrl}}/api/users/login`
- Body (raw JSON):

```json
{
  "email": "storehero.root@poc.local",
  "password": "Passw0rd!Demo"
}
```

2. Verify with:
- Method: `GET`
- URL: `{{baseUrl}}/api/users/me`
- Header: `Authorization: Bearer {{token}}`

## 3) Permissions enforcement proof (API-only)

API endpoints return different results by user role.

Real use case:

- `agency-root` can manage full agency access (all agency stores + invite management).
- `agency-member` can operate only assigned stores and cannot access invite token management.

Postman setup:

1. Login as agency root:
- Method: `POST`
- URL: `{{baseUrl}}/api/users/login`
- Body:

```json
{
  "email": "aurora.agency+root@poc.local",
  "password": "Passw0rd!Demo"
}
```

2. Login as agency member:
- Method: `POST`
- URL: `{{baseUrl}}/api/users/login`
- Body:

```json
{
  "email": "aurora.agency+member@poc.local",
  "password": "Passw0rd!Demo"
}
```

3.Compare visible stores:

Expected (tested):

- Root sees `totalDocs = 5` including `Aurora Pets` (`id=4`) and `Aurora Apparel` (`id=5`).
- Member sees `totalDocs = 3` (`Aurora Bikes`, `Aurora Coffee`, `Aurora Fitness`).

4. Compare access to one unassigned store (`id=4`):
- Request A:
  - Method: `GET`
  - URL: `{{baseUrl}}/api/stores/4`
  - Header: `Authorization: Bearer {{token_root}}`
  - Expected: `200` with store payload (`Aurora Pets`)
- Request B:
  - Same request with `Authorization: Bearer {{token_member}}`
  - Expected: `404` with `{"errors":[{"message":"Not Found"}]}`

5. Compare invite-management access:
- Request A:
  - Method: `GET`
  - URL: `{{baseUrl}}/api/invite-tokens?limit=200`
  - Header: `Authorization: Bearer {{token_root}}`
  - Expected: `200` and `totalDocs = 1`
- Request B:
  - Same request with `Authorization: Bearer {{token_member}}`
  - Expected: `403` with `{"errors":[{"message":"You are not allowed to perform this action."}]}`

## 4) Add a new TS field and show it in API

Answer:

- Via agent and validated end-to-end in code, OpenAPI, and API responses.

Agent prompt to use (copy/paste):

```txt
Update this repo to add a new Stores field named internalOpsNote (text) with field-level access:
- create/read/update allowed only for storehero roles and agency-root
- hidden for other roles in API responses

Then:
1) regenerate payload types
2) run checks
3) provide changed files
```

Step-by-step reproduction:

1. Verify code change exists:

- src/collections/Stores.ts

2. Regenerate types and verify:

```bash
npm run generate:types
```

See in: src/payload-types.ts

3. Sync schema + data and restart app:

```bash
npm run db:reseed
npm run dev
```

4. Verify OpenAPI reflects the new field:

```bash
open http://localhost:3000/api/docs
```

5. Postman success flow (storehero user):

1. Login request:
- `POST {{baseUrl}}/api/users/login`
- body:

```json
{
  "email": "storehero.root@poc.local",
  "password": "Passw0rd!Demo"
}
```

2Update store with new field:
- `PATCH {{baseUrl}}/api/stores/1`
- header: `Authorization: Bearer {{token_storehero}}`
- body:

```json
{
  "internalOpsNote": "OPS_DEMO_LOCKED"
}
```

3Read store back:
- `GET {{baseUrl}}/api/stores/1`
- header: `Authorization: Bearer {{token_storehero}}`
- expected: response contains `"internalOpsNote": "OPS_DEMO_LOCKED"`

## 5) Hide that field for selected roles

Answer:

- Hidden/restricted by field-level access, even when users hit the same endpoint.

Postman two-user proof:

1. Login as agency root:
- `POST {{baseUrl}}/api/users/login`
- body:

```json
{
  "email": "aurora.agency+root@poc.local",
  "password": "Passw0rd!Demo"
}
```

2. Login as agency member:
- `POST {{baseUrl}}/api/users/login`
- body:

```json
{
  "email": "aurora.agency+member@poc.local",
  "password": "Passw0rd!Demo"
}
```

3. Root can read field:
- `GET {{baseUrl}}/api/stores/1`
- header: `Authorization: Bearer {{token_agency_root}}`
- expected: response includes `internalOpsNote`

4. Member cannot read field:
- `GET {{baseUrl}}/api/stores/1`
- header: `Authorization: Bearer {{token_agency_member}}`
- expected: response does not include `internalOpsNote`

5. Optional write restriction check:
- Root updates note:
  - `PATCH {{baseUrl}}/api/stores/1` with `{"internalOpsNote":"OPS_DEMO_LOCKED"}`
  - header: `Authorization: Bearer {{token_agency_root}}`
- Member attempts update:
  - `PATCH {{baseUrl}}/api/stores/1` with `{"internalOpsNote":"MUST_NOT_PERSIST"}`
  - header: `Authorization: Bearer {{token_agency_member}}`
- Root re-reads store:
  - `GET {{baseUrl}}/api/stores/1`
  - expected: `internalOpsNote` is still `OPS_DEMO_LOCKED`

## 8) Folder structure for portals/permissions

Answer:

- Implemented and wired by responsibility:

```txt
src/authz/
  roles.ts
  ui-rules.ts
  payload-access.ts
  policies.ts

src/features/portal/
  agency/{actions.ts,services.ts}
  store/{actions.ts,services.ts}
  storehero/{actions.ts,services.ts}
  shared/{actions.ts,services.ts}
  actions/utils.ts
```