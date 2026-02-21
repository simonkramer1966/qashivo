# Partner Hierarchy System (B2B2B Model)

## Overview

The Partner Hierarchy System implements a **B2B2B (Business-to-Business-to-Business)** model designed for accounting firms to manage multiple client businesses through a single platform. This three-tier architecture enables accounting firms (partners) to provide collection services to their clients (tenants) while maintaining strict data isolation and granular access control.

### Business Model

```
┌─────────────────────────────────────────────────┐
│              QASHIVO PLATFORM                   │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │                           │
┌───────▼────────┐         ┌────────▼────────┐
│   PARTNER 1    │         │   PARTNER 2     │
│ (Accounting    │         │ (Accounting     │
│  Firm A)       │         │  Firm B)        │
└────────────────┘         └─────────────────┘
        │                           │
    ┌───┼───┬───┐              ┌────┼───┐
    │       │   │              │        │
┌───▼─┐ ┌──▼┐ ┌─▼──┐      ┌───▼─┐  ┌──▼─┐
│TENANT│ │TEN│ │TEN │      │TENANT│  │TEN │
│  A1  │ │ A2│ │ A3 │      │  B1  │  │ B2 │
│(Biz1)│ │(B2)│ │(B3)│      │(Biz4)│  │(B5)│
└──────┘ └───┘ └────┘      └──────┘  └────┘
   │       │      │            │        │
 Users   Users  Users       Users    Users
```

### Key Concepts

| Layer | Entity | Description |
|-------|--------|-------------|
| **Tier 1** | **Platform** | Qashivo AR platform (SaaS provider) |
| **Tier 2** | **Partners** | Accounting firms managing multiple client businesses |
| **Tier 3** | **Tenants** | Client businesses (e.g., SMEs) using collection services |
| **Tier 4** | **Users** | Team members within tenants with specific roles |

---

## Architecture Layers

### 1. Platform Level (Qashivo)
- Operates the SaaS infrastructure
- Manages subscription billing and plans
- Provides platform-wide administration
- Handles system-level configuration

### 2. Partner Level (Accounting Firms)
**Examples**: KPMG, Deloitte, local accounting firms

**Characteristics**:
- Own organization with branding (logo, colors)
- Subscription-based access to platform
- Manage multiple client businesses (tenants)
- User accounts with `role: "partner"` and `partnerId`
- Can switch between client tenants using session-based context

**Capabilities**:
- Full visibility across all assigned client tenants
- Manage client tenant users and permissions
- Access client data for collection oversight
- Assign users to specific customer contacts within client tenants

### 3. Tenant Level (Client Businesses)
**Examples**: Local retail shops, service companies, manufacturers

**Characteristics**:
- Individual business organizations
- Own customer base (contacts/debtors)
- Invoice and collection data
- Team members (users) with tenant-specific roles

**User Roles within Tenants**:
- **Admin**: Full tenant management capabilities
- **Collector**: Access to assigned contacts only
- **Viewer**: Read-only access

### 4. User Level (Team Members)
**Types**:
- **Platform Admin**: Qashivo employees (`platformAdmin: true`)
- **Partner Users**: Accounting firm staff (`role: "partner"`, has `partnerId`)
- **Tenant Users**: Client business staff (has `tenantId`, `tenantRole` determines access level)

---

## Database Schema

### Partners Table

Stores accounting firm organizations with subscription and branding details.

```typescript
export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Partner details
  name: varchar("name").notNull(),                    // Accounting firm name
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  website: varchar("website"),
  
  // Address
  addressLine1: varchar("address_line1"),
  addressLine2: varchar("address_line2"),
  city: varchar("city"),
  state: varchar("state"),
  postalCode: varchar("postal_code"),
  country: varchar("country").default("GB"),
  
  // Branding
  logoUrl: varchar("logo_url"),
  brandColor: varchar("brand_color").default("#17B6C3"),
  
  // Subscription and billing
  subscriptionPlanId: varchar("subscription_plan_id").references(() => subscriptionPlans.id),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("active"),
  
  // Usage and limits
  currentClientCount: integer("current_client_count").default(0),
  maxClientCount: integer("max_client_count").default(10),  // Based on plan
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | varchar | Legal business name of the accounting firm |
| `subscriptionPlanId` | varchar | Links to pricing tier (Starter/Professional/Enterprise) |
| `stripeCustomerId` | varchar | Stripe customer ID for billing |
| `subscriptionStatus` | varchar | active, past_due, cancelled, suspended |
| `currentClientCount` | integer | Number of active client tenants |
| `maxClientCount` | integer | Maximum clients allowed per subscription plan |
| `logoUrl` | varchar | Partner branding for client-facing interfaces |
| `brandColor` | varchar | Primary color for partner white-labeling |

### Partner-Client Relationships Table

Manages access permissions between partner users and client tenants.

```typescript
export const partnerClientRelationships = pgTable("partner_client_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // The partner (accountant)
  partnerUserId: varchar("partner_user_id").notNull().references(() => users.id),
  partnerTenantId: varchar("partner_tenant_id").notNull().references(() => tenants.id),
  
  // The client tenant they have access to
  clientTenantId: varchar("client_tenant_id").notNull().references(() => tenants.id),
  
  // Relationship metadata
  status: varchar("status").notNull().default("active"),  // active, suspended, terminated
  accessLevel: varchar("access_level").notNull().default("full"),  // full, read_only, limited
  
  // Permission overrides
  permissions: jsonb("permissions").default("[]"),  // Specific permissions for this relationship
  
  // Relationship tracking
  establishedAt: timestamp("established_at").defaultNow(),
  establishedBy: varchar("established_by").notNull(),  // "invitation", "direct_assignment"
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // Termination tracking
  terminatedAt: timestamp("terminated_at"),
  terminatedBy: varchar("terminated_by").references(() => users.id),
  terminationReason: text("termination_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure unique partner-client relationships
  unique("unique_partner_client").on(table.partnerUserId, table.clientTenantId),
  index("idx_partner_relationships_partner").on(table.partnerUserId),
  index("idx_partner_relationships_client").on(table.clientTenantId),
  index("idx_partner_relationships_status").on(table.status),
]);
```

**Relationship Lifecycle**:

```
established (invitation/direct) → active → suspended → terminated
                                         ↘ reactivated → active
```

**Access Levels**:

| Level | Permissions |
|-------|-------------|
| **full** | Complete access to all tenant data and operations |
| **read_only** | View-only access (no modifications) |
| **limited** | Custom permission set defined in `permissions` JSON field |

### User Contact Assignments Table

Assigns specific credit controllers to customer contacts within a tenant.

```typescript
export const userContactAssignments = pgTable("user_contact_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Assignment details
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Assignment metadata
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
  
  // Status
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure unique user-contact assignments per tenant
  unique("unique_user_contact_assignment").on(table.userId, table.contactId),
  index("idx_user_contact_assignments_user").on(table.userId),
  index("idx_user_contact_assignments_contact").on(table.contactId),
  index("idx_user_contact_assignments_tenant").on(table.tenantId),
  index("idx_user_contact_assignments_active").on(table.isActive),
]);
```

**Purpose**: Enables granular access control so credit controllers only see contacts assigned to them.

### Users Table Extensions

Standard user records extended with partner and tenant relationships.

```typescript
// Extended fields in users table
{
  // Standard fields
  id: varchar("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  name: varchar("name").notNull(),
  
  // Global role (determines base permissions)
  role: varchar("role").default("user"),  // owner, partner, user
  
  // Partner relationship
  partnerId: varchar("partner_id").references(() => partners.id),
  
  // Tenant relationship
  tenantId: varchar("tenant_id").references(() => tenants.id),
  tenantRole: varchar("tenant_role"),  // owner, admin, accountant, manager, credit_controller, readonly
  
  // Platform access
  platformAdmin: boolean("platform_admin").default(false),
}
```

**User Types by Role**:

| Global Role | Partner ID | Tenant ID | Description |
|-------------|------------|-----------|-------------|
| `owner` | NULL | SET | Business owner of a tenant |
| `partner` | SET | SET | Accounting firm user (partner tenant) |
| `user` | NULL | SET | Regular team member within tenant |
| Platform Admin | Any | Any | Qashivo employee (platformAdmin=true) |

---

## RBAC (Role-Based Access Control)

### RBAC Context Structure

Every authenticated request includes RBAC context via `req.rbac`:

```typescript
interface RBACContext {
  userId: string;
  tenantId: string;              // Active tenant context
  userRole: 'owner' | 'partner' | 'user';
  tenantRole?: 'owner' | 'admin' | 'accountant' | 'manager' | 'credit_controller' | 'readonly';
  permissions: string[];         // Computed permissions for active tenant
  isPartner: boolean;            // True if role=partner and partnerId exists
  partnerId?: string;            // Partner organization ID
  activeTenantId: string;        // Current working tenant (important for partners)
}
```

### RBAC Middleware: `withRBACContext`

**Location**: `server/middleware/rbac.ts`

**Purpose**: Determines user's active tenant context and loads appropriate permissions.

**Flow for Partner Users**:

```typescript
export const withRBACContext: RequestHandler = async (req, res, next) => {
  // 1. Verify authentication
  if (!req.user?.claims?.sub) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  
  // 2. Identify partner users
  const isPartner = user.role === 'partner' && !!user.partnerId;
  
  // 3. Determine active tenant context
  let activeTenantId: string;
  
  if (isPartner) {
    // Partner users: check query param → session → require selection
    const sessionTenantId = req.session?.activeTenantId;
    const queryTenantId = req.query.tenantId as string | undefined;
    
    activeTenantId = queryTenantId || sessionTenantId || '';
    
    if (!activeTenantId) {
      return res.status(400).json({ 
        message: 'Partner must select active tenant',
        isPartner: true,
        requiresTenantSelection: true
      });
    }
    
    // Verify partner has access to selected tenant
    const accessibleTenants = await storage.getPartnerTenants(userId);
    const hasAccess = accessibleTenants.some(t => t.id === activeTenantId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Partner does not have access to this tenant' 
      });
    }
    
    // Update session if tenant changed
    if (queryTenantId && queryTenantId !== sessionTenantId) {
      req.session.activeTenantId = queryTenantId;
    }
  } else {
    // Regular users: use assigned tenant
    activeTenantId = user.tenantId;
  }
  
  // 4. Load permissions for active tenant
  const permissions = await PermissionService.getUserPermissions(userId, activeTenantId);
  
  // 5. Populate RBAC context
  req.rbac = {
    userId,
    tenantId: activeTenantId,
    userRole: user.role,
    tenantRole: user.tenantRole,
    permissions,
    isPartner,
    partnerId: user.partnerId,
    activeTenantId
  };
  
  next();
};
```

### Access Control Middleware

#### `requirePartnerAccess`

Enforces partner-only endpoints.

```typescript
export const requirePartnerAccess: RequestHandler = async (req, res, next) => {
  if (!req.rbac) {
    return res.status(500).json({ message: 'RBAC context not initialized' });
  }
  
  const { userRole, isPartner } = req.rbac;
  
  if (!isPartner || userRole !== 'partner') {
    return res.status(403).json({ 
      message: 'Partner access required' 
    });
  }
  
  next();
};
```

#### `requireTenantAdmin`

Enforces tenant-admin level access.

```typescript
export const requireTenantAdmin: RequestHandler = async (req, res, next) => {
  const { tenantRole, userRole } = req.rbac;
  
  // Owner and admin roles have tenant-admin access
  if (userRole === 'owner' || tenantRole === 'admin') {
    return next();
  }
  
  return res.status(403).json({ 
    message: 'Tenant admin access required' 
  });
};
```

#### `enforceContactAccess`

Restricts credit controllers to assigned contacts only.

```typescript
export const enforceContactAccess: RequestHandler = async (req, res, next) => {
  const { tenantRole, userId, tenantId } = req.rbac;
  
  // Admins and owners bypass contact restrictions
  if (tenantRole === 'admin' || req.rbac.userRole === 'owner') {
    return next();
  }
  
  // Collectors must have contact assignment
  const contactId = req.params.contactId || req.body.contactId;
  if (!contactId) {
    return res.status(400).json({ message: 'Contact ID required' });
  }
  
  const hasAccess = await storage.hasContactAccess(userId, contactId, tenantId);
  if (!hasAccess) {
    return res.status(403).json({ 
      message: 'Access denied to this contact' 
    });
  }
  
  next();
};
```

---

## Tenant Switching (Partner Feature)

### How It Works

Partner users can switch between client tenants without re-authenticating.

**Session-Based Context**:
```typescript
req.session.activeTenantId = "client-tenant-123";
```

**Query Parameter Override**:
```
GET /api/invoices?tenantId=client-tenant-456
```

**Frontend Implementation**:

```typescript
// Tenant switcher dropdown
const switchTenant = async (newTenantId: string) => {
  // Update session and refresh queries
  await apiRequest('POST', '/api/partner/switch-tenant', { 
    tenantId: newTenantId 
  });
  
  // Invalidate all queries to reload with new tenant context
  queryClient.invalidateQueries();
  
  // Update local state
  setActiveTenantId(newTenantId);
};
```

**Backend Endpoint**:

```typescript
// POST /api/partner/switch-tenant
app.post('/api/partner/switch-tenant', 
  isAuthenticated, 
  withRBACContext, 
  requirePartnerAccess,
  async (req, res) => {
    const { tenantId } = req.body;
    const { userId } = req.rbac;
    
    // Verify partner has access to requested tenant
    const accessibleTenants = await storage.getPartnerTenants(userId);
    const hasAccess = accessibleTenants.some(t => t.id === tenantId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied to this tenant' 
      });
    }
    
    // Update session
    req.session.activeTenantId = tenantId;
    
    // Update last accessed timestamp
    await storage.updatePartnerRelationshipAccess(userId, tenantId);
    
    res.json({ 
      success: true, 
      activeTenantId: tenantId 
    });
  }
);
```

---

## API Endpoints

### Partner Management

#### Get Partner Tenants

Retrieve all client tenants accessible to partner user.

```
GET /api/partner/tenants

Authentication: Required (partner users only)
Middleware: isAuthenticated, withRBACContext, requirePartnerAccess

Response:
[
  {
    id: "tenant-123",
    name: "ABC Manufacturing Ltd",
    email: "accounts@abc-manufacturing.com",
    isActive: true,
    relationship: {
      id: "rel-456",
      accessLevel: "full",
      status: "active",
      establishedAt: "2025-01-15T10:00:00Z",
      lastAccessedAt: "2025-10-18T09:30:00Z"
    }
  }
]
```

#### Switch Active Tenant

Change session context to different client tenant.

```
POST /api/partner/switch-tenant

Authentication: Required (partner users only)
Middleware: isAuthenticated, withRBACContext, requirePartnerAccess

Request Body:
{
  tenantId: "tenant-789"
}

Response:
{
  success: true,
  activeTenantId: "tenant-789"
}

Errors:
- 403: Partner does not have access to requested tenant
- 400: Invalid tenant ID
```

#### Get Partner Context

Retrieve current partner user context and accessible tenants.

```
GET /api/auth/context

Authentication: Required
Middleware: isAuthenticated, withRBACContext

Response:
{
  user: {
    id: "user-123",
    email: "john@accountingfirm.com",
    name: "John Smith",
    role: "partner",
    partnerId: "partner-456",
    tenantId: "partner-tenant-789"
  },
  rbac: {
    isPartner: true,
    activeTenantId: "client-tenant-101",
    userRole: "partner",
    tenantRole: "admin",
    permissions: ["invoices.view", "invoices.edit", ...]
  },
  accessibleTenants: [
    { id: "client-tenant-101", name: "ABC Ltd" },
    { id: "client-tenant-202", name: "XYZ Corp" }
  ]
}
```

### Partner CRUD Operations

#### Create Partner

```
POST /api/partners

Authentication: Required (owner-only)
Middleware: isAuthenticated, requireOwner

Request Body:
{
  name: "Smith & Associates Accounting",
  email: "contact@smithaccounting.com",
  phone: "+442079460000",
  website: "https://smithaccounting.com",
  addressLine1: "123 High Street",
  city: "London",
  postalCode: "SW1A 1AA",
  country: "GB",
  subscriptionPlanId: "plan-professional"
}

Response: Partner (created record)
```

#### Get Partners

```
GET /api/partners

Authentication: Required (owner-only)
Middleware: isAuthenticated, requireOwner

Response: Partner[]
```

#### Update Partner

```
PATCH /api/partners/:partnerId

Authentication: Required (owner-only)
Middleware: isAuthenticated, requireOwner

Request Body: Partial<Partner>

Response: Partner (updated record)
```

### User Contact Assignments

#### Get User Assignments

```
GET /api/users/:userId/assignments

Authentication: Required (tenant-admin)
Middleware: isAuthenticated, withRBACContext, requireTenantAdmin

Query Params:
- tenantId: string (required for partner users)

Response:
[
  {
    id: "assignment-123",
    userId: "user-456",
    contactId: "contact-789",
    contact: {
      id: "contact-789",
      name: "ABC Corporation",
      email: "accounts@abc.com",
      companyName: "ABC Corp Ltd"
    },
    assignedAt: "2025-10-01T12:00:00Z",
    assignedBy: "user-admin-001",
    isActive: true
  }
]
```

#### Create Assignment

```
POST /api/users/:userId/assignments

Authentication: Required (tenant-admin)
Middleware: isAuthenticated, withRBACContext, requireTenantAdmin

Request Body:
{
  contactId: "contact-789",
  notes: "Assigned due to sector expertise"
}

Response: UserContactAssignment (created record)
```

#### Delete Assignment

```
DELETE /api/users/:userId/assignments/:assignmentId

Authentication: Required (tenant-admin)
Middleware: isAuthenticated, withRBACContext, requireTenantAdmin

Response:
{
  success: true,
  message: "Assignment removed"
}
```

#### Bulk Assign Contacts

```
POST /api/users/:userId/assignments/bulk

Authentication: Required (tenant-admin)
Middleware: isAuthenticated, withRBACContext, requireTenantAdmin

Request Body:
{
  contactIds: ["contact-1", "contact-2", "contact-3"]
}

Response:
{
  success: true,
  assignedCount: 3,
  assignments: [...]
}
```

---

## Storage Layer Methods

### Partner Operations

```typescript
// Create new partner organization
async createPartner(partnerData: InsertPartner): Promise<Partner> {
  const [partner] = await db
    .insert(partners)
    .values(partnerData)
    .returning();
  
  return partner;
}

// Get all partners (platform admin only)
async getPartners(): Promise<Partner[]> {
  return await db
    .select()
    .from(partners)
    .where(eq(partners.isActive, true))
    .orderBy(desc(partners.createdAt));
}

// Get single partner by ID
async getPartner(partnerId: string): Promise<Partner | undefined> {
  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId));
  
  return partner;
}

// Update partner details
async updatePartner(
  partnerId: string, 
  updates: Partial<InsertPartner>
): Promise<Partner> {
  const [partner] = await db
    .update(partners)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(partners.id, partnerId))
    .returning();
  
  return partner;
}
```

### Tenant Access Methods

```typescript
// Get all tenants accessible by partner user
async getPartnerTenants(
  partnerUserId: string
): Promise<(Tenant & { relationship: PartnerClientRelationship })[]> {
  const results = await db
    .select({
      tenant: tenants,
      relationship: partnerClientRelationships,
    })
    .from(partnerClientRelationships)
    .innerJoin(tenants, eq(partnerClientRelationships.clientTenantId, tenants.id))
    .where(and(
      eq(partnerClientRelationships.partnerUserId, partnerUserId),
      eq(partnerClientRelationships.status, 'active')
    ))
    .orderBy(desc(partnerClientRelationships.lastAccessedAt));
  
  return results.map(r => ({ ...r.tenant, relationship: r.relationship }));
}

// Get all users within a tenant (admin access)
async getTenantUsers(tenantId: string): Promise<User[]> {
  return await db
    .select()
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(users.name);
}
```

### Contact Assignment Methods

```typescript
// Get all contact assignments for a user
async getUserContactAssignments(
  userId: string, 
  tenantId: string
): Promise<(UserContactAssignment & { contact: Contact })[]> {
  const results = await db
    .select()
    .from(userContactAssignments)
    .innerJoin(contacts, eq(userContactAssignments.contactId, contacts.id))
    .where(and(
      eq(userContactAssignments.userId, userId),
      eq(userContactAssignments.tenantId, tenantId),
      eq(userContactAssignments.isActive, true)
    ))
    .orderBy(desc(userContactAssignments.assignedAt));
  
  return results.map(r => ({ ...r.user_contact_assignments, contact: r.contacts }));
}

// Get all assignments for a specific contact
async getContactAssignments(
  contactId: string, 
  tenantId: string
): Promise<(UserContactAssignment & { user: User })[]> {
  const results = await db
    .select()
    .from(userContactAssignments)
    .innerJoin(users, eq(userContactAssignments.userId, users.id))
    .where(and(
      eq(userContactAssignments.contactId, contactId),
      eq(userContactAssignments.tenantId, tenantId),
      eq(userContactAssignments.isActive, true)
    ));
  
  return results.map(r => ({ ...r.user_contact_assignments, user: r.users }));
}

// Create single contact assignment
async createUserContactAssignment(
  assignmentData: InsertUserContactAssignment
): Promise<UserContactAssignment> {
  const [assignment] = await db
    .insert(userContactAssignments)
    .values(assignmentData)
    .returning();
  
  return assignment;
}

// Remove contact assignment
async deleteUserContactAssignment(
  assignmentId: string, 
  tenantId: string
): Promise<void> {
  await db
    .update(userContactAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(userContactAssignments.id, assignmentId),
      eq(userContactAssignments.tenantId, tenantId)
    ));
}

// Bulk assign multiple contacts to user
async bulkAssignContacts(
  userId: string, 
  contactIds: string[], 
  tenantId: string, 
  assignedBy: string
): Promise<UserContactAssignment[]> {
  const assignments = contactIds.map(contactId => ({
    userId,
    contactId,
    tenantId,
    assignedBy,
    isActive: true
  }));
  
  const result = await db
    .insert(userContactAssignments)
    .values(assignments)
    .onConflictDoUpdate({
      target: [userContactAssignments.userId, userContactAssignments.contactId],
      set: { isActive: true, updatedAt: new Date() }
    })
    .returning();
  
  return result;
}

// Check if user has access to specific contact
async hasContactAccess(
  userId: string, 
  contactId: string, 
  tenantId: string
): Promise<boolean> {
  const [assignment] = await db
    .select()
    .from(userContactAssignments)
    .where(and(
      eq(userContactAssignments.userId, userId),
      eq(userContactAssignments.contactId, contactId),
      eq(userContactAssignments.tenantId, tenantId),
      eq(userContactAssignments.isActive, true)
    ));
  
  return !!assignment;
}

// Get all contacts assigned to a user
async getAssignedContacts(
  userId: string, 
  tenantId: string
): Promise<Contact[]> {
  const results = await db
    .select({ contact: contacts })
    .from(userContactAssignments)
    .innerJoin(contacts, eq(userContactAssignments.contactId, contacts.id))
    .where(and(
      eq(userContactAssignments.userId, userId),
      eq(userContactAssignments.tenantId, tenantId),
      eq(userContactAssignments.isActive, true)
    ));
  
  return results.map(r => r.contact);
}
```

---

## Access Control Rules

### Partner Users

| Capability | Allowed |
|------------|---------|
| View all client tenants | ✅ Yes (via `getPartnerTenants`) |
| Switch between tenants | ✅ Yes (session-based) |
| Create/edit invoices | ✅ Yes (in active tenant) |
| Manage tenant users | ✅ Yes (tenant-admin required) |
| Assign contacts | ✅ Yes (tenant-admin required) |
| Access other partners' clients | ❌ No (isolated by relationship) |

### Tenant Admins

| Capability | Allowed |
|------------|---------|
| View all tenant data | ✅ Yes |
| Manage users | ✅ Yes |
| Assign contacts | ✅ Yes |
| Change tenant settings | ✅ Yes |
| Access other tenants | ❌ No |

### Collectors

| Capability | Allowed |
|------------|---------|
| View assigned contacts | ✅ Yes |
| View assigned invoices | ✅ Yes |
| Create actions on assigned contacts | ✅ Yes |
| View other contacts | ❌ No (unless assigned) |
| Assign contacts | ❌ No (admin-only) |

### Platform Admins

| Capability | Allowed |
|------------|---------|
| View all partners | ✅ Yes |
| View all tenants | ✅ Yes |
| View all users | ✅ Yes |
| Platform statistics | ✅ Yes |
| Manage subscriptions | ✅ Yes |
| Production database | ❌ No (manual only) |

---

## Data Isolation

### Multi-Tenant Enforcement

Every query **must** filter by `tenantId` to ensure strict data isolation:

```typescript
// ❌ WRONG - Missing tenant filter
const invoices = await db
  .select()
  .from(invoices)
  .where(eq(invoices.status, 'overdue'));

// ✅ CORRECT - Tenant-scoped query
const invoices = await db
  .select()
  .from(invoices)
  .where(and(
    eq(invoices.tenantId, tenantId),
    eq(invoices.status, 'overdue')
  ));
```

### Middleware Enforcement

```typescript
// All routes automatically scoped to active tenant
app.get('/api/invoices', 
  isAuthenticated,
  withRBACContext,  // Sets req.rbac.tenantId
  async (req, res) => {
    const { tenantId } = req.rbac;
    
    // Query automatically scoped to correct tenant
    const invoices = await storage.getInvoices(tenantId);
    res.json(invoices);
  }
);
```

### Partner Access Validation

Partner users can only access tenants they have active relationships with:

```typescript
// Verify access before allowing operations
const accessibleTenants = await storage.getPartnerTenants(userId);
const hasAccess = accessibleTenants.some(t => t.id === requestedTenantId);

if (!hasAccess) {
  return res.status(403).json({ 
    message: 'Partner does not have access to this tenant' 
  });
}
```

---

## User Workflows

### Partner User Login Flow

```
1. User authenticates (Replit Auth)
   ↓
2. System detects role='partner' and partnerId exists
   ↓
3. Check req.session.activeTenantId
   ↓
4a. If tenant ID exists:
    - Verify access via getPartnerTenants
    - Load permissions for that tenant
    - Continue to dashboard
   ↓
4b. If no tenant ID:
    - Show tenant selector dropdown
    - User selects client tenant
    - POST /api/partner/switch-tenant
    - Session updated
    - Redirect to dashboard
   ↓
5. All subsequent requests use session.activeTenantId
   ↓
6. User can switch tenants anytime via dropdown
```

### Contact Assignment Flow

```
1. Tenant admin navigates to Users page
   ↓
2. Selects credit controller user
   ↓
3. Clicks "Manage Assignments"
   ↓
4. Views currently assigned contacts
   ↓
5. Adds new contact assignments:
   - Select contact from dropdown
   - Add optional notes
   - Click "Assign"
   ↓
6. Backend:
   - Validates tenant-admin permission
   - Creates userContactAssignment record
   - Sets assignedBy = current user
   ↓
7. Credit controller now sees contact in their contact list
   ↓
8. All invoices/actions for that contact visible to credit controller
```

### Data Access Flow (Credit Controller)

```
1. Credit controller logs in
   ↓
2. Dashboard loads:
   GET /api/invoices?tenantId={tenantId}
   ↓
3. Backend middleware:
   - withRBACContext sets req.rbac
   - Detects tenantRole='credit_controller'
   ↓
4. Storage layer:
   - getAssignedContacts(userId, tenantId)
   - Returns assigned contact IDs
   ↓
5. Filter invoices:
   WHERE tenantId = X 
   AND contactId IN (assigned contacts)
   ↓
6. Return filtered results
   ↓
7. Collector sees only their assigned accounts
```

---

## Security Best Practices

### 1. Always Validate Tenant Access

```typescript
// Before ANY operation, verify tenant ownership
const invoice = await storage.getInvoice(invoiceId, req.rbac.tenantId);
if (!invoice) {
  return res.status(404).json({ message: 'Invoice not found' });
}

// For partners, also verify client tenant access
if (req.rbac.isPartner) {
  const accessibleTenants = await storage.getPartnerTenants(req.rbac.userId);
  const hasAccess = accessibleTenants.some(t => t.id === invoice.tenantId);
  
  if (!hasAccess) {
    return res.status(403).json({ message: 'Access denied' });
  }
}
```

### 2. Use Middleware Chains

```typescript
// Enforce access control at route level
app.get('/api/sensitive-data',
  isAuthenticated,        // Verify logged in
  withRBACContext,        // Load permissions
  requirePartnerAccess,   // Partner users only
  async (req, res) => {
    // Handler logic
  }
);
```

### 3. Audit Trail

```typescript
// Log all partner tenant switches
await db.insert(auditLogs).values({
  userId: req.rbac.userId,
  action: 'tenant_switch',
  fromTenantId: oldTenantId,
  toTenantId: newTenantId,
  timestamp: new Date()
});
```

### 4. Permission Checks

```typescript
// Always verify specific permissions
if (!req.rbac.permissions.includes('invoices.delete')) {
  return res.status(403).json({ 
    message: 'Insufficient permissions to delete invoices' 
  });
}
```

---

## Frontend Integration

### Tenant Switcher Component

```typescript
export function TenantSwitcher() {
  const { data: context } = useQuery({
    queryKey: ['/api/auth/context']
  });
  
  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await apiRequest('POST', '/api/partner/switch-tenant', { tenantId });
    },
    onSuccess: () => {
      // Invalidate all queries to reload with new tenant context
      queryClient.invalidateQueries();
      toast({ title: "Tenant switched successfully" });
    }
  });
  
  if (!context?.rbac?.isPartner) {
    return null;  // Only show for partner users
  }
  
  return (
    <Select
      value={context.rbac.activeTenantId}
      onValueChange={(tenantId) => switchTenantMutation.mutate(tenantId)}
    >
      {context.accessibleTenants.map(tenant => (
        <SelectItem key={tenant.id} value={tenant.id}>
          {tenant.name}
        </SelectItem>
      ))}
    </Select>
  );
}
```

### Contact Assignment Manager

```typescript
export function ContactAssignmentManager({ userId }: { userId: string }) {
  const { data: assignments } = useQuery({
    queryKey: ['/api/users', userId, 'assignments']
  });
  
  const assignMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest('POST', `/api/users/${userId}/assignments`, { contactId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId, 'assignments'] });
    }
  });
  
  return (
    <div>
      <h3>Assigned Contacts</h3>
      <ul>
        {assignments?.map(a => (
          <li key={a.id}>
            {a.contact.name} - {a.contact.companyName}
          </li>
        ))}
      </ul>
      
      <ContactSelector onSelect={assignMutation.mutate} />
    </div>
  );
}
```

---

## Testing

### Test Scenarios

**1. Partner User Access**:
- Create partner user with `role='partner'` and `partnerId='partner-123'`
- Create 3 client tenants with active relationships
- Login and verify tenant switcher appears
- Switch between tenants and verify data isolation

**2. Contact Assignment**:
- Create tenant admin user
- Create 5 contacts in tenant
- Create credit controller user
- Assign 2 contacts to credit controller
- Login as credit controller
- Verify only 2 contacts visible

**3. Data Isolation**:
- Create 2 separate tenants (no partner relationship)
- Create invoices in both
- Login as user in Tenant A
- Attempt to access Tenant B invoice by ID
- Verify 403 Forbidden response

**4. Permission Enforcement**:
- Create credit controller user (not admin)
- Attempt to create new user
- Verify 403 Forbidden response
- Attempt to assign contacts
- Verify 403 Forbidden response

---

## Summary

The Partner Hierarchy System enables:

- **Accounting firms** to manage multiple client businesses from a single platform
- **Strict data isolation** through tenant-scoped queries and middleware enforcement
- **Flexible access control** via RBAC with partner, tenant, and user-level permissions
- **Session-based tenant switching** for partner users accessing multiple clients
- **Granular contact assignments** allowing credit controllers to only see their assigned accounts
- **Audit trails** and access logging for compliance and security

The three-tier architecture (Platform → Partners → Tenants → Users) provides scalability, security, and flexibility for B2B2B SaaS operations while maintaining clear boundaries between accounting firms and their respective client bases.
