# Qashivo

## Overview
Qashivo is an AI-first autonomous cashflow management solution for UK SMEs, acting as an AI credit controller. It operates on a supervised autonomy model, using AI agents to manage collections under user oversight, aiming to drastically reduce daily user effort. Key features include rapid integration with Xero for instant AI analysis, a voice-driven natural language interface, and a guarantee to achieve a 90-day Days Sales Outstanding (DSO). The project aims for an MVP by December 15, 2025, with an initial target of 10 paying customers.

## User Preferences
Preferred communication style: Simple, everyday language.

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

### UI/UX Design System
Qashivo uses two design systems:
-   **Cardless v2.0 (Compact) - Desktop**: Focuses on data density, typography, and minimalism with a specific color palette (Green, Amber, Red, Teal), pure white backgrounds, and compact spacing. It includes responsive tables, sortable columns, and a full-height drawer.
-   **Cardless v3.0 - Mobile**: Inspired by Apple HIG, emphasizing progressive disclosure, one-handed operation, generous spacing, and card-based layouts with larger touch targets and mobile-optimized typography.

### Technical Implementation
-   **Frontend**: React with TypeScript (Vite), Shadcn/ui (Radix UI), Tailwind CSS, Wouter for routing, TanStack Query, React Hook Form with Zod.
-   **Backend**: Node.js with Express.js (TypeScript ES modules), RESTful API, Express sessions.
-   **Database**: PostgreSQL (Neon serverless) with Drizzle ORM and Drizzle Kit, supporting multi-tenancy. 90 tables (reduced from 120 in Phase 1 optimization, Feb 2026).
-   **Authentication**: Replit Auth (OpenID Connect) + password-based auth via Passport.js.

### Partner Architecture (B2B2B Model)
A three-tier hierarchy enabling accounting firms to manage multiple client businesses with role-based access control, session-based tenant switching, and enforced data isolation.

### Platform Admin System
A secure, internal interface for Qashivo employees to manage and monitor the platform, protected by a `platformAdmin` flag and dedicated middleware.

### Security Architecture
Includes robust authentication (OAuth 2.0 with Replit OIDC + password auth), granular Role-Based Access Control (RBAC), strict multi-tenant isolation, comprehensive input validation (Zod, Drizzle ORM), and webhook security (HMAC verification).
-   **Password Strength**: 10+ chars, mixed case, number, special character. Enforced on signup, password reset, invite acceptance.
-   **Session Security**: 24-hour absolute TTL, 30-minute idle timeout, session regeneration on login, rolling sessions, PostgreSQL-backed session store.
-   **Unified Audit Logging**: All audit, partner, and security events consolidated into single `activity_logs` table with `category` filtering (`audit`, `partner`, `security`, `communication`, `system`, etc.). Removed separate `audit_events` and `partner_audit_log` tables (Feb 2026). Extended with `ipAddress`, `userAgent`, typed FK columns (`debtorId`, `invoiceId`, `actionId`, `outcomeId`).
-   **Security Audit Service**: `server/services/securityAuditService.ts` logs security events (login, logout, signup, password reset, session expiry, role change, tenant switch, invite acceptance) with IP/user-agent capture. API endpoint: `GET /api/security-audit-log` (admin:settings permission).
-   **Rate Limiting**: Login (5/15min), signup (3/hr), password reset (3/hr).

### RBAC System (6-Tier)
Six roles with hierarchical permissions: **Owner** (subscription creator, full control), **Admin** (full system except subscription), **Accountant/Partner** (admin-level across multiple tenants), **Manager** (oversees credit controllers, sees cashflow/financing but not Settings), **Credit Controller** (collections work only, no Settings/cashflow/financing), **Read Only** (view only, no Settings).
-   **Permission-based route protection**: `withPermission()` middleware from `server/middleware/rbac.ts` applied to 29+ write/action routes. Permissions: `invoices:edit`, `customers:edit`, `collections:sms`, `collections:voice`, `admin:users`, `admin:settings`.
-   **Contact-level access enforcement**: Credit controllers and read-only users only see contacts/invoices assigned to them. Helpers `getAssignedContactIds()` and `hasContactAccess()` in `server/routes.ts` check assignment; managers+ have full access. Applied to 30+ `/api/contacts/:contactId/...` routes and list routes (GET /api/contacts, GET /api/invoices).
-   **Key files**: `server/middleware/rbac.ts`, `server/services/permissionService.ts`, `client/src/hooks/usePermissions.ts`, `client/src/components/rbac/PermissionMatrix.tsx`.

### Feature Specifications
-   **Intent Analyst System**: AI for analyzing inbound communications (email, SMS, voice) using OpenAI for intent detection, sentiment analysis, and automated action generation.
-   **AI Voice Dialog**: Initiates intelligent voice calls with personalized, dynamic scripts and compliance features via Retell.
-   **Universal API Middleware**: Standardizes interfaces for accounting software integrations (e.g., XeroProvider), handling OAuth and data transformation.
-   **Workflow Engine**: Provides customizable collection processes with pre-built templates and trackable communication.
-   **Auto-Documentation System**: AI-powered system using OpenAI to generate and update technical documentation from git diffs.
-   **Debtor Self-Service Portal**: A secure portal for debtors to manage invoices, disputes, promises to pay, and payments, featuring magic link + OTP authentication and Stripe integration.
-   **PTP Breach Detection Service**: A background job monitoring promises to pay, flagging breaches and creating follow-up actions.
-   **Invoice Status Model**: Uses `OPEN`, `PAID`, `VOID` from accounting software, computes `Days Overdue`, and tracks `Outcome Override` (e.g., `Silent`, `Disputed`, `Plan`).
-   **Payment Plans**: Supports multi-invoice payment plans with plan-level breach detection, running daily to create follow-up actions if outstanding amounts haven't decreased.
-   **Unified Inbound Communications Pipeline**: All inbound communications (email, SMS, voice) are processed through a single entry point (`intentAnalyst.processInboundMessage()`), writing to a unified `outcomes` table with canonical field names.
-   **Universal Voice Call Follow-Up Emails**: Every voice call triggers an AI-generated personalized follow-up email, respecting tenant-specific channel cooldowns and touch limits. It gathers debtor context, generates content via OpenAI, and stores the email for visibility.
-   **Active Conversation Auto-Reply & Escalation**: When a debtor replies to an email, the AI responds immediately, bypassing cadence restrictions. It detects escalation triggers (e.g., requests to speak to a person, hostile language) using OpenAI to decide whether to continue the conversation or create an action for a human agent.
-   **Full-Conversation-Context Clarification Resolution**: When debtors reply to clarification emails, the system now analyzes the entire email conversation thread (not just the latest reply) using OpenAI to extract multi-tranche payment arrangements, resolve invoice references, and accurately forecast cash inflow.
-   **Email Connection (OAuth)**: Users can connect their Gmail or Outlook account via OAuth to send collection emails from their own email address ("Chaser-style"). Outbound emails route through the connected account with SendGrid fallback. Inbound emails are polled every 5 minutes and auto-matched to debtors using a multi-strategy matching engine (thread headers → sender mapping → domain mapping → direct email → domain match). Unmatched emails appear in the Inbox with a one-click assignment UI. OAuth state is HMAC-signed for CSRF protection. Key files: `server/services/emailConnection.ts`, `server/services/email/ConnectedEmailService.ts`, `server/services/emailPollingService.ts`, `server/services/emailMatchingService.ts`, `server/routes/emailConnectionRoutes.ts`.

## External Dependencies

### Third-Party Services
-   **Xero**: Accounting software integration.
-   **SendGrid**: Email delivery.
-   **Vonage**: SMS and WhatsApp messaging.
-   **OpenAI**: AI services.
-   **Neon**: Serverless PostgreSQL hosting.
-   **Retell AI**: AI voice call integration.
-   **Stripe**: Payment processing.

### Development Tools
-   **Replit**: Integrated development environment.
-   **Vite**: Frontend build tool.
-   **Drizzle ORM**: TypeScript ORM.
-   **TypeScript**: Programming language.

### UI/UX Libraries
-   **Radix UI**: Accessible component primitives.
-   **Lucide**: Icon library.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Class Variance Authority**: Component variant management.