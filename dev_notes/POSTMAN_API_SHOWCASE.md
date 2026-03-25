# API Showcase Runbook (Question-Driven)

This runbook is organized to answer stakeholder questions directly, with concrete proof steps.

## Condensed Stakeholder Questions

1. Where are the API routes actually defined, and where can users see what to call?
2. Can a user authenticate in Postman directly (without UI)?
3. Are permissions enforced in API responses when called from Postman/CLI?
4. If we add a new TypeScript field, does it become available in API responses?
5. Can we restrict that field so certain users cannot see it in API responses?
6. How does local dev -> Vercel deployment work? (deferred)
7. Are branded URLs possible? (deferred)
8. What folder structure should we use for portals and permissions, and does behavior still work?

## 0) Environment Setup (run first)

Repository root:

- `/Users/danie/repos/Keith/payload-multitenant-agency-portal-poc`

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
# in the terminal where next dev is running
# press Ctrl+C, then run:
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

2. In Tests tab, save token:

```javascript
const json = pm.response.json();
pm.environment.set('token', json.token);
```

3. Verify with:
- Method: `GET`
- URL: `{{baseUrl}}/api/users/me`
- Header: `Authorization: Bearer {{token}}`

CLI equivalent proof:

```bash
set -euo pipefail
BASE='http://localhost:3000'

LOGIN_JSON=$(curl -sS -X POST "$BASE/api/users/login" \
  -H 'Content-Type: application/json' \
  --data '{"email":"storehero.root@poc.local","password":"Passw0rd!Demo"}')

TOKEN=$(printf '%s' "$LOGIN_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.token||'')})")

curl -sS "$BASE/api/users/me" -H "Authorization: Bearer $TOKEN" \
| node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('email=' + (j.user?.email||''));console.log('role=' + (j.user?.role||''))})"
```

## 3) Permissions enforcement proof (API-only)

Answer:

- Yes. The same API endpoints return different results by user role.

Real use case:

- `agency-root` can manage full agency access (all agency stores + invite management).
- `agency-member` can operate only assigned stores and cannot access invite token management.

Postman setup:

1. Create environment variables:
- `baseUrl = http://localhost:3000`
- `token_root =` (empty)
- `token_member =` (empty)

2. Login as agency root:
- Method: `POST`
- URL: `{{baseUrl}}/api/users/login`
- Body:

```json
{
  "email": "aurora.agency+root@poc.local",
  "password": "Passw0rd!Demo"
}
```

- In Tests tab:

```javascript
const json = pm.response.json();
pm.environment.set('token_root', json.token);
```

3. Login as agency member:
- Method: `POST`
- URL: `{{baseUrl}}/api/users/login`
- Body:

```json
{
  "email": "aurora.agency+member@poc.local",
  "password": "Passw0rd!Demo"
}
```

- In Tests tab:

```javascript
const json = pm.response.json();
pm.environment.set('token_member', json.token);
```

4. Compare visible stores:
- Request A:
  - Method: `GET`
  - URL: `{{baseUrl}}/api/stores?limit=200`
  - Header: `Authorization: Bearer {{token_root}}`
- Request B:
  - Same request, but `Authorization: Bearer {{token_member}}`

Expected (tested):

- Root sees `totalDocs = 5` including `Aurora Pets` (`id=4`) and `Aurora Apparel` (`id=5`).
- Member sees `totalDocs = 3` (`Aurora Bikes`, `Aurora Coffee`, `Aurora Fitness`).

5. Compare access to one unassigned store (`id=4`):
- Request A:
  - Method: `GET`
  - URL: `{{baseUrl}}/api/stores/4`
  - Header: `Authorization: Bearer {{token_root}}`
  - Expected: `200` with store payload (`Aurora Pets`)
- Request B:
  - Same request with `Authorization: Bearer {{token_member}}`
  - Expected: `404` with `{"errors":[{"message":"Not Found"}]}`

6. Compare invite-management access:
- Request A:
  - Method: `GET`
  - URL: `{{baseUrl}}/api/invite-tokens?limit=200`
  - Header: `Authorization: Bearer {{token_root}}`
  - Expected: `200` and `totalDocs = 1`
- Request B:
  - Same request with `Authorization: Bearer {{token_member}}`
  - Expected: `403` with `{"errors":[{"message":"You are not allowed to perform this action."}]}`

What this proves:

- API permissions are enforced server-side, not UI-side.
- Two users calling the same endpoints get different access and data visibility according to role/assignment.

## 4) Add a new TS field and show it in API

Answer:

- Yes. This can be done by an agent and validated end-to-end in code, OpenAPI, and API responses.

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

```bash
rg -n "internalOpsNote" src/collections/Stores.ts
sed -n '150,210p' src/collections/Stores.ts
```

2. Regenerate types and verify:

```bash
npm run generate:types
rg -n "internalOpsNote" src/payload-types.ts
```

3. Sync schema + data and restart app:

```bash
npm run db:reseed
npm run dev
```

4. Verify OpenAPI reflects the new field:

```bash
curl -sS http://localhost:3000/api/openapi > /tmp/openapi.json
rg -n "internalOpsNote" /tmp/openapi.json | head -n 5
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

2. Save token in Tests tab:

```javascript
pm.environment.set('token_storehero', pm.response.json().token);
```

3. Update store with new field:
- `PATCH {{baseUrl}}/api/stores/1`
- header: `Authorization: Bearer {{token_storehero}}`
- body:

```json
{
  "internalOpsNote": "OPS_DEMO_LOCKED"
}
```

4. Read store back:
- `GET {{baseUrl}}/api/stores/1`
- header: `Authorization: Bearer {{token_storehero}}`
- expected: response contains `"internalOpsNote": "OPS_DEMO_LOCKED"`

6. Stash this agent change for presentation replay:

```bash
git stash push -m "demo-agent-internal-ops-note" src/collections/Stores.ts
git stash list --max-count=3
git stash apply stash^{/demo-agent-internal-ops-note}
```

## 5) Hide that field for selected roles

Answer:

- Yes. It is hidden/restricted by field-level access, even when users hit the same endpoint.

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

In Tests tab:

```javascript
pm.environment.set('token_agency_root', pm.response.json().token);
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

In Tests tab:

```javascript
pm.environment.set('token_agency_member', pm.response.json().token);
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

Behavior verification:

```bash
npm run check
```

## Final Demo Checklist

```bash
# API docs available
curl -sS -o /tmp/openapi.out -w '%{http_code}\n' http://localhost:3000/api/openapi

# Auth works
curl -sS -o /tmp/login.out -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  --data '{"email":"storehero.root@poc.local","password":"Passw0rd!Demo"}'

# Quality gates
npm run check
```
