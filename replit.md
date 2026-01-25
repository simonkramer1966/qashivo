# Qashivo

## Overview
Qashivo is an AI-first autonomous cashflow management solution for UK SMEs, acting as an AI credit controller. It focuses on a supervised autonomy model where AI agents perform collections work under user supervision, aiming to reduce user effort from hours to minutes daily. Key capabilities include rapid Xero integration with instant AI analysis, a voice-driven natural language interface, and a commitment to a 90-day DSO (Days Sales Outstanding) guarantee. The project targets an MVP by December 15, 2025, with an initial goal of 10 paying customers.

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
Qashivo employs two distinct design systems:
-   **Cardless v2.0 (Compact) - Desktop Application Standard**: Prioritizes data density, typography, and minimalism with pure white backgrounds, a specific color palette (Green, Amber, Red, Teal), and compact spacing. It features responsive tables, sortable columns, and a full-height drawer layout.
-   **Cardless v3.0 - Mobile Application**: Inspired by Apple HIG, focusing on progressive disclosure, one-handed operation, generous spacing, and card-based layouts. It uses larger touch targets and specific typography scales for mobile.

### Technical Implementation
-   **Frontend**: React with TypeScript (Vite), Shadcn/ui (Radix UI), Tailwind CSS, Wouter for routing, TanStack Query, React Hook Form with Zod validation.
-   **Backend**: Node.js with Express.js (TypeScript ES modules), RESTful API, Express sessions.
-   **Database**: PostgreSQL (Neon serverless) with Drizzle ORM and Drizzle Kit, designed for multi-tenancy.
-   **Authentication**: Replit Auth (OpenID Connect) via Passport.js.

### Partner Architecture (B2B2B Model)
A three-tier hierarchy supporting accounting firms (partners) managing multiple client businesses (tenants) with role-based access control, session-based tenant switching, and enforced data isolation.

### Platform Admin System
A secure, internal administration interface for Qashivo employees to manage and monitor the platform, protected by a `platformAdmin` flag and dedicated middleware.

### Security Architecture
Features robust authentication (OAuth 2.0 with Replit OIDC), granular RBAC (50+ permissions), strict multi-tenant isolation, comprehensive input validation (Zod, Drizzle ORM), and webhook security (HMAC verification).

### Feature Specifications
-   **Intent Analyst System**: AI for inbound communication analysis (email, SMS, voice) using OpenAI for intent detection, sentiment analysis, and automated action generation.
-   **AI Voice Dialog**: Intelligent voice call initiation with personalized, dynamic scripts and compliance features via Retell.
-   **Universal API Middleware**: Standardized interface for accounting software integrations (e.g., XeroProvider), handling OAuth and data transformation.
-   **Workflow Engine**: Customizable collection processes with pre-built templates and trackable communication.
-   **Auto-Documentation System**: AI-powered system using OpenAI to generate and update technical documentation from git diffs.
-   **Debtor Self-Service Portal**: Secure portal for debtors to manage invoices, submit disputes, make promises to pay, and process payments, with magic link + OTP authentication and Stripe integration.
-   **PTP Breach Detection Service**: Background job monitoring promises to pay, flagging breaches and creating follow-up actions.

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

## Simplified Invoice Status Model (Jan 2026)

The system uses a simplified model with invoice status from accounting software and outcome tracking:

### Invoice Status (from Xero/QB - Source of Truth)
- `OPEN`: Invoice is unpaid/outstanding
- `PAID`: Invoice has been fully paid
- `VOID`: Invoice was voided/cancelled

### Days Overdue
Computed as `today - dueDate`. Negative values mean the invoice is not yet due.

### Outcome Override (Debtor Response Tracking)
Stored on invoice, persists after payment for learning/analytics:
- `null`: No action taken yet
- `Silent`: Action taken, no response received
- `Disputed`: Invoice is disputed
- `Plan`: Payment plan in place (see payment_plans table)

### Payment Plans (Simplified for MVP)
Multi-invoice payment plans with plan-level breach detection:
- `payment_plans` - Main plan record with total amount, frequency, source, and breach detection fields (outstanding_at_creation, next_check_date, last_checked_outstanding)
- `payment_plan_invoices` - Junction table linking invoices to plans

Breach detection runs daily: if total outstanding hasn't decreased by next_check_date, a follow-up action is created. No individual installment tracking for MVP.

### Key Files
- Schema: `shared/schema.ts` (invoices.outcomeOverride, payment_plans tables)
- Types: `client/src/components/action-centre/types.ts` (OutcomeOverride type)
- Utils: `client/src/components/action-centre/utils.ts` (getDebtorStatus with outcome mapping)
- Breach Detection: `server/services/ptpBreachDetector.ts` (PTP and payment plan breach detection)

### Documentation
See `Invoice-Status-Outcomes.md` for detailed documentation for production developers.