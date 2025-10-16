# Qashivo Security Documentation

## Overview

This document outlines the security architecture of the Qashivo/Nexus AR platform, covering authentication, authorization, data isolation, and protection mechanisms. It also provides prioritized recommendations for security enhancements.

**Last Updated:** October 16, 2025

---

## Table of Contents

1. [Authentication & Session Management](#authentication--session-management)
2. [Authorization & Access Control](#authorization--access-control)
3. [Multi-Tenant Security](#multi-tenant-security)
4. [Partner Architecture (B2B2B)](#partner-architecture-b2b2b)
5. [Platform Admin Security](#platform-admin-security)
6. [Data Protection](#data-protection)
7. [API Security](#api-security)
8. [External Integration Security](#external-integration-security)
9. [Security Improvements Roadmap](#security-improvements-roadmap)

---

## Authentication & Session Management

### Current Implementation

#### OAuth 2.0 with Replit
- **Provider:** Replit OpenID Connect (OIDC)
- **Strategy:** Passport.js with custom OIDC strategy
- **Token Management:** Automatic access token refresh using refresh tokens
- **User Provisioning:** Automatic tenant creation on first login

```typescript
// Authentication middleware chain
app.get('/api/resource', 
  isAuthenticated,           // Verify session + token validity
  withRBACContext,           // Load permissions
  requirePermission('resource:read'), 
  handler
);
```

#### Session Configuration
- **Storage:** PostgreSQL-backed sessions (`connect-pg-simple`)
- **TTL:** 7 days (604,800,000 ms)
- **Cookie Settings:**
  - `httpOnly: true` - Prevents XSS access to cookies
  - `secure: true` (production) - HTTPS-only transmission
  - `sameSite: 'lax'` - CSRF protection
  - `maxAge: 7 days` - Auto-expiry

**Location:** `server/replitAuth.ts`

```typescript
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}
```

#### Development Bypass
- **Feature:** `AUTH_DEV_BYPASS=true` enables demo authentication
- **Purpose:** Streamlined testing without OAuth flow
- **Security:** Disabled in production environments

---

## Authorization & Access Control

### Role-Based Access Control (RBAC)

#### Permission System
The platform implements a comprehensive RBAC system with **50+ granular permissions** across 6 categories:

**Location:** `server/services/permissionService.ts`

| Category | Example Permissions |
|----------|---------------------|
| **Invoices** | `invoices:read`, `invoices:create`, `invoices:edit`, `invoices:delete`, `invoices:send_reminders`, `invoices:manage_collections` |
| **Customers** | `customers:read`, `customers:create`, `customers:edit`, `customers:delete`, `customers:manage_contacts` |
| **Finance** | `finance:read`, `finance:cashflow`, `finance:budget`, `finance:bank_accounts`, `finance:bills` |
| **AI/Automation** | `ai:chat`, `ai:configuration`, `ai:analytics`, `ai:voice_calls`, `ai:templates` |
| **Reports** | `reports:read`, `reports:export`, `reports:advanced`, `reports:custom` |
| **Admin** | `admin:users`, `admin:settings`, `admin:integrations`, `admin:api_keys`, `admin:audit_logs`, `admin:data_export` |

#### Role Hierarchy
Predefined roles with cascading permissions:

1. **Owner** - All permissions (system + tenant)
2. **Admin** - Operational permissions (no system-level access)
3. **Accountant** - Financial + invoice management
4. **Manager** - Team oversight + limited admin
5. **User** - Basic operational access
6. **Viewer** - Read-only access

**Location:** `server/services/permissionService.ts`

```typescript
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [...Object.keys(PERMISSIONS) as Permission[]],
  admin: ['invoices:read', 'invoices:create', ...],
  accountant: ['invoices:read', 'finance:read', ...],
  // ... etc
};
```

#### RBAC Middleware Chain

**Location:** `server/middleware/rbac.ts`

```typescript
// 1. Load RBAC context (runs after authentication)
export const withRBACContext: RequestHandler = async (req, res, next) => {
  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  
  // Determine active tenant (supports partner switching)
  const activeTenantId = isPartner 
    ? (req.session.activeTenantId || queryTenantId)
    : user.tenantId;
  
  // Load user permissions for active tenant
  const permissions = await PermissionService.getUserPermissions(userId, activeTenantId);
  
  // Attach to request
  req.rbac = {
    userId, tenantId: activeTenantId, userRole: user.role,
    tenantRole: user.tenantRole, permissions, isPartner, partnerId
  };
  
  next();
};

// 2. Permission checks
export function requirePermission(permission: Permission): RequestHandler {
  return async (req, res, next) => {
    const hasPermission = await PermissionService.hasPermission(
      req.rbac.userId, req.rbac.tenantId, permission
    );
    
    if (!hasPermission) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission 
      });
    }
    next();
  };
}
```

**Available Middleware:**
- `requirePermission(permission)` - Single permission check
- `requireAnyPermission([...])` - At least one permission
- `requireAllPermissions([...])` - All permissions required
- `requireRole(role)` - Exact role match
- `requireMinimumRole(role)` - Role hierarchy check
- `canManageUser(targetUserIdParam)` - User management validation

---

## Multi-Tenant Security

### Tenant Isolation Strategy

**Core Principle:** Every user belongs to exactly one primary tenant. All data queries are automatically scoped to `tenantId`.

#### Database-Level Isolation
All core tables include `tenantId` foreign key:

```sql
-- Example: Invoices table
CREATE TABLE invoices (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
  contact_id VARCHAR REFERENCES contacts(id),
  -- ... other fields
);
```

#### Middleware Enforcement
Tenant isolation is enforced at multiple layers:

**Location:** `server/middleware/rbac.ts`

```typescript
// Example: Tenant Admin check with isolation verification
app.get('/api/tenants/:tenantId/users', 
  isAuthenticated, 
  withRBACContext, 
  requireTenantAdmin, 
  async (req, res) => {
    // Security: Verify tenant isolation
    if (req.params.tenantId !== req.rbac.tenantId) {
      return res.status(403).json({ 
        message: 'Access denied: Cannot access users from another tenant' 
      });
    }
    
    const users = await storage.getTenantUsers(req.params.tenantId);
    res.json({ users });
  }
);
```

#### Storage Layer Isolation
All storage methods enforce tenant scoping:

**Location:** `server/storage.ts`

```typescript
async getInvoices(tenantId: string, filters?: InvoiceFilters) {
  // Base condition: Always filter by tenantId
  const conditions = [eq(invoices.tenantId, tenantId)];
  
  // Additional filters...
  if (filters?.contactId) {
    conditions.push(eq(invoices.contactId, filters.contactId));
  }
  
  return await db.select()
    .from(invoices)
    .where(and(...conditions));
}
```

---

## Partner Architecture (B2B2B)

### Three-Tier Hierarchy

```
┌─────────────────────────────────────┐
│  PARTNERS (Accounting Firms)        │
│  - Manage multiple client tenants   │
│  - Session-based tenant switching   │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  TENANTS (Client Businesses)        │
│  - Owned by individual businesses   │
│  - Can be managed by partners       │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  USERS (Team Members)               │
│  - Assigned to specific tenants     │
│  - Contact-level assignments        │
└─────────────────────────────────────┘
```

### Partner Access Control

#### Database Schema
**Location:** `shared/schema.ts`

```typescript
// Users table includes partner association
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  role: varchar("role").default("user"), // owner, partner, user
  partnerId: varchar("partner_id").references(() => partners.id),
  tenantRole: varchar("tenant_role"), // admin, collector, viewer
  // ...
});

// Partner-client relationship tracking
export const partnerClientRelationships = pgTable("partner_client_relationships", {
  id: varchar("id").primaryKey(),
  partnerUserId: varchar("partner_user_id").references(() => users.id),
  partnerTenantId: varchar("partner_tenant_id").references(() => tenants.id),
  clientTenantId: varchar("client_tenant_id").references(() => tenants.id),
  accessLevel: varchar("access_level").default("full"), // full, read_only
  status: varchar("status").default("active"), // active, suspended, revoked
});
```

#### Tenant Switching Mechanism
Partners can switch between client tenants securely:

**Location:** `server/routes.ts`

```typescript
app.post('/api/partner/switch-tenant', isAuthenticated, async (req, res) => {
  const user = await storage.getUser(req.user.claims.sub);
  
  // Verify partner status
  if (user.role !== 'partner' || !user.partnerId) {
    return res.status(403).json({ message: 'Partner access required' });
  }
  
  const { tenantId } = req.body;
  
  // Verify partner has access to requested tenant
  const accessibleTenants = await storage.getPartnerTenants(user.id);
  const hasAccess = accessibleTenants.some(t => t.id === tenantId);
  
  if (!hasAccess) {
    return res.status(403).json({ message: 'Access denied to this tenant' });
  }
  
  // Update session with new active tenant
  req.session.activeTenantId = tenantId;
  req.session.save();
  
  res.json({ success: true, activeTenantId: tenantId });
});
```

#### Contact Assignment Security
Users can only access assigned contacts:

**Location:** `server/middleware/rbac.ts`

```typescript
// Contact access filter for collectors
export function getContactFilter(): RequestHandler {
  return async (req, res, next) => {
    if (!req.rbac) {
      return res.status(500).json({ message: 'RBAC context not initialized' });
    }
    
    const { userId, tenantId, tenantRole } = req.rbac;
    
    // Admins see all contacts
    if (tenantRole === 'admin') {
      req.contactFilter = { tenantId };
      return next();
    }
    
    // Collectors only see assigned contacts
    const assignments = await storage.getUserContactAssignments(userId, tenantId);
    const contactIds = assignments.map(a => a.contactId);
    
    req.contactFilter = { tenantId, contactIds };
    next();
  };
}
```

---

## Platform Admin Security

### Qashivo Internal Administration

Platform admins have system-wide access for internal operations (not tenant-specific).

#### Access Control
**Location:** `server/middleware/rbac.ts`

```typescript
export const requirePlatformAdmin: RequestHandler = async (req, res, next) => {
  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  
  if (!user?.platformAdmin) {
    return res.status(403).json({ 
      message: 'Platform admin access required',
      required: 'platform_admin',
      userRole: user?.role 
    });
  }
  
  next();
};
```

#### Protected Routes
```typescript
// Platform-wide statistics (owner + platform admin only)
app.get('/api/platform-admin/stats', 
  isAuthenticated, 
  requirePlatformAdmin, 
  async (req, res) => {
    const stats = await storage.getPlatformStats();
    res.json(stats);
  }
);
```

#### Frontend Protection
**Location:** `client/src/pages/qashivo-admin.tsx`

```typescript
export default function QashivoAdmin() {
  const { data: user } = useQuery({ queryKey: ['/api/auth/user'] });
  
  // Redirect non-platform-admins
  useEffect(() => {
    if (user && !user.platformAdmin) {
      window.location.href = '/';
    }
  }, [user]);
  
  if (!user?.platformAdmin) {
    return null; // Prevent render
  }
  
  // Platform admin UI...
}
```

---

## Data Protection

### Input Validation

#### Zod Schema Validation
All incoming data is validated using Zod schemas before database operations.

**Location:** `server/routes.ts`

```typescript
// Query parameter validation
const invoicesQuerySchema = z.object({
  status: z.enum(['pending', 'overdue', 'paid', 'cancelled', 'all']).optional(),
  search: z.string().optional(),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number)
});

app.get('/api/invoices', isAuthenticated, async (req, res) => {
  // Validate query params
  const validationResult = invoicesQuerySchema.safeParse(req.query);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      message: 'Invalid query parameters',
      errors: validationResult.error.errors 
    });
  }
  
  const filters = validationResult.data;
  // ... proceed with validated data
});
```

#### Request Body Validation
```typescript
// Partner creation with Zod validation
app.post('/api/partners', isAuthenticated, isOwner, async (req, res) => {
  try {
    const validatedData = insertPartnerSchema.parse(req.body);
    const partner = await storage.createPartner(validatedData);
    res.status(201).json({ partner });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to create partner' });
  }
});
```

### SQL Injection Prevention

#### Drizzle ORM Parameterization
All database queries use Drizzle ORM, which automatically generates parameterized queries.

**Location:** `server/storage.ts`

```typescript
// Safe query building with Drizzle
async getInvoicesFiltered(tenantId: string, filters: InvoiceFilters) {
  const conditions = [eq(invoices.tenantId, tenantId)];
  
  // Search term - safely parameterized
  if (filters.search) {
    conditions.push(
      or(
        ilike(invoices.invoiceNumber, `%${filters.search}%`),
        ilike(invoices.contactName, `%${filters.search}%`)
      )!
    );
  }
  
  // Status filtering - safely parameterized
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(invoices.status, filters.status));
  }
  
  // Execute with parameterized query
  return await db.select()
    .from(invoices)
    .where(and(...conditions));
}
```

**Why This Works:**
- Drizzle converts `eq(field, value)` to `WHERE field = $1` with `value` as parameter
- User input never concatenated into SQL strings
- Database driver handles escaping and type safety

---

## API Security

### Environment Variable Management

#### Current Approach
Sensitive credentials stored in environment variables:

```typescript
// server/index.ts
const xeroProvider = new XeroProvider({
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  apiKey: process.env.SENDGRID_API_KEY,
  // ...
});
```

**Strengths:**
- Credentials not committed to code
- Platform-managed (Replit Secrets)
- Environment isolation (dev/prod)

**⚠️ Limitation:**
- No encryption at rest within application layer
- Relies on platform security

### API Rate Limiting

**Status:** ⚠️ NOT IMPLEMENTED

**Risk:** API abuse, DDoS attacks, resource exhaustion

**Recommended Solution:**
```typescript
import rateLimit from 'express-rate-limit';

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api/', apiLimiter);

// Stricter limits for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/auth/login', authLimiter);
```

---

## External Integration Security

### Webhook Signature Verification

#### Implementation
Webhooks from external services (Xero, Sage, QuickBooks) are verified using HMAC signatures.

**Location:** `server/routes/syncRoutes.ts`

```typescript
// Raw body middleware for signature verification
const rawBodyMiddleware = (req: any, res: any, buf: Buffer) => {
  req.rawBody = buf.toString('utf8');
};

// Xero webhook with signature verification
app.post('/api/sync/webhook/xero', 
  express.raw({ type: 'application/json', verify: rawBodyMiddleware }),
  async (req, res) => {
    const signature = req.headers['x-xero-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing webhook signature' });
    }
    
    // Verify signature against raw body
    const result = await webhookHandler.processWebhook(
      'xero', 
      req.body, 
      signature, 
      req
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true });
  }
);
```

**How It Works:**
1. Capture raw request body (needed for signature calculation)
2. Extract signature from headers (`x-xero-signature`, `intuit-signature`, etc.)
3. Recalculate HMAC using webhook secret
4. Compare signatures - reject if mismatch

### OAuth Token Storage

**Location:** `server/storage.ts`

```typescript
// API connections table stores OAuth tokens
export const apiConnections = pgTable("api_connections", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  provider: varchar("provider"), // 'xero', 'sage', 'quickbooks'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  providerTenantId: varchar("provider_tenant_id"),
  // ...
});
```

**⚠️ Security Gap:**
- Tokens stored in plaintext in database
- Should use encryption at rest (see improvements)

---

## Security Improvements Roadmap

### Priority 1: Critical (Implement Immediately)

#### 1.1 API Key Encryption at Rest
**Problem:** OAuth tokens and API keys stored in plaintext

**Solution:**
```typescript
import { KMS } from '@aws-sdk/client-kms'; // or similar

class EncryptionService {
  async encrypt(plaintext: string): Promise<string> {
    // Use AWS KMS, Azure Key Vault, or similar
    const encrypted = await kms.encrypt({
      KeyId: process.env.KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext)
    });
    return encrypted.CiphertextBlob.toString('base64');
  }
  
  async decrypt(ciphertext: string): Promise<string> {
    const decrypted = await kms.decrypt({
      CiphertextBlob: Buffer.from(ciphertext, 'base64')
    });
    return decrypted.Plaintext.toString();
  }
}

// Update storage layer
async createAPIConnection(connection: InsertAPIConnection) {
  const encrypted = await encryptionService.encrypt(connection.accessToken);
  
  return await db.insert(apiConnections).values({
    ...connection,
    accessToken: encrypted,
    refreshToken: await encryptionService.encrypt(connection.refreshToken!)
  });
}
```

**Estimated Effort:** 2-3 days  
**Impact:** High - Protects sensitive credentials

#### 1.2 Audit Logging
**Problem:** No audit trail for sensitive operations

**Solution:**
```typescript
// Add audit_logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  action: varchar("action"), // 'user.created', 'permission.granted', etc.
  resourceType: varchar("resource_type"),
  resourceId: varchar("resource_id"),
  changes: json("changes"), // Before/after state
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Audit middleware
export function auditAction(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log successful actions
      if (res.statusCode < 400) {
        storage.createAuditLog({
          userId: req.rbac?.userId,
          tenantId: req.rbac?.tenantId,
          action,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          changes: data
        });
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Apply to sensitive routes
app.delete('/api/users/:userId', 
  isAuthenticated, 
  requirePermission('admin:users'),
  auditAction('user.deleted'),
  handler
);
```

**Estimated Effort:** 3-4 days  
**Impact:** High - Compliance, forensics, accountability

#### 1.3 Rate Limiting & DDoS Protection
**Problem:** No protection against API abuse

**Solution:**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// Redis-backed rate limiter (scales across instances)
const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:'
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

app.use('/api/', limiter);

// Endpoint-specific limits
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5 // 5 requests per minute
});

app.post('/api/auth/login', strictLimiter, handler);
app.post('/api/voice-calls', strictLimiter, handler); // Expensive operations
```

**Estimated Effort:** 1-2 days  
**Impact:** High - Prevents abuse, ensures availability

---

### Priority 2: Important (Implement Soon)

#### 2.1 Two-Factor Authentication (2FA)
**Problem:** Single-factor authentication only

**Solution:**
```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Add 2FA fields to users table
export const users = pgTable("users", {
  // ... existing fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"),
});

// Enable 2FA
app.post('/api/auth/2fa/enable', isAuthenticated, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: 'Qashivo' });
  
  await storage.updateUser(req.user.id, {
    twoFactorSecret: secret.base32
  });
  
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);
  
  res.json({ qrCode, secret: secret.base32 });
});

// Verify 2FA token
app.post('/api/auth/2fa/verify', isAuthenticated, async (req, res) => {
  const { token } = req.body;
  const user = await storage.getUser(req.user.id);
  
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token
  });
  
  if (!verified) {
    return res.status(401).json({ error: 'Invalid 2FA token' });
  }
  
  await storage.updateUser(user.id, { twoFactorEnabled: true });
  res.json({ success: true });
});
```

**Estimated Effort:** 3-4 days  
**Impact:** Medium-High - Enhanced account security

#### 2.2 Session Token Rotation
**Problem:** Session tokens not rotated on privilege changes

**Solution:**
```typescript
// Regenerate session on role/permission changes
async function rotateSession(req: Request) {
  return new Promise((resolve, reject) => {
    const oldSession = req.session;
    
    req.session.regenerate((err) => {
      if (err) return reject(err);
      
      // Copy essential data to new session
      Object.assign(req.session, {
        userId: oldSession.userId,
        activeTenantId: oldSession.activeTenantId
      });
      
      req.session.save((err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  });
}

// Apply after permission/role changes
app.patch('/api/users/:userId/role', isAuthenticated, async (req, res) => {
  await storage.updateUserRole(req.params.userId, req.body.role);
  
  // Rotate session if modifying own account
  if (req.params.userId === req.user.id) {
    await rotateSession(req);
  }
  
  res.json({ success: true });
});
```

**Estimated Effort:** 1-2 days  
**Impact:** Medium - Prevents session fixation attacks

#### 2.3 Content Security Policy (CSP)
**Problem:** No CSP headers, vulnerable to XSS

**Solution:**
```typescript
import helmet from 'helmet';

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.retellai.com", "wss:"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
}));

// Additional security headers
app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
}));

app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
```

**Estimated Effort:** 1 day  
**Impact:** Medium - Prevents XSS, clickjacking

---

### Priority 3: Nice to Have (Future Enhancements)

#### 3.1 IP Whitelisting for Platform Admin
```typescript
const ALLOWED_ADMIN_IPS = process.env.ADMIN_IP_WHITELIST?.split(',') || [];

export const requirePlatformAdmin: RequestHandler = async (req, res, next) => {
  // ... existing checks
  
  if (!ALLOWED_ADMIN_IPS.includes(req.ip)) {
    return res.status(403).json({ 
      message: 'Platform admin access denied from this IP' 
    });
  }
  
  next();
};
```

#### 3.2 Anomaly Detection
```typescript
// Track unusual patterns
async function detectAnomalies(userId: string, action: string) {
  const recentActions = await storage.getRecentAuditLogs(userId, '1 hour');
  
  // Detect: Too many permission checks (potential breach)
  const permissionChecks = recentActions.filter(a => 
    a.action.includes('permission.denied')
  );
  
  if (permissionChecks.length > 50) {
    await storage.createSecurityAlert({
      userId,
      type: 'anomaly.excessive_permission_checks',
      severity: 'high',
      details: { count: permissionChecks.length }
    });
  }
}
```

#### 3.3 Secrets Rotation Policy
```typescript
// Automated rotation for API keys
cron.schedule('0 0 * * 0', async () => { // Weekly
  const connections = await storage.getAPIConnectionsNeedingRotation();
  
  for (const conn of connections) {
    try {
      const newTokens = await provider.refreshTokens(conn);
      await storage.updateAPIConnection(conn.id, newTokens);
    } catch (error) {
      await storage.createSecurityAlert({
        type: 'token_rotation_failed',
        resourceId: conn.id
      });
    }
  }
});
```

---

## Security Checklist

### Pre-Production Checklist
- [ ] Enable `secure: true` for cookies (HTTPS only)
- [ ] Set strong `SESSION_SECRET` (32+ characters, random)
- [ ] Configure CSP headers via Helmet
- [ ] Enable rate limiting on all API routes
- [ ] Implement audit logging for admin actions
- [ ] Encrypt API tokens at rest (KMS/Key Vault)
- [ ] Set up 2FA for platform admins
- [ ] Configure IP whitelisting for admin panel
- [ ] Enable HSTS headers
- [ ] Implement session rotation on privilege escalation

### Ongoing Security Practices
- [ ] Regular dependency updates (`npm audit`)
- [ ] Quarterly security reviews
- [ ] Penetration testing before major releases
- [ ] Incident response plan documentation
- [ ] Regular backup verification
- [ ] Access review (quarterly user/permission audit)

---

## Incident Response

### Security Incident Protocol

1. **Detection**
   - Monitor audit logs for suspicious patterns
   - Set up alerts for repeated permission denials
   - Track failed login attempts

2. **Containment**
   ```typescript
   // Emergency user lockout
   await storage.updateUser(suspiciousUserId, { 
     isActive: false,
     lockoutReason: 'Security incident'
   });
   
   // Revoke all sessions
   await storage.deleteUserSessions(suspiciousUserId);
   ```

3. **Investigation**
   - Review audit logs: `SELECT * FROM audit_logs WHERE user_id = $1`
   - Check API connections: Identify compromised integrations
   - Analyze access patterns

4. **Recovery**
   - Reset affected credentials
   - Rotate API keys for compromised integrations
   - Notify affected tenants

5. **Post-Incident**
   - Document findings
   - Update security controls
   - Team debrief

---

## Contact & Support

**Security Issues:** Report to `security@qashivo.com`  
**Documentation Owner:** Engineering Team  
**Last Security Audit:** Pending  
**Next Scheduled Review:** Q1 2026

---

**Note:** This document should be updated whenever security-related changes are made to the platform.
