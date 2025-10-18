# Nexus AR

## Overview
Nexus AR is an AI-driven accounts receivable and debt recovery application designed to automate and optimize collection processes. Its primary goal is to improve cash flow and reduce days sales outstanding for businesses through intelligent automation, multi-channel communication, and data-driven insights for invoice management. The project aims to become a leading solution for enterprise B2B companies with complex AR processes, focusing on intelligent automation, multi-channel communication, and data-driven insights for invoice management.

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

### UI/UX Design
The application features a Premium Glassmorphism UI with a `bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50` page background. Cards use `bg-white/80 backdrop-blur-sm border-white/50 shadow-lg`, and metrics utilize `bg-white/70 backdrop-blur-md border-0 shadow-xl`. The primary brand color is #17B6C3 (Nexus teal). Typography includes `text-2xl font-bold` for page titles and `text-xl font-bold` for card titles. Icons are wrapped in `p-2 bg-[#17B6C3]/10 rounded-lg`. Form elements use `bg-white/70 border-gray-200/30` for inputs and `bg-[#17B6C3] hover:bg-[#1396A1] text-white` for primary buttons.

### Technical Implementation
- **Frontend**: React with TypeScript (Vite), Shadcn/ui (Radix UI), Tailwind CSS, Wouter for routing, TanStack Query for state management, React Hook Form with Zod validation.
- **Backend**: Node.js with Express.js (TypeScript ES modules), RESTful API with authentication middleware, Express sessions.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM and Drizzle Kit for schema management, designed for multi-tenancy.
- **Authentication**: Replit Auth (OpenID Connect) via Passport.js, with PostgreSQL-backed session storage.
- **Data Models**: Core entities include Users, Tenants, Contacts, Invoices, Actions, and Workflows, all with multi-tenant architecture and Zod validation.

### Partner Architecture (B2B2B Model)
A three-tier hierarchy designed for accounting firms (partners) to manage multiple client businesses (tenants) with role-based access control. Key elements include partner, tenant, and user entities, extended RBAC for partner users, session-based tenant switching, and enforced data isolation through middleware.

### Platform Admin System (Qashivo Internal)
A secure administration interface for Qashivo employees to manage and monitor the entire platform across all partners and tenants, protected by a `platformAdmin` flag and dedicated middleware. It includes dashboards for users, tenants, and partners.

### Security Architecture
Focuses on robust authentication (OAuth 2.0 with Replit OIDC), granular RBAC (50+ permissions), strict multi-tenant isolation, comprehensive input validation (Zod, Drizzle ORM), and webhook security (HMAC verification). A dedicated `platformAdmin` flag enforces access to administrative functions.

### Feature Specifications
- **Intent Analyst System**: AI-powered system for inbound communication analysis (email, SMS, voice) using OpenAI for intent detection, sentiment analysis, and automated action generation based on confidence scores.
- **AI Voice Dialog**: Intelligent voice call initiation with personalized scripts adapting to overdue severity, featuring dynamic variables, compliance features, and intent capture via Retell.
- **Universal API Middleware**: Standardized interface for accounting software integrations (e.g., XeroProvider), handling OAuth, data transformation, and secure token injection.
- **Workflow Engine**: Customizable system for collection processes with pre-built templates and trackable communication actions.
- **Auto-Documentation System**: AI-powered system monitoring git diffs to generate and update technical documentation using OpenAI, stored in structured JSON with version history.
- **Debtor Self-Service Portal**: Secure, customer-facing portal enabling debtors to manage invoices, submit disputes, make promises to pay, and process payments. Features include magic link + OTP authentication, live interest calculations, and Stripe integration.
- **PTP Breach Detection Service**: Background job monitoring promises to pay, automatically flagging breaches and creating follow-up actions for collectors when commitments are not met.

## External Dependencies

### Third-Party Services
-   **Xero**: Accounting software integration.
-   **SendGrid**: Email delivery service.
-   **Vonage**: SMS and WhatsApp messaging services.
-   **OpenAI**: AI services for natural language processing and intent detection.
-   **Neon**: Serverless PostgreSQL hosting.
-   **Retell AI**: AI voice call integration.
-   **Stripe**: Payment processing for the Debtor Self-Service Portal.

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