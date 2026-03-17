# Full Coverage Functional Specification — Multi-Tenant Agency / Customer User Management POC

## 1. Purpose

Build a Payload-based proof of concept that establishes a reusable tenant and user-management foundation for future applications.

The POC models:

- agencies as top-level tenants
- agency-side internal users
- customers that belong to exactly one agency
- customer-side users that belong to exactly one customer
- assignment of agency users to one or more customers
- secure authentication and tenant-aware authorization
- a basic but runnable operator portal with good UX

This POC intentionally focuses on **user management, tenancy, roles, access control, invites, and auditability**. Analytics, Shopify/TikTok integrations, big-query style data, and other business-domain integrations are explicitly deferred.

## 2. Source material consolidated

This specification merges:

- the supplied functional draft
- the supplied transcript / voice-note summary
- the explicit hard requirements for implementation

The transcript reinforces that the first phase must remain simple, Payload-first, and usable as a generic starter pattern for future tenant-aware applications.

## 3. Product framing

### 3.1 Core outcome

The system acts as an agency portal where:

- an agency has its own internal workforce
- the agency serves multiple customers
- both agency users and customer users can authenticate
- customer users only see their own customer context
- agency users either see the full agency or only assigned customers depending on role/policy

### 3.2 POC success criteria

The POC is successful if a reviewer can:

1. boot the app locally with SQLite
2. log in
3. create agencies, customers, users, and assignments through real UI
4. observe strict tenant isolation
5. verify the core rules and edge-case protections
6. inspect the same state via Payload admin and audit logs

## 4. Hard implementation requirements translated into build rules

1. Use the latest stable Payload release line supported by current official docs.
2. Do not implement on old v2-era architecture.
3. Use SQLite so the app is runnable without external database setup.
4. Include an already-generated `.env` and `.env.example` with real values.
5. Include a seed that produces a meaningful demonstration environment.
6. Use Material UI for the custom portal experience.
7. Keep forms slim, readable, high-contrast, and non-overflowing.
8. Provide a markdown walkthrough explaining how the runnable prototype maps to the spec.
9. Ensure the Payload admin still works as a real CRUD/admin surface.

## 5. Canonical domain model

## 5.1 Agency

Agency is the top-level tenant.

Each agency:

- has an isolated data boundary
- has many agency users
- has many customers
- must always have at least one active agency admin
- owns the brand/settings context for its portal experience

## 5.2 Customer

Customer belongs to exactly one agency.

Each customer:

- lives under one agency only
- has its own users
- may have zero or more assigned agency users
- must have at least one active customer admin in this v1 policy

## 5.3 User

A single auth-enabled `users` collection is used for v1.

That user record may be one of the following roles:

- `platform-admin`
- `agency-admin`
- `agency-manager`
- `agency-user`
- `customer-admin`
- `customer-user`

This single-collection design keeps authentication simple, supports global unique emails, and allows a single login mechanism while still enforcing tenant boundaries through role and relationship fields.

## 5.4 Assignment

Assignments connect agency-side users to customer workspaces.

This is a many-to-many relationship between:

- agency users
- customers

Assignments are only valid within one agency boundary.

## 6. Explicit policy decisions locked for v1

The original draft left several questions open. For this runnable POC, the decisions are:

### 6.1 Email uniqueness

**Decision:** email is globally unique across the platform.

Reasoning: simplest identity model for a v1 foundation.

### 6.2 Cross-tenant people

**Decision:** one user belongs to only one agency/customer context in v1.

Reasoning: significantly reduces complexity of auth, access, and UI switching.

### 6.3 Agency admin scope

**Decision:** agency admins automatically see all customers in their agency.

### 6.4 Customer admin requirement

**Decision:** each customer must have at least one active customer admin.

### 6.5 Agency admin requirement

**Decision:** each agency must have at least one active agency admin.

### 6.6 Customer transfer between agencies

**Decision:** forbidden in v1.

Reasoning: tenant transfer is a migration workflow, not a normal CRUD edit.

### 6.7 Platform super admin

**Decision:** supported in v1 via `platform-admin`.

Reasoning: otherwise agency creation has no credible owner in the prototype.

### 6.8 SSO and MFA

**Decision:** not implemented in v1, but the model leaves room for future extension.

## 7. Tenant and scope rules

### 7.1 Agency isolation

Data from one agency must never be visible to another agency through normal authenticated flows.

### 7.2 Customer isolation

Customer users may only access:

- their own customer
- inside the owning agency

### 7.3 Agency user visibility

- `agency-admin`: all customers in their agency
- `agency-manager`: agency-wide if configured, otherwise role-based operational scope
- `agency-user`: only assigned customers unless explicitly granted agency-wide customer access

### 7.4 Customer user visibility

- `customer-admin`: only their customer
- `customer-user`: only their customer, with no user-management rights

### 7.5 Session requirements

Every authenticated request must be resolvable to:

- user identity
- role
- agency scope
- customer scope where applicable
- assignment scope where applicable

## 8. Functional requirements finalized

## 8.1 Agency management

### FR-1 Create Agency

Platform admin can create an agency with:

- name
- status
- contact details
- branding placeholders

### FR-2 Maintain At Least One Agency Admin

System must block deletion, deactivation, or demotion of the last active agency admin.

### FR-3 Update Agency

Platform admins and agency admins may update allowed agency details.

### FR-4 Deactivate Agency

If an agency is inactive, users under that agency cannot authenticate.

## 8.2 Agency user management

### FR-5 Create Agency User

Privileged users can create agency users with:

- name
- email
- role
- status
- optional agency-wide visibility

### FR-6 Invite Agency User

Creating an invited agency user must automatically create an invite token.

### FR-7 Edit Agency User

Privileged users may update:

- name
- role
- status
- visibility flags

### FR-8 Deactivate Agency User

Deactivated or suspended users cannot log in.

### FR-9 Protect Last Agency Admin

Protected by business-rule validation and tested explicitly.

## 8.3 Customer management

### FR-10 Create Customer

Privileged agency-side users can create customers under their agency.

### FR-11 Edit Customer

Allowed users can update customer metadata/settings within scope.

### FR-12 Deactivate Customer

Inactive/suspended customers block customer-user login.

### FR-13 List Customers

Customer visibility is determined by agency scope plus assignments.

## 8.4 Customer user management

### FR-14 Create Customer User

Allowed creators:

- platform admin
- agency admin
- assigned agency-side user where allowed by portal flow and scope
- customer admin for their own customer

### FR-15 Edit Customer User

Allowed within customer scope only.

### FR-16 Invite Customer User

Customer-user creation supports invite activation.

### FR-17 Deactivate Customer User

Deactivated customer users cannot authenticate.

### FR-18 Customer User Isolation

Customer users are never visible outside their own customer except to authorized agency-side users.

## 8.5 Assignment management

### FR-19 Assign Agency Users to Customers

Agency admins and platform admins can create assignments.

### FR-20 Unassign Agency Users

By deactivating or deleting assignments.

### FR-21 Assignment-Based Visibility

Restricted agency users only see assigned customers.

### FR-22 View Assignments

The system exposes:

- users assigned to a customer
- customers assigned to an agency user

## 9. User journeys implemented in the POC

### 9.1 Platform admin creates agency

- log in as platform admin
- open agencies page
- create new agency
- open Payload admin to inspect stored data

### 9.2 Agency admin onboards customer

- log in as agency admin
- open agency workspace
- create customer
- open customer workspace
- invite customer admin
- inspect invite token
- activate invite

### 9.3 Restricted agency user

- log in as restricted agency user
- see only assigned customer(s)
- confirm unassigned customers are hidden

### 9.4 Customer admin manages their team

- log in as customer admin
- see only own customer
- invite customer users
- activate invite

## 10. Data model implemented

### 10.1 `agencies`

Fields:

- `name`
- `status`
- `primaryContactName`
- `primaryContactEmail`
- `primaryContactPhone`
- branding fields
- `settings`
- timestamps

### 10.2 `users`

Fields:

- Payload auth fields including `email` and password hash
- `name`
- `role`
- `status`
- `agency`
- `customer`
- `hasGlobalCustomerAccess`
- `lastLoginAt`
- timestamps

### 10.3 `customers`

Fields:

- `agency`
- `name`
- `status`
- contact fields
- `settings`
- timestamps

### 10.4 `agency-customer-assignments`

Fields:

- `agency`
- `agencyUser`
- `customer`
- `assignedAt`
- `assignedBy`
- `status`
- computed label

### 10.5 `invite-tokens`

Fields:

- `token`
- `user`
- `email`
- `agency`
- `customer`
- `invitedBy`
- `status`
- `expiresAt`
- `usedAt`

### 10.6 `audit-logs`

Fields:

- `actor`
- `action`
- `entityType`
- `entityId`
- `agency`
- `customer`
- `summary`
- `metadata`
- timestamps

## 11. Authentication model

### 11.1 Credentials

- email + password via Payload auth
- invite activation sets first real password

### 11.2 Login guardrails

The login flow must reject:

- invited users that have not activated
- suspended/deactivated users
- users in inactive agencies
- customer users in inactive/suspended customers

### 11.3 Admin panel access

Payload admin access is limited to:

- platform admins
- agency admins
- agency managers

Customer users use the MUI portal only.

## 12. Authorization evaluation order

Authorization logic must validate in this order:

1. authenticated identity
2. role
3. agency boundary
4. customer boundary where applicable
5. assignment scope where applicable
6. resource ownership/scope
7. operation-specific rule

## 13. Security and audit requirements

### 13.1 Security controls

- Payload's built-in auth and secure password hashing
- login throttling via max login attempts / lock time
- tenant-aware checks in both hooks and portal logic
- no uncontrolled direct-object access in the custom portal

### 13.2 Audited events

The prototype logs at least:

- user create/update/delete
- customer create/update/delete
- agency create/update/delete
- assignment create/update/delete
- invite issuance
- login events

## 14. UI expectations realized

### 14.1 Custom Material UI portal

The custom portal is the operator-facing POC surface.

It must be:

- readable
- slim
- high contrast
- responsive
- suitable for quick operational workflows

### 14.2 Payload admin

Payload admin remains enabled as the real backend/admin surface.

This is important because the POC must prove:

- the schema is real Payload config
- CRUD is real Payload CRUD
- hooks and access control are real backend logic

## 15. Edge cases covered

- removing the last active agency admin
- removing the last active customer admin
- agency user with no assignments
- customer without users yet
- invited user never activates
- duplicate email across tenants
- role change from admin to non-admin
- customer transfer between agencies

## 16. What is intentionally deferred

- SSO
- MFA enforcement UX
- per-feature permission matrices beyond role + assignment overlay
- agency branding-by-domain
- multi-agency user membership
- customer migration workflows
- external integrations and analytics

## 17. Acceptance checklist

A reviewer should be able to confirm that:

- the app boots locally from a clean install
- the seed produces useful demo data
- the MUI portal is usable and readable
- Payload admin works
- tenant isolation works
- invite activation works
- last-admin guardrails work
- audit logs are populated
- agency/customer/user records are actually stored in SQLite via Payload

## 18. Implementation-to-spec mapping summary

This POC is not a mockup. It is a working baseline architecture that can be reused as the first layer of future tenant-aware applications built with Payload.

That makes it suitable as a “hello world of complexity” for future agency/customer apps, exactly matching the intent described in the transcript.
