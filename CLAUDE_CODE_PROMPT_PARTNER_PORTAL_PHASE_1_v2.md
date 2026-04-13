# CLAUDE CODE PROMPT — PARTNER PORTAL PHASE 1: SCHEMA + ORG SWITCHER

## CONTEXT

Qashivo is adding a Partner Portal for accounting firms and invoice finance funders to manage multiple SME clients through a single interface. This is Phase 1 of 8 — the foundation that everything else builds on.

The UI refresh is complete. The q-token design system is in place with unified filtering (QFilterTabs), consistent tables, QMetricCard, QBadge, QAmount, and all pages following the same visual language. All new UI must follow these patterns exactly — no exceptions.

Reference documents (read these from ~/Documents/qashivo if you need detail):
- PARTNER_PORTAL_SPEC.md (Sections 1-5 for this phase)
- FUNDTECH_FUNDER_SPEC.md (for the demo funder seed)
- QASHIVO_DESIGN_TOKENS_SPEC.md (design system reference)

## DESIGN SYSTEM RULES — MANDATORY FOR ALL NEW UI

These rules apply to EVERY element created in this prompt:

1. **Page titles** go in AppShell title/subtitle props (sticky header). Never use QPageHeader in the page body.
2. **All surfaces** are warm gray (--q-bg-page). Only cards are white (--q-bg-surface) with border border-[var(--q-border-default)] rounded-q-lg.
3. **Tables** match the Debtors list exactly: white card container, sentence case column headers (11px, tracking-[0.3px], --q-text-tertiary), h-12 rows, hover:bg-[var(--q-bg-surface-hover)], right-aligned mono amounts. Never uppercase headers.
4. **Metric cards** use QMetricCard component with min-h-[100px] and items-stretch on the grid container.
5. **Status indicators** use QBadge (ready/risk/attention/info/vip/neutral variants with dot prefix).
6. **Monetary values** use QAmount component (mono, tabular-nums, right-aligned).
7. **Filtering and tabs** use QFilterTabs component — text underline style. Active: font-medium + accent underline. Inactive: tertiary text. No filled pills, no coloured backgrounds on filters. Ever.
8. **Navigation tabs** (switching between views) use the same QFilterTabs visual treatment.
9. **Days** shown as number + muted "days" suffix, never abbreviated "30d".
10. **Recharts** tooltips always cursor={false}.
11. **No hardcoded colours** — everything from q- tokens.
12. **Empty states** use QEmptyState component.
13. **Loading states** use QSkeleton / QMetricCardSkeleton / QTableRowSkeleton.

## WHAT THIS PHASE DELIVERS

1. Database schema for partner accounts, users, links, and assignments
2. Org switcher dropdown in the sidebar
3. Context switching between partner portal and individual client tenants
4. Sidebar branding that changes based on user context
5. Partner portal sidebar navigation
6. FundTech demo funder seeded with links to all existing tenants
7. Placeholder pages for all portal routes

## STEP 1: DATABASE SCHEMA

Create the following tables using Drizzle ORM. Run `npm run db:push` to apply.

### 1.1 partnerAccounts

```typescript
export const partnerAccounts = pgTable('partner_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  firmName: text('firm_name').notNull(),
  firmRegistrationNumber: text('firm_registration_number'),
  primaryContactId: uuid('primary_contact_id').references(() => users.id),
  logoUrl: text('logo_url'),
  brandColour: varchar('brand_colour', { length: 7 }),
  website: text('website'),
  phone: text('phone'),
  address: jsonb('address'),
  partnerType: varchar('partner_type', { length: 20 }).notNull().default('accountant'),
  partnerTier: varchar('partner_tier', { length: 20 }).default('standard'),
  funderConfig: jsonb('funder_config'),
  status: varchar('status', { length: 20 }).default('active'),
  onboardedAt: timestamp('onboarded_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 1.2 partnerUsers

```typescript
export const partnerUsers = pgTable('partner_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partnerAccounts.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  partnerRole: varchar('partner_role', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).default('active'),
  invitedBy: uuid('invited_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 1.3 partnerTenantLinks

```typescript
export const partnerTenantLinks = pgTable('partner_tenant_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partnerAccounts.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  linkedAt: timestamp('linked_at').defaultNow(),
  linkedBy: uuid('linked_by').references(() => users.id),
  status: varchar('status', { length: 20 }).default('active'),
  accessLevel: varchar('access_level', { length: 20 }).default('full'),
  clientDisplayName: text('client_display_name'),
  clientNumber: varchar('client_number', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 1.4 controllerAssignments

```typescript
export const controllerAssignments = pgTable('controller_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partnerAccounts.id),
  partnerUserId: uuid('partner_user_id').notNull().references(() => partnerUsers.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  assignedBy: uuid('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow(),
  removedAt: timestamp('removed_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 1.5 Extend tenants table

Add: `isDemoData: boolean('is_demo_data').default(false)`

## STEP 2: API ENDPOINTS

### 2.1 Partner context

```
GET /api/partner/context
```

Returns:
```typescript
{
  isPartner: boolean,
  partner: {
    id: string,
    firmName: string,
    partnerType: 'accountant' | 'funder',
    partnerTier: string,
    partnerRole: 'admin' | 'credit_controller',
  } | null,
  clients: [
    {
      tenantId: string,
      companyName: string,
      clientDisplayName: string | null,
      clientNumber: string | null,
      status: string,
      totalOutstanding: number,
      totalOverdue: number,
      dso: number,
      healthStatus: 'healthy' | 'attention' | 'critical' | 'inactive',
    }
  ]
}
```

Credit controllers see only assigned tenants. Admins see all linked tenants.

### 2.2 Context switching

```
POST /api/partner/switch-context
Body: { tenantId: string }
```

Verifies the user has a partnerTenantLink, updates session tenant scoping.

```
POST /api/partner/switch-to-portal
```

Clears tenant scoping, returns to portal context.

## STEP 3: ORG SWITCHER COMPONENT

### 3.1 Location

Replace the static company name below the Qashivo logo in the sidebar.

### 3.2 Non-partner users

Static company name as it is now. No dropdown, no change.

### 3.3 Partner users — collapsed state

Show current context with a dropdown chevron:

```
When viewing partner portal:
  FundTech Capital Limited    ▾

When viewing a client:
  Datum Creative Media        ▾
  ← Back to portfolio
```

"← Back to portfolio" is a clickable link styled as:
text-[13px] text-[var(--q-accent)] hover:underline

### 3.4 Partner users — expanded dropdown

Dropdown panel styled with q-tokens:

```tsx
<div className="absolute left-0 top-full mt-1 w-72 bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-q-lg shadow-lg z-50 overflow-hidden">
  {/* Search */}
  <div className="px-3 py-2 border-b border-[var(--q-border-default)]">
    <input
      type="text"
      placeholder="Search clients..."
      className="w-full text-[14px] bg-transparent text-[var(--q-text-primary)] placeholder:text-[var(--q-text-muted)] outline-none"
    />
  </div>

  {/* Client list */}
  <div className="max-h-64 overflow-y-auto py-1">
    {clients.map(client => (
      <button
        key={client.tenantId}
        onClick={() => switchToClient(client.tenantId)}
        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100 text-left"
      >
        {/* Health dot */}
        <span className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          client.healthStatus === 'healthy' && "bg-[var(--q-money-in-text)]",
          client.healthStatus === 'attention' && "bg-[var(--q-attention-text)]",
          client.healthStatus === 'critical' && "bg-[var(--q-risk-text)]",
          client.healthStatus === 'inactive' && "bg-[var(--q-text-muted)]",
        )} />

        {/* Client info */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[var(--q-text-primary)] truncate">
            {client.clientDisplayName || client.companyName}
          </p>
        </div>

        {/* Quick metrics */}
        <div className="text-right flex-shrink-0">
          <p className="text-[12px] font-q-mono tabular-nums text-[var(--q-text-secondary)]">
            £{(client.totalOutstanding / 1000).toFixed(0)}k
          </p>
          <p className="text-[11px] text-[var(--q-text-tertiary)]">
            {client.dso} <span className="text-[var(--q-text-muted)]">days</span>
          </p>
        </div>
      </button>
    ))}
  </div>

  {/* Divider */}
  <div className="border-t border-[var(--q-border-default)]" />

  {/* Add client — admin only */}
  {isAdmin && (
    <button className="w-full px-3 py-2 text-[14px] text-[var(--q-accent)] hover:bg-[var(--q-bg-surface-hover)] text-left">
      + Add client
    </button>
  )}

  {/* Divider */}
  <div className="border-t border-[var(--q-border-default)]" />

  {/* Back to portal */}
  <button
    onClick={() => switchToPortal()}
    className="w-full px-3 py-2 text-[14px] font-medium text-[var(--q-text-primary)] hover:bg-[var(--q-bg-surface-hover)] text-left"
  >
    {partner.firmName}
    <span className="text-[12px] text-[var(--q-text-tertiary)] ml-2">Portfolio</span>
  </button>
</div>
```

### 3.5 Search filtering

Case-insensitive filter on company name, client display name, and client number.

### 3.6 Keyboard shortcut

`Cmd+K` (Mac) / `Ctrl+K` (Windows) opens the org switcher.

## STEP 4: SIDEBAR BRANDING

### 4.1 Dynamic product name

```tsx
function SidebarBrand({ partnerContext }) {
  if (partnerContext?.partner?.partnerType === 'funder') {
    return (
      <div className="flex items-center gap-2">
        {/* Qashivo logo icon */}
        <span className="text-[var(--q-text-primary)] font-semibold">Qashivo</span>
        <span className="text-[var(--q-attention-text)] font-semibold">Finance</span>
      </div>
    );
  }
  
  if (partnerContext?.partner?.partnerType === 'accountant') {
    return (
      <div className="flex items-center gap-2">
        {/* Qashivo logo icon */}
        <span className="text-[var(--q-text-primary)] font-semibold">Qashivo</span>
        <span className="text-[var(--q-money-in-text)] font-semibold">Partner</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Qashivo logo icon */}
      <span className="text-[var(--q-text-primary)] font-semibold">Qashivo</span>
    </div>
  );
}
```

### 4.2 Company name below brand

`text-[12px] text-[var(--q-text-tertiary)]`
- Partner portal: firm name
- Client context: client company name
- SME: tenant name (unchanged)

## STEP 5: CONTEXT SWITCHING

### 5.1 Frontend state

Create or extend context:

```typescript
interface PartnerContext {
  isPartner: boolean;
  partner: PartnerInfo | null;
  clients: ClientSummary[];
  activeView: 'portal' | 'client';
  activeClientId: string | null;
}
```

### 5.2 Switching to a client

1. Call `POST /api/partner/switch-context` with tenant ID
2. Update context: `activeView = 'client'`, `activeClientId = tenantId`
3. Sidebar shows client's Qashivo nav (Qollections, Qashflow, Qapital, Settings)
4. Navigate to `/home`

### 5.3 Switching back to portal

1. Call `POST /api/partner/switch-to-portal`
2. Update context: `activeView = 'portal'`, `activeClientId = null`
3. Sidebar shows partner portal nav
4. Navigate to `/partner/dashboard`

### 5.4 Partner portal sidebar navigation

When `activeView === 'portal'`, render portal nav using the same nav item styling as existing sidebar items (same classes, same hover/active states, same icon sizing):

**Accountant portal:**
```
[Qashivo Partner]
[Firm name]

Portfolio Dashboard
Activity Feed
Reports

Settings
  Staff & Assignments
  Firm Details
  Billing
```

**Funder portal:**
```
[Qashivo Finance]
[Firm name]

Lending Book
Applications
Concentration
Settlements

Settings
  Team
  Funder Config
  Collection Rules
```

Nav items use the existing sidebar nav item classes — same padding, same font, same hover, same active state. The section labels ("Settings") use the existing q-section-label treatment (10px uppercase, tracking, tertiary colour).

## STEP 6: PLACEHOLDER PAGES

Create placeholder pages for every portal route. Each page:
- Uses AppShell with appropriate title/subtitle
- Shows QEmptyState with a descriptive message
- Lives in `client/src/pages/partner/`

Pages to create:

| Route | Title | Subtitle | Empty state message |
|-------|-------|----------|-------------------|
| `/partner/dashboard` | Portfolio Dashboard | All clients at a glance | Portfolio dashboard coming in Phase 2 |
| `/partner/activity` | Activity Feed | Events across all clients | Activity feed coming in Phase 5 |
| `/partner/reports` | Reports | Portfolio and client reports | Reports coming in Phase 7 |
| `/partner/settings/staff` | Staff & Assignments | Manage your team | Staff management coming in Phase 4 |
| `/partner/settings/firm` | Firm Details | Your practice information | Firm settings coming in Phase 4 |
| `/partner/settings/billing` | Billing | Subscription and invoices | Billing coming in Phase 4 |
| `/partner/lending-book` | Lending Book | Your deployed capital | Lending book coming in Phase F1 |
| `/partner/applications` | Applications | Finance requests pending review | Applications coming in Phase F3 |
| `/partner/concentration` | Concentration | Exposure analysis | Concentration analysis coming in Phase F4 |
| `/partner/settlements` | Settlements | Collection and settlement processing | Settlements coming in Phase F5 |
| `/partner/settings/config` | Funder Configuration | Default rates and limits | Funder config coming in Phase F6 |
| `/partner/settings/collection` | Collection Rules | Chase settings for funded invoices | Collection rules coming in Phase F6 |

Funder-only routes (lending-book, applications, concentration, settlements, settings/config, settings/collection) should redirect non-funder users to `/partner/dashboard`.

## STEP 7: SEED FUNDTECH

Create `server/services/fundTechSeed.ts`:

```typescript
export async function seedFundTechPartner(): Promise<void> {
  // 1. Create partnerAccount
  //    firmName: "FundTech Capital Limited"
  //    partnerType: "funder"
  //    partnerTier: "gold"
  //    funderConfig: {
  //      defaultInterestRate: 3.2,
  //      facilityFeePerInvoice: 50,
  //      advanceRate: 80,
  //      retentionRate: 20,
  //      maxFacilityPerClient: 500000,
  //      minInvoiceAmount: 500,
  //      maxInvoiceAge: 90,
  //      concentrationLimit: 30,
  //      disclosedFactoring: false
  //    }

  // 2. Link the CURRENT logged-in user (or first admin user) 
  //    as admin of FundTech — allows switching between SME and 
  //    funder portal without separate login

  // 3. Create partnerTenantLinks to ALL existing tenants

  // 4. Log what was created
}

export async function clearFundTechPartner(): Promise<void> {
  // Delete in FK order
}
```

Add CLI commands:
- `npm run seed:fundtech` → runs seedFundTechPartner()
- `npm run seed:fundtech:clear` → runs clearFundTechPartner()

Add API endpoints:
- `POST /api/admin/seed-fundtech` (protected, admin only)
- `POST /api/admin/clear-fundtech` (protected, admin only)

## STEP 8: ROUTING

Add routes for all partner portal pages using Wouter.

Partner routes guarded: only accessible if user is a partner user AND in portal context. Non-partner users navigating to `/partner/*` redirect to `/home`.

Funder-specific routes only accessible if `partnerType === 'funder'`.

## FILES TO CREATE

1. Schema additions (in existing schema file or new partner schema file)
2. `server/routes/partnerRoutes.ts` — API endpoints
3. `server/services/fundTechSeed.ts` — seed script
4. `client/src/components/layout/org-switcher.tsx` — org switcher dropdown
5. `client/src/contexts/partner-context.tsx` — partner state (or extend existing)
6. `client/src/pages/partner/` — all 12 placeholder pages

## FILES TO MODIFY

1. `client/src/components/layout/new-sidebar.tsx` — integrate org switcher, dynamic branding, portal nav
2. Routing config — add partner routes with guards
3. Schema index — export new tables
4. `package.json` — add seed:fundtech scripts

## WHAT NOT TO TOUCH

- Existing tenant-level pages — they continue working as-is
- Existing RBAC system — partner permissions layer on top
- Existing API endpoints — all current endpoints stay tenant-scoped
- The design token system — use it, don't modify it
- Any existing components — use them, don't modify them

## VERIFICATION

1. `npm run db:push` succeeds — four new tables created
2. `npm run seed:fundtech` creates FundTech and links to all tenants
3. App loads without errors
4. Sidebar shows "Qashivo Finance" with "FundTech Capital Limited" below (if seeded)
5. Clicking the company name area opens the org switcher dropdown
6. Org switcher lists all tenants with health dots, outstanding (£Xk format), and DSO (number + "days" suffix)
7. Clicking a client switches context — sidebar shows client's Qashivo nav
8. "← Back to portfolio" returns to the partner portal context
9. Partner portal sidebar shows correct nav items for funder type
10. All placeholder pages render with AppShell title + QEmptyState
11. `Cmd+K` opens the org switcher
12. Non-partner users see no org switcher — static company name unchanged
13. Funder-only routes redirect non-funders to dashboard
14. No TypeScript or build errors
15. All new UI uses q-tokens — no hardcoded colours
16. Dropdown, cards, and text follow the design system exactly
