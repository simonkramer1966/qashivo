# QASHIVO — ROLE-BASED ACCESS CONTROL & MULTI-USER SPECIFICATION

**Version:** 1.1 — 11 April 2026
**Purpose:** Multi-user access with role-based permissions, per-user delegation, audit trail, and invitation flow
**Status:** Specification — not yet built
**Prerequisites:** Clerk auth (current), tenant isolation (current)
**Review status:** Reviewed and revised following devil's advocate session

---

## 1. OVERVIEW

Qashivo currently supports a single user per tenant. This spec adds multi-user access with four roles, delegatable permissions, a full audit trail, and an invitation system. The design supports both direct tenant users and accountant users who access through the partner portal.

**Design principles:**
- Least privilege by default — each role gets only what it needs
- Delegation is explicit, per-user, and revocable — never blanket
- Every significant action is audited with who, what, when, and before/after
- The Accountant role is a trusted operator, not a read-only advisor
- Permission checks happen at both the API layer (enforcement) and the UI layer (visibility)
- No dead roles — every role exists because real people need it

---

## 2. ROLES

### 2.1 Role Definitions

Four roles. No Viewer role — nobody logs into a credit control system just to look.

| Role | Description | Typical user | Limit per tenant |
|------|-------------|-------------|-----------------|
| **Owner** | Full control. The person responsible for the business and the Qashivo subscription. | Business owner, MD, sole trader | Exactly 1 |
| **Manager** | Operational control over credit control, forecasting, and team. Cannot access billing or delete the tenant. Can be delegated Capital and Autonomy access. Can invite Controllers only (not Managers or Accountants). | Finance director, credit manager | Unlimited |
| **Controller** | Day-to-day credit control operations. Approves actions, manages debtors, sends communications. Cannot configure system settings or edit forecasts. Has read-only visibility of communication mode. | Credit controller, AR clerk | Unlimited |
| **Accountant** | Trusted external operator. Full operational access equivalent to Owner, with five permissions held back by default that can be individually delegated by the Owner. Accesses through the partner portal and can see multiple tenants. | Accounting firm partner, bookkeeper | Unlimited (linked via partner portal) |

### 2.2 Role Hierarchy

```
Owner (exactly 1 per tenant)
  │
  ├── Manager (unlimited, delegatable extras)
  │     ├── Capital: view ──────── OFF by default, Owner toggles per-manager
  │     ├── Capital: request finance ── OFF by default, Owner toggles per-manager
  │     └── Autonomy access ────── OFF by default, Owner toggles per-manager
  │
  ├── Controller (unlimited, fixed permissions)
  │     └── Communication mode ── read-only visibility (cannot change)
  │
  └── Accountant (unlimited, linked via partner portal)
        ├── Capital: view ──────── OFF by default, Owner toggles per-accountant
        ├── Capital: request finance ── OFF by default, Owner toggles per-accountant
        ├── Autonomy access ────── OFF by default, Owner toggles per-accountant
        ├── Manage users ────────── OFF by default, Owner toggles per-accountant
        └── Billing access ──────── OFF by default, Owner toggles per-accountant
```

---

## 3. PERMISSION MATRIX

### 3.1 Full Matrix

| Permission | Owner | Manager | Controller | Accountant |
|---|---|---|---|---|
| **Viewing** | | | | |
| View dashboard | ✓ | ✓ | ✓ | ✓ |
| View debtors list | ✓ | ✓ | ✓ | ✓ |
| View debtor detail | ✓ | ✓ | ✓ | ✓ |
| View action centre | ✓ | ✓ | ✓ | ✓ |
| View forecast | ✓ | ✓ | ✓ | ✓ |
| View weekly review | ✓ | ✓ | ✓ | ✓ |
| View data health | ✓ | ✓ | ✓ | ✓ |
| View agent team | ✓ | ✓ | ✓ | ✓ |
| View audit log | ✓ | ✓ | ✗ | ✓ |
| View communication mode (read-only) | ✓ | ✓ | ✓ | ✓ |
| **Credit control operations** | | | | |
| Approve/reject agent actions | ✓ | ✓ | ✓ | ✓ |
| Send Now (direct send) | ✓ | ✓ | ✓ | ✓ |
| Tone override per debtor | ✓ | ✓ | ✓ | ✓ |
| Add/edit AR notes | ✓ | ✓ | ✓ | ✓ |
| Put debtor on hold | ✓ | ✓ | ✓ | ✓ |
| Flag debtor as VIP | ✓ | ✓ | ✓ | ✓ |
| Update debtor contacts/email/phone | ✓ | ✓ | ✓ | ✓ |
| **System configuration** | | | | |
| Configure Charlie (persona, tone, cooldown) | ✓ | ✓ | ✗ | ✓ |
| Autonomy settings (mode, test/live) | ✓ | delegated | ✗ | delegated |
| Communication preferences | ✓ | ✓ | ✗ | ✓ |
| Xero connection management | ✓ | ✓ | ✗ | ✓ |
| **Forecasting** | | | | |
| Edit forecast outflows | ✓ | ✓ | ✗ | ✓ |
| Edit pipeline (committed/uncommitted/stretch) | ✓ | ✓ | ✗ | ✓ |
| Edit opening balance | ✓ | ✓ | ✗ | ✓ |
| Edit safety threshold | ✓ | ✓ | ✗ | ✓ |
| Close week (roll forward) | ✓ | ✓ | ✗ | ✓ |
| **Capital / financing** | | | | |
| View Capital pages (Bridge, Facility, Pre-auth) | ✓ | delegated | ✗ | delegated |
| Request finance (Bridge actions) | ✓ | delegated | ✗ | delegated |
| **Administration** | | | | |
| Invite/manage Managers | ✓ | ✗ | ✗ | delegated |
| Invite/manage Controllers | ✓ | ✓ | ✗ | delegated |
| Invite/manage Accountants | ✓ | ✗ | ✗ | ✗ |
| Billing and subscription | ✓ | ✗ | ✗ | delegated |
| Delete tenant | ✓ | ✗ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ |

### 3.2 Delegation Rules

**Delegation is:**
- Per-user (not blanket per-role)
- Set by the Owner only
- Revocable at any time
- Audited (delegation changes appear in audit log)
- Communicated by email to the affected user on grant or revoke

**Manager delegatable permissions (3):**

| Permission | Default | Delegated by |
|---|---|---|
| Capital: view | OFF | Owner |
| Capital: request finance | OFF | Owner |
| Autonomy settings access | OFF | Owner |

**Accountant delegatable permissions (5):**

| Permission | Default | Delegated by |
|---|---|---|
| Capital: view | OFF | Owner |
| Capital: request finance | OFF | Owner |
| Autonomy settings access | OFF | Owner |
| Manage users | OFF | Owner |
| Billing access | OFF | Owner |

**Note:** Tenant deletion is Owner-only and cannot be delegated to anyone.

### 3.3 Invitation Hierarchy

Who can invite whom:

| Inviter | Can invite |
|---------|-----------|
| Owner | Manager, Controller, Accountant |
| Manager | Controller only |
| Controller | Nobody |
| Accountant (with manage users delegation) | Controller only |

---

## 4. SCHEMA

### 4.1 Users Table Extensions

The existing `users` table is extended:

```
users (extended)
├── role: varchar NOT NULL DEFAULT 'controller'
│     -- 'owner' | 'manager' | 'controller' | 'accountant'
├── tenantId: uuid FK tenants
├── invitedBy: uuid FK users (nullable — null for Owner)
├── invitedAt: timestamp (nullable)
├── acceptedAt: timestamp (nullable)
├── status: varchar DEFAULT 'active'
│     -- 'invited' | 'active' | 'removed'
├── removedAt: timestamp (nullable)
├── removedBy: uuid FK users (nullable)
├── lastActiveAt: timestamp (nullable)
```

### 4.2 User Delegations Table

```
userDelegations
├── id: uuid PK
├── tenantId: uuid FK tenants
├── userId: uuid FK users (the user receiving the delegation)
├── permission: varchar NOT NULL
│     -- 'capital_view' | 'capital_request' | 'autonomy_access' |
│        'manage_users' | 'billing_access'
├── grantedBy: uuid FK users (must be Owner)
├── grantedAt: timestamp
├── revokedAt: timestamp (nullable — null means active)
├── revokedBy: uuid FK users (nullable)
├── isActive: boolean DEFAULT true
├── UNIQUE(tenantId, userId, permission) WHERE isActive = true
```

### 4.3 Audit Log Table

```
auditLog
├── id: uuid PK
├── tenantId: uuid FK tenants
├── userId: uuid FK users (who performed the action)
├── userName: text (denormalised — users can be removed)
├── userRole: varchar (role at time of action)
├── action: varchar NOT NULL
│     -- see Section 5 for action types
├── category: varchar NOT NULL
│     -- 'financial' | 'operational'
│     -- determines retention period
├── entityType: varchar
│     -- 'debtor' | 'invoice' | 'action' | 'setting' | 'user' |
│        'forecast' | 'delegation' | 'finance' | 'tenant'
├── entityId: uuid (nullable)
├── entityName: text (nullable — denormalised for display)
├── details: jsonb
│     -- { before: {...}, after: {...}, metadata: {...} }
├── ipAddress: varchar (nullable)
├── createdAt: timestamp DEFAULT now()
├── INDEX(tenantId, createdAt DESC)
├── INDEX(tenantId, entityType, entityId)
├── INDEX(tenantId, category, createdAt DESC)
```

### 4.4 Invitations Table

```
userInvitations
├── id: uuid PK
├── tenantId: uuid FK tenants
├── email: text NOT NULL
├── role: varchar NOT NULL
├── invitedBy: uuid FK users
├── invitedAt: timestamp DEFAULT now()
├── expiresAt: timestamp (default 7 days)
├── acceptedAt: timestamp (nullable)
├── acceptedBy: uuid FK users (nullable)
├── token: varchar NOT NULL UNIQUE (secure random token)
├── status: varchar DEFAULT 'pending'
│     -- 'pending' | 'accepted' | 'expired' | 'revoked'
├── previousInvitationId: uuid FK userInvitations (nullable)
│     -- links re-invites to original for audit trail
├── UNIQUE(tenantId, email) WHERE status = 'pending'
```

### 4.5 Owner Failsafe Table

```
ownerFailsafe
├── id: uuid PK
├── tenantId: uuid FK tenants (UNIQUE — one per tenant)
├── emergencyContactName: text NOT NULL
├── emergencyContactEmail: text NOT NULL
├── emergencyContactPhone: text (nullable)
├── emergencyContactRelationship: text
│     -- e.g. "Business partner", "Spouse", "Solicitor"
├── setBy: uuid FK users (must be Owner)
├── setAt: timestamp
├── updatedAt: timestamp
```

---

## 5. AUDIT LOG — WHAT GETS LOGGED

### 5.1 Action Types

| Category | Retention | Action | Details captured |
|----------|-----------|--------|-----------------|
| **Operational** | 2 years | user_login | IP, device |
| **Operational** | 2 years | user_logout | — |
| **Operational** | 2 years | user_invited | email, role |
| **Operational** | 2 years | user_accepted_invite | — |
| **Operational** | 2 years | user_reinvited | email, original invitation |
| **Operational** | 2 years | user_role_changed | before role, after role |
| **Operational** | 2 years | user_removed | reason |
| **Operational** | 2 years | delegation_granted | permission, to user |
| **Operational** | 2 years | delegation_revoked | permission, from user |
| **Operational** | 2 years | action_approved | action ID, debtor, type |
| **Operational** | 2 years | action_rejected | action ID, debtor, reason |
| **Operational** | 2 years | action_sent_now | action ID, debtor |
| **Operational** | 2 years | tone_override_changed | debtor, before, after |
| **Operational** | 2 years | debtor_hold_changed | debtor, before, after |
| **Operational** | 2 years | debtor_vip_changed | debtor, before, after |
| **Operational** | 2 years | debtor_note_added | debtor, note text |
| **Operational** | 2 years | debtor_contact_updated | debtor, field, before, after |
| **Operational** | 2 years | communication_mode_changed | before, after |
| **Operational** | 2 years | autonomy_level_changed | before, after |
| **Operational** | 2 years | charlie_config_changed | field, before, after |
| **Operational** | 2 years | xero_connected | org name |
| **Operational** | 2 years | xero_disconnected | org name |
| **Operational** | 2 years | opening_balance_changed | before, after |
| **Operational** | 2 years | safety_threshold_changed | before, after |
| **Operational** | 2 years | outflow_updated | category, week, before, after |
| **Operational** | 2 years | pipeline_updated | confidence, week, before, after |
| **Operational** | 2 years | week_closed | week, forecast vs actual |
| **Financial** | 7 years | finance_requested | invoices, amount, cost |
| **Financial** | 7 years | finance_confirmed | invoices, amount |
| **Financial** | 7 years | finance_cancelled | invoices, reason |
| **Financial** | 7 years | finance_repayment | invoice, amount, interest |
| **Financial** | 7 years | finance_retention_released | invoice, amount |
| **Financial** | 7 years | preauth_status_changed | before, after |
| **Financial** | 7 years | billing_payment | amount, method |
| **Financial** | 7 years | billing_plan_changed | before, after |
| **Financial** | 7 years | ownership_transferred | from, to |
| **Financial** | 7 years | tenant_deleted | tenant name |

### 5.2 Audit Log Retention

- **Financial actions:** 7 years (UK financial record-keeping compliance)
- **Operational actions:** 2 years
- Immutable — audit records cannot be edited or deleted by any user
- Export to CSV available to Owner (and delegated Accountant with billing access) before automatic cleanup
- Nightly job purges operational records older than 2 years (after export window)
- Viewable by Owner, Manager, and Accountant
- Filterable by: date range, user, action category, entity type

---

## 6. INVITATION FLOW

### 6.1 Standard Invite Process

```
Owner/Manager goes to Settings → Team
  → clicks "Invite user"
  → enters email address
  → selects role (constrained by inviter's own role)
  → clicks "Send invite"
  │
  ├── Invitation record created (status: pending, 7-day expiry)
  ├── Audit log: user_invited
  ├── Email sent via Clerk with secure token link
  │
  ▼
Invitee receives email
  → clicks link
  → if existing Clerk account: links to tenant
  → if no account: creates account via Clerk
  → invitation status → accepted
  → user record created with role
  → audit log: user_accepted_invite
  → redirected to tenant dashboard
```

### 6.2 Re-Invite from Historic Record

When a user has been removed:

```
Owner goes to Settings → Team → Removed Users
  → finds the removed user
  → clicks "Re-invite"
  → role pre-filled (from original), can be changed
  → email sent, linked to previous invitation record
  → previousInvitationId set for audit trail continuity
```

No need to re-enter email or search — the historic record has everything. The user's previous activity history remains in the audit log.

### 6.3 Accountant Invitation

```
Owner goes to Settings → Team
  → clicks "Invite accountant"
  → enters accountant's email
  │
  ├── If email matches existing partner portal user:
  │     → Link created (partnerTenantLinks)
  │     → Accountant sees new client in their portal immediately
  │     → Email notification sent to accountant
  │
  └── If email doesn't match existing partner user:
        → Email sent with two options:
        │
        ├── "Accept invitation" → creates partner account with this email
        │
        └── "Wrong email?" → button opens form:
              "Please invite me using my partner portal email instead"
              [email field] → [Submit]
              → notifies the Owner to re-invite with correct email
              → original invitation revoked
```

### 6.4 Invitation Management

In Settings → Team, the Owner can:
- See all pending invitations
- Revoke a pending invitation (before acceptance)
- Resend an expired invitation (creates new invitation linked to original)
- See removed users with re-invite option
- See invitation history (who was invited, when, by whom, status)

---

## 7. SETTINGS → TEAM UI

### 7.1 Page Layout

```
Settings → Team

┌──────────────────────────────────────────────────────────┐
│ Team Members                [Invite user] [Invite acct]  │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Simon Kramer                                  Owner  │ │
│ │ simon@nexuskpi.com · Active · Last seen: Today       │ │
│ │ Emergency contact: Jane Kramer (Spouse)        [Edit]│ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Jane Smith                              Manager   ⋮  │ │
│ │ jane@datumcreative.com · Active · Last: Today        │ │
│ │                                                      │ │
│ │ Delegated permissions:                               │ │
│ │   View Capital        [toggle OFF]                   │ │
│ │   Request finance     [toggle OFF]                   │ │
│ │   Autonomy settings   [toggle OFF]                   │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Tom Brown                            Controller   ⋮  │ │
│ │ tom@datumcreative.com · Active · Last: Yesterday     │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🔗 Sarah Partners (Smith & Co Accts)  Accountant  ⋮  │ │
│ │ sarah@smithco.com · Active · Last: 2 days ago        │ │
│ │                                                      │ │
│ │ Delegated permissions:                               │ │
│ │   View Capital        [toggle OFF]                   │ │
│ │   Request finance     [toggle OFF]                   │ │
│ │   Autonomy settings   [toggle OFF]                   │ │
│ │   Manage users        [toggle OFF]                   │ │
│ │   Billing access      [toggle OFF]                   │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Pending Invitations                                      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ mike@datumcreative.com · Controller · Sent 2 days    │ │
│ │ Expires in 5 days          [Resend] [Revoke]         │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Removed Users                                    [Show]  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Alex Green · Was: Controller · Removed 15 Mar 2026   │ │
│ │                                         [Re-invite]  │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Three-Dot Menu Actions

| Action | Available to |
|--------|-------------|
| Change role | Owner only |
| Remove user | Owner only (Managers can remove Controllers they invited) |
| View activity | Owner, Manager |

### 7.3 Invite Modal

```
┌─────────────────────────────────┐
│ Invite team member              │
│                                 │
│ Email address                   │
│ [________________________]      │
│                                 │
│ Role                            │
│ [Controller       ▼]           │
│                                 │
│ (Role options filtered by the   │
│  inviter's own role — Manager   │
│  only sees Controller)          │
│                                 │
│ Role description:               │
│ "Can approve agent actions,     │
│  manage debtors, and send       │
│  communications. Cannot change  │
│  system settings or forecasts." │
│                                 │
│      [Cancel]  [Send invite]    │
└─────────────────────────────────┘
```

### 7.4 Delegation Change Notification

When the Owner toggles a delegation:

```
Email to affected user:

Subject: "Access updated on Qashivo — [Tenant Name]"

Body:
"Simon Kramer has granted you access to Capital 
(view) on Qashivo for Datum Creative Media Limited.

You can now view the Facility statement and 
pre-authorisation status.

Log in: https://qashivo.com"
```

Revocation sends a similar email confirming access has been removed.

---

## 8. FRONTEND PERMISSION GATING

### 8.1 Permission Hook

```typescript
// client/src/hooks/usePermissions.ts

export function usePermissions() {
  const user = useCurrentUser();
  const delegations = useUserDelegations();

  const hasDelegation = (perm: string) =>
    delegations.some(d => d.permission === perm && d.isActive);

  return {
    // Viewing
    canViewAll: true, // all roles see all pages (except below)
    canViewAuditLog: ['owner', 'manager', 'accountant'].includes(user.role),
    canViewCommunicationMode: true, // all roles, read-only for controller

    // Credit control operations
    canOperate: ['owner', 'manager', 'controller', 'accountant'].includes(user.role),

    // System configuration
    canConfigureCharlie: ['owner', 'manager', 'accountant'].includes(user.role),
    canAccessAutonomy: user.role === 'owner' || hasDelegation('autonomy_access'),
    canChangeAutonomy: user.role === 'owner' || hasDelegation('autonomy_access'),

    // Forecasting
    canEditForecast: ['owner', 'manager', 'accountant'].includes(user.role),

    // Capital — split view vs action
    canViewCapital: user.role === 'owner' || hasDelegation('capital_view'),
    canRequestFinance: user.role === 'owner' || hasDelegation('capital_request'),

    // Administration
    canInviteManagers: user.role === 'owner',
    canInviteControllers: ['owner', 'manager'].includes(user.role) || hasDelegation('manage_users'),
    canInviteAccountants: user.role === 'owner',
    canManageUsers: user.role === 'owner' || user.role === 'manager' || hasDelegation('manage_users'),
    canAccessBilling: user.role === 'owner' || hasDelegation('billing_access'),
    canDeleteTenant: user.role === 'owner',
    canTransferOwnership: user.role === 'owner',
    canSetDelegations: user.role === 'owner',
  };
}
```

### 8.2 UI Behaviour

| Situation | Behaviour |
|-----------|-----------|
| User lacks permission for a page | Sidebar item hidden. Direct URL shows "You don't have access to this page" with explanation of which role or delegation is needed. |
| User lacks permission for an action | Button/control hidden entirely (not greyed out). The UI never shows something the user can't do. |
| Delegated permission is OFF | Same as lacking permission — hidden. |
| Controller viewing communication mode | Mode displayed as a read-only badge/indicator, not an editable control. |
| Owner viewing their own profile | Cannot change own role. Cannot remove self. |
| Manager viewing Team page | Only sees Controllers they can manage. Cannot see other Managers or Accountants. |

### 8.3 Riley Context

Riley knows who she's talking to and adjusts:

| Role | Riley behaviour |
|------|----------------|
| Owner | Full advisory — can suggest financing, setting changes, strategy, user management |
| Manager | Full advisory minus Capital/Autonomy unless delegated — avoids suggesting actions the user can't take |
| Controller | Operational focus — debtor advice, action recommendations, explains communication mode but doesn't suggest changing it |
| Accountant | Full advisory scoped to delegations — treats them as trusted operator, aware they may manage multiple clients |

---

## 9. API PERMISSION ENFORCEMENT

### 9.1 Middleware

```typescript
// server/middleware/permissions.ts

export function requireRole(...roles: Role[]) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logAudit(req, 'permission_denied', { required: roles });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireDelegation(permission: string) {
  return (req, res, next) => {
    if (req.user.role === 'owner') return next();
    if (hasDelegation(req.user.id, req.tenantId, permission)) return next();
    logAudit(req, 'permission_denied', { required: permission });
    return res.status(403).json({ error: 'Permission not delegated' });
  };
}

// Combined: role OR delegation
export function requireRoleOrDelegation(roles: Role[], permission: string) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    if (hasDelegation(req.user.id, req.tenantId, permission)) return next();
    logAudit(req, 'permission_denied', { required: { roles, permission } });
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
```

### 9.2 Route Protection Examples

```typescript
// Capital view — Owner + delegated
router.get('/api/capital/*', requireDelegation('capital_view'));

// Capital actions — Owner + delegated (separate permission)
router.post('/api/capital/bridge/request', requireDelegation('capital_request'));

// Autonomy settings — Owner + delegated
router.patch('/api/settings/autonomy', requireDelegation('autonomy_access'));

// Charlie config — Owner + Manager + Accountant
router.patch('/api/settings/charlie',
  requireRole('owner', 'manager', 'accountant'));

// User management — Owner + Manager (Controllers only) + delegated Accountant
router.post('/api/users/invite',
  requireRoleOrDelegation(['owner', 'manager'], 'manage_users'));

// Billing — Owner + delegated
router.get('/api/billing/*', requireDelegation('billing_access'));

// Debtor operations — all except Viewer (no Viewer role exists, but future-proof)
router.patch('/api/contacts/:id/hold',
  requireRole('owner', 'manager', 'controller', 'accountant'));

// Forecast editing — Owner + Manager + Accountant
router.patch('/api/cashflow/outflows',
  requireRole('owner', 'manager', 'accountant'));

// View routes — all authenticated users
router.get('/api/dashboard/*',
  requireRole('owner', 'manager', 'controller', 'accountant'));
```

### 9.3 Invitation Hierarchy Enforcement

```typescript
router.post('/api/users/invite', (req, res) => {
  const { role: targetRole } = req.body;
  const inviterRole = req.user.role;

  // Manager can only invite Controller
  if (inviterRole === 'manager' && targetRole !== 'controller') {
    return res.status(403).json({
      error: 'Managers can only invite Controllers'
    });
  }

  // Accountant with delegation can only invite Controller
  if (inviterRole === 'accountant' && targetRole !== 'controller') {
    return res.status(403).json({
      error: 'Accountants can only invite Controllers'
    });
  }

  // Only Owner can invite Manager or Accountant
  if (['manager', 'accountant'].includes(targetRole) && inviterRole !== 'owner') {
    return res.status(403).json({
      error: 'Only the Owner can invite Managers and Accountants'
    });
  }

  // proceed with invitation
});
```

### 9.4 Tenant Isolation

Permission checks layer ON TOP of existing tenant isolation. Every query is still scoped to `tenantId`. An Accountant with access to multiple tenants switches context — they never see cross-tenant data in a single query (that's the partner portal's job at the presentation layer).

---

## 10. OWNER FAILSAFE

### 10.1 The Problem

Single Owner is a single point of failure. If the Owner loses access to their Clerk account, becomes incapacitated, or disappears — nobody can manage billing, transfer ownership, or perform Owner-only actions.

### 10.2 Solution: Emergency Contact + Accountant Backstop

**Layer 1 — Emergency Contact:**

During onboarding (or any time in Settings → Team), the Owner nominates an emergency contact:
- Name, email, phone, relationship
- This person is NOT a Qashivo user
- They can contact Qashivo support to request an ownership transfer
- Identity is verified manually by Qashivo support team
- Transfer requires: emergency contact request + proof of identity + proof of relationship to the business
- Audit logged as support-assisted transfer

**Layer 2 — Accountant Backstop:**

If the tenant has a linked Accountant with billing delegation:
- The Accountant can request ownership transfer through Qashivo support
- Leverages the existing trust relationship (accountants often have authority over client finances)
- Same manual verification process as emergency contact
- Particularly valuable for the B2B2B model where the accountant may outlast the business owner

**Safeguards:**
- All failsafe transfer requests are manually reviewed (never automated)
- The Owner's registered email receives notification of any transfer request
- 14-day cooling-off period during which the Owner can block the transfer
- Full audit trail of the entire process

### 10.3 Emergency Contact UI

Shown on the Owner's card in Settings → Team:

```
Emergency contact: Jane Kramer (Spouse)           [Edit]
jane.kramer@gmail.com · +44 7700 900000
```

If not set, a prompt appears:

```
⚠️ No emergency contact set. If you lose access to 
your account, nobody can recover it.     [Set up now]
```

---

## 11. OWNER TRANSFER

If the Owner wants to voluntarily transfer ownership:

1. Owner goes to Settings → Team → their own profile
2. "Transfer ownership" option (only visible to Owner)
3. Select a Manager or Accountant to become new Owner
4. Confirmation modal with clear warning:
   ```
   You are transferring ownership of Datum Creative 
   Media Limited to Jane Smith.
   
   Jane will become the Owner with full control 
   including billing, user management, and tenant 
   deletion.
   
   You will become a Manager and retain operational 
   access but lose Owner-only permissions.
   
   This action is immediate and recorded permanently 
   in the audit log.
   
   [Cancel]  [Transfer ownership]
   ```
5. Current Owner becomes Manager (retains access but loses Owner-only permissions)
6. New Owner gets full control
7. Audit log records the transfer (financial category — 7 year retention)
8. Email notification sent to both parties

Only one Owner at a time. Transfer is immediate on confirmation.

---

## 12. AUDIT LOG UI

### 12.1 Settings → Audit Log Page

```
Settings → Audit Log

Filters: [Date range ▼] [User ▼] [Category ▼] [Entity ▼]

                                          [Export CSV]

┌────────────────────────────────────────────────────────────┐
│ 11 Apr 10:15  Simon Kramer (Owner)                         │
│ Changed safety threshold from £20,000 to £25,000           │
│ Category: Operational                                      │
├────────────────────────────────────────────────────────────┤
│ 11 Apr 10:12  Jane Smith (Manager)                         │
│ Approved email to Mentzendorff & Co — Friendly reminder     │
│ Category: Operational                                      │
├────────────────────────────────────────────────────────────┤
│ 11 Apr 09:45  Simon Kramer (Owner)                         │
│ Granted Capital (view) access to Jane Smith (Manager)       │
│ Category: Operational                                      │
├────────────────────────────────────────────────────────────┤
│ 10 Apr 18:30  Tom Brown (Controller)                       │
│ Put Cre8tive Input on hold                                  │
│ Category: Operational                                      │
├────────────────────────────────────────────────────────────┤
│ 10 Apr 14:00  Simon Kramer (Owner)                         │
│ Finance requested: 3 invoices, £23,714, est. cost £979     │
│ Category: Financial                                        │
└────────────────────────────────────────────────────────────┘

[Load more]
```

### 12.2 Audit in Debtor Detail

The debtor detail page shows audit entries filtered to that debtor — who changed what, when. Supplements the Activity Feed with administrative actions (hold changes, VIP changes, tone overrides, note additions).

### 12.3 Export

Owner (and Accountant with billing delegation) can export audit log to CSV:
- Filtered by current filter settings
- Includes all columns
- Reminder shown before operational records are purged at 2-year mark

---

## 13. BUILD PHASES

### Phase 1: Schema + Role Assignment (foundation)
- Extend users table with role, status fields
- Create userDelegations table
- Create auditLog table
- Create userInvitations table
- Create ownerFailsafe table
- Assign Owner role to current single user per tenant
- Permission middleware (requireRole, requireDelegation, requireRoleOrDelegation)
- Permission hook (usePermissions) on frontend

### Phase 2: Settings → Team UI
- Team page with user list, role badges, status
- Invite modal with role selection (filtered by inviter's role)
- Clerk email invitation flow
- Invitation management (resend, revoke)
- Re-invite from removed users
- Delegation toggles for Manager and Accountant
- Three-dot menu (change role, remove)
- Emergency contact section
- Delegation change email notifications

### Phase 3: Frontend Permission Gating
- Apply usePermissions across all pages
- Hide sidebar items based on role
- Hide action buttons based on role
- Controller read-only communication mode indicator
- 403 page for direct URL access without permission
- Riley context adjustment per role

### Phase 4: API Permission Enforcement
- Apply requireRole/requireDelegation to all routes
- Invitation hierarchy enforcement
- Audit logging on all significant actions
- Before/after capture for setting changes
- Permission denied logging

### Phase 5: Audit Log UI
- Settings → Audit Log page
- Filters (date, user, category, entity)
- Debtor detail audit section
- Export to CSV (Owner + delegated Accountant)
- Retention cleanup job (2 years operational, 7 years financial)

### Phase 6: Owner Transfer + Failsafe
- Transfer ownership flow
- Confirmation modal
- Role swap (Owner → Manager, target → Owner)
- Emergency contact CRUD
- Support-assisted transfer process documentation

---

## 14. MIGRATION STRATEGY

For existing tenants with a single user:

1. Schema migration adds role column with DEFAULT 'owner'
2. All existing users automatically become Owner
3. No disruption to existing functionality
4. RBAC enforcement is additive — existing endpoints work as before, new middleware adds checks
5. Settings → Team page appears in sidebar for Owner role
6. Emergency contact prompt shown on first login after migration

---

## 15. ACCOUNTANT ↔ PARTNER PORTAL BOUNDARY

This spec covers the Accountant role within a single tenant. The Partner Portal spec (separate document) covers:

- How Accountants see multiple tenants
- Portfolio-level views and dashboards
- Cross-client debtor workspace
- Partner-side user management (staff at the accounting firm)
- White-labelling
- The reverse onboarding flow (accountant creates tenant for client)
- Accountant invitation from the partner side

The two specs share the Accountant role definition and the `partnerTenantLinks` table. The RBAC spec defines what an Accountant can do within a tenant. The Partner Portal spec defines how they navigate between tenants and see aggregate data.

---

*Specification version: 1.1 — 11 April 2026*
*Author: Simon Kramer / Claude*
*Status: Specification complete — reviewed and revised. Implementation follows Phase 1-6 order.*
*Dependencies: Clerk auth (exists), tenant isolation (exists)*
*Cross-references: Partner Portal spec (pending), Settings UI (exists)*
*Review notes: v1.0 → v1.1 changes: removed Viewer role, added Manager invitation hierarchy constraint, added Autonomy to Accountant delegations, split Capital into view/request, simplified status to active/removed with re-invite, added Owner failsafe (emergency contact + accountant backstop), tiered audit retention (2yr operational / 7yr financial), added delegation change notifications, added wrong-email flow for accountant invitations*
