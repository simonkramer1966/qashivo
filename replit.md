# Nexus AR

## Overview
Nexus AR is an AI-driven accounts receivable and debt recovery application designed to automate and optimize collection processes. Its primary goal is to improve cash flow and reduce days sales outstanding for businesses through intelligent automation, multi-channel communication, and data-driven insights for invoice management. The project aims to become a leading solution for enterprise B2B companies with complex AR processes.

## User Preferences
Preferred communication style: Simple, everyday language.

### Data Visualization Principles
All data visualizations must adhere to the principles espoused by **Edward Tufte** and **Stephen Few**:

**Edward Tufte Principles:**
- Maximize data-ink ratio: remove chartjunk, minimize non-data pixels
- Show the data: let patterns emerge naturally without distortion
- Avoid decorative elements that don't convey information
- Use small multiples for comparative analysis
- Integrate text, numbers, and graphics seamlessly

**Stephen Few Principles:**
- Facilitate accurate perception and interpretation
- Minimize cognitive load: simplify, declutter, reduce visual noise
- Use color purposefully (not decoratively)
- Maintain consistent scales for comparison
- Prioritize clarity over aesthetics when in conflict

**Applied to Qashivo:**
- Clean, minimal chart axes with sparse tick marks
- Remove unnecessary gridlines (especially vertical)
- Synchronized scales across comparative charts
- Use white space effectively
- Color only to convey meaning (behavioral segments, status indicators)
- Small multiples preferred over overlapping multi-line charts

## System Architecture

### UI/UX Design
The application features a Premium Glassmorphism UI with a `bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50` page background. Cards use `bg-white/80 backdrop-blur-sm border-white/50 shadow-lg`, and metrics utilize `bg-white/70 backdrop-blur-md border-0 shadow-xl`. The primary brand color is #17B6C3 (Nexus teal). Typography includes `text-2xl font-bold` for page titles and `text-xl font-bold` for card titles. Icons are wrapped in `p-2 bg-[#17B6C3]/10 rounded-lg`. Form elements use `bg-white/70 border-gray-200/30` for inputs and `bg-[#17B6C3] hover:bg-[#1396A1] text-white` for primary buttons.

### Technical Implementation
- **Frontend**: React with TypeScript (Vite), Shadcn/ui (Radix UI), Tailwind CSS, Wouter for routing, TanStack Query for state management, React Hook Form with Zod validation.
- **Backend**: Node.js with Express.js (TypeScript ES modules), RESTful API with authentication middleware, Express sessions.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM and Drizzle Kit for schema management. Designed for multi-tenancy.
- **Authentication**: Replit Auth (OpenID Connect) via Passport.js, with PostgreSQL-backed session storage.
- **Data Models**: Core entities include Users, Tenants, Contacts, Invoices, Actions, and Workflows, all with multi-tenant architecture and Zod validation.

### Partner Architecture (B2B2B Model)
A three-tier hierarchy designed for accounting firms (partners) to manage multiple client businesses (tenants) with role-based access control:

**Architecture Layers:**
1. **Partners** (Accounting Firms): Top-level organizations that manage multiple client businesses
2. **Tenants** (Client Businesses): Individual businesses served by partners
3. **Users** (Team Members): People within tenants with specific roles and contact assignments

**Database Schema:**
- `partners`: Partner organization data (id, name, email, phone, addressLine1, addressLine2, city, state, postalCode, country, subscriptionPlanId, customPricing, isActive)
- `users`: Extended with `partnerId` (links to partner organization) and `tenantRole` (role within tenant: admin, collector, viewer)
- `userContactAssignments`: Maps users to contacts they manage (userId, contactId, tenantId, assignedBy, isActive)
- `partnerClientRelationships`: Tracks partner user access to client tenants (partnerUserId, partnerTenantId, clientTenantId, accessLevel, status)

**Authentication & RBAC:**
- Extended `Express.Request.rbac` with: `isPartner`, `partnerId`, `activeTenantId`, `tenantRole`, `userRole`, `permissions`
- Session-based tenant switching for partner users (stored in `req.session.activeTenantId`)
- `withRBACContext` middleware detects partner users, validates tenant access, and loads appropriate context
- Access control middleware: `requirePartnerAccess`, `requireTenantAdmin`, `enforceContactAccess`, `getContactFilter`
- Validation: Partner tenant access verified via `storage.getPartnerTenants()`, session updated on tenant switch

**API Endpoints:**
- Context Management: `GET /api/auth/context`, `GET /api/partner/tenants`, `POST /api/partner/switch-tenant`
- Partner CRUD: `GET /POST /PATCH /api/partners` (owner-only, Zod validated)
- Tenant Users: `GET /api/tenants/:tenantId/users` (tenant-admin, isolation enforced)
- Contact Assignments: `GET /POST /DELETE /api/users/:userId/assignments`, bulk operations with validation

**Access Control Rules:**
- Partners: Full visibility across all assigned tenants
- Tenant Admins: Full access within their tenant
- Collectors: Access only to assigned contacts
- Data isolation enforced at middleware level with tenant ID validation

**Storage Layer Methods:**
- Partner ops: `getPartners`, `getPartner`, `createPartner`, `updatePartner`
- Tenant access: `getPartnerTenants`, `getTenantUsers`
- Assignment ops: `getUserContactAssignments`, `getContactAssignments`, `createUserContactAssignment`, `deleteUserContactAssignment`
- Bulk ops: `bulkAssignContacts`, `bulkUnassignContacts`
- Access checks: `hasContactAccess`, `getAssignedContacts`

### Platform Admin System (Qashivo Internal)
A secure administration interface for Qashivo employees to manage and monitor the entire platform across all partners and tenants.

**Access Control:**
- `platformAdmin` boolean field in `users` table (default: false)
- `requirePlatformAdmin` middleware enforces access at API level
- Frontend route guard redirects non-platform-admins from `/qashivo-admin`
- Navigation link only visible to users with `platformAdmin=true`

**Platform Admin Dashboard (`/qashivo-admin`):**
- **Overview Tab**: Platform statistics (total users, tenants, partners, relationships), user distribution by role, partner status
- **Users Tab**: Complete list of all users across all tenants with tenant/partner associations
- **Tenants Tab**: All tenant organizations in the system
- **Partners Tab**: All accounting firm partners with activity status

**API Endpoints (Protected by `withPlatformAdmin()`):**
- `GET /api/platform-admin/stats`: Platform-wide statistics
- `GET /api/platform-admin/users`: All users with filtering options
- `GET /api/platform-admin/tenants`: All tenant organizations
- `GET /api/platform-admin/partners`: All partner organizations
- `GET /api/platform-admin/relationships`: All partner-client relationships

**Storage Methods:**
- `getPlatformStats()`: Returns aggregated platform metrics
- `getAllPlatformUsers(filters?)`: Fetches all users with optional role filtering
- `getAllPlatformTenants()`: Returns all tenant organizations
- `getAllPlatformPartners()`: Returns all partner organizations
- `getAllPlatformRelationships()`: Returns all partner-client relationships with joined data

**Security Implementation:**
- Backend: All routes protected by `withPlatformAdmin()` middleware (isAuthenticated + requirePlatformAdmin)
- Frontend: `useEffect` redirect + early return for non-platform-admins
- Multi-layer defense: API returns 403 if platformAdmin check fails, UI prevents unauthorized access

### Feature Specifications

#### Intent Analyst System
An AI-powered system for inbound communication analysis with a three-layer architecture:
1.  **Webhook Layer**: Captures inbound communications from SendGrid (email), Vonage (SMS/WhatsApp), and Retell (voice).
2.  **AI Analysis Engine**: Uses OpenAI for intent detection with confidence scoring.
3.  **Action Generation**: Automatically creates actions for high-confidence intents (≥60%).
    -   **Detected Intents**: `payment_plan`, `dispute`, `promise_to_pay`, `general_query`, `unknown`.
    -   **Key Features**: Extracts entities (amounts, dates, promises), sentiment analysis, flags low-confidence items for manual review, stores full transcript and analysis in action metadata.

#### AI Voice Dialog
Intelligent voice call initiation with personalized scripts that adapt to overdue severity. It includes four script templates (Soft Approach, Professional Follow-up, Firm Collection, Final Notice) that are auto-selected based on days overdue. Scripts use dynamic variables for personalization, include compliance features (identity verification, call recording disclosure), and capture intent via Retell webhook integration.

#### Universal API Middleware
Provides a standardized interface for accounting software integrations, handling OAuth token management, data transformation, and secure token injection. A production-ready XeroProvider is implemented.

#### Workflow Engine
A customizable workflow system for collection processes, offering pre-built templates and trackable communication actions.

#### Auto-Documentation System
An AI-powered system that keeps technical documentation synchronized with code changes. It monitors git diffs, identifies affected documentation sections, uses OpenAI to generate updates, and provides a web UI for review and approval. Documentation is stored in a structured JSON format, with a CLI tool for manual sync and version history for rollbacks.

## External Dependencies

### Third-Party Services
-   **Xero**: Accounting software integration.
-   **SendGrid**: Email delivery service.
-   **Vonage**: SMS and WhatsApp messaging services.
-   **OpenAI**: AI services for natural language processing and intent detection.
-   **Neon**: Serverless PostgreSQL hosting.
-   **Retell AI**: AI voice call integration.

### Development Tools
-   **Replit**: Integrated development environment.
-   **Vite**: Frontend build tool.
-   **Drizzle ORM**: TypeScript ORM for PostgreSQL.
-   **TypeScript**: Programming language.

### UI/UX Libraries
-   **Radix UI**: Accessible component primitives.
-   **Lucide**: Icon library.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Class Variance Authority**: Component variant management.