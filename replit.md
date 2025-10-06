# Nexus AR

## Overview
Nexus AR is an AI-driven accounts receivable and debt recovery application designed to automate and optimize collection processes. It offers intelligent automation, multi-channel communication, and data-driven insights for invoice management, ultimately aiming to improve cash flow and reduce days sales outstanding for businesses.

## User Preferences
Preferred communication style: Simple, everyday language.

## Investor MVP Development Plan
**Deadline: Thursday, October 10, 2025 | Demo: Friday, October 11, 2025**

### Critical Requirements
MUST have working by Thursday for Friday team demo:
1. Automatic outbound email workflow
2. Inbound email processing with transcript and intent capture
3. Inbound and outbound AI voice calls with transcript logging
4. Intent detection for: payment plans, disputes, promises to pay, general queries
5. SMS bidirectional communication
6. WhatsApp bidirectional communication

### Demo Tenant
**Tenant:** Investor Demo Ltd (ID: `6feb7f4d-ba6f-4a67-936e-9cff78f49c59`)
**Customer:** Tech Startups Ltd (David Richardson)
**Invoice Portfolio:**
- 3 paid invoices (£27,500 total - showing payment history)
- 2 current invoices (£25,000 - not yet due)
- 2 recently overdue (£13,125 - 7-14 days)
- 2 seriously overdue (£19,375 - 30-60 days)  
- 1 very old overdue (£18,750 - 120 days)
- **Total Outstanding: £76,250**

All data formatted to match Xero's exact structure and field formats.

## System Architecture

### UI/UX Design
The application utilizes a Premium Glassmorphism UI, featuring a `bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50` page background, `bg-white/80 backdrop-blur-sm border-white/50 shadow-lg` for cards, and `bg-white/70 backdrop-blur-md border-0 shadow-xl` for metrics. The primary brand color is #17B6C3 (Nexus teal). Typography includes `text-2xl font-bold` for page titles and `text-xl font-bold` for card titles. Icons are wrapped in `p-2 bg-[#17B6C3]/10 rounded-lg`. Form elements use `bg-white/70 border-gray-200/30` for inputs and `bg-[#17B6C3] hover:bg-[#1396A1] text-white` for primary buttons.

### Frontend
- **Framework**: React with TypeScript (Vite build tool)
- **UI Framework**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **API Design**: RESTful API with authentication middleware
- **Session Management**: Express sessions (PostgreSQL storage)
- **Build System**: ESBuild

### Database
- **Primary Database**: PostgreSQL (Neon serverless hosting)
- **ORM**: Drizzle ORM
- **Schema Management**: Drizzle Kit
- **Multi-tenancy**: Tenant-based data isolation

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Strategy**: Passport.js (custom OIDC strategy)
- **Session Storage**: PostgreSQL-backed sessions

### Data Models
Core entities include Users, Tenants, Contacts, Invoices, Actions, and Workflows, with multi-tenant architecture and Zod validation.

### Communication Channels
Integrations for automated email (SendGrid), SMS (Vonage), and AI-driven suggestions (OpenAI).

### Universal API Middleware
Provides a standardized interface for accounting software integrations, including OAuth token management, data transformation, and secure token injection. A production-ready XeroProvider is implemented.

### Workflow Engine
Customizable workflow system for collection processes, offering pre-built templates and trackable communication actions.

### Auto-Documentation System
AI-powered documentation automation that keeps technical docs synchronized with code changes. The system:
- **Change Detection**: Monitors git diffs and identifies affected documentation sections via manifest mapping
- **AI Analysis**: Uses OpenAI to understand code changes and generate documentation updates
- **Review & Approval**: Web UI at `/documentation-review` for reviewing and approving AI-generated updates
- **Structured Storage**: JSON-based documentation with separation of auto-updatable vs. human-curated content
- **CLI Tool**: Manual sync trigger via `tsx scripts/sync-docs.ts` with interactive or auto-apply modes
- **Version History**: Audit log tracking all automated updates for rollback capability
- **Security**: Git reference sanitization prevents command injection in diff operations

Files:
- `docs/documentation-manifest.json`: Maps code files/schemas to documentation sections (validated file paths)
- `docs/documentation-content.json`: Structured documentation content
- `server/services/documentationSyncService.ts`: Core sync engine with security features
- `server/routes/documentationRoutes.ts`: API endpoints
- `scripts/sync-docs.ts`: CLI command for manual sync

Recent fixes (Oct 2025):
- Fixed command injection vulnerability in git diff execution with regex-based sanitization
- Corrected manifest file path mismatches to point to existing files
- Eliminated duplicate git diff calls by including detailedDiff in ChangeDetectionResult
- Fixed tenant ID extraction in collections learning (was incorrectly parsing from invoice ID)

## External Dependencies

### Third-Party Services
- **Xero**: Accounting software integration
- **SendGrid**: Email delivery
- **Vonage**: SMS service
- **OpenAI**: AI services
- **Neon**: Serverless PostgreSQL hosting

### Development Tools
- **Replit**: Development environment
- **Vite**: Frontend build tool
- **Drizzle**: ORM and migration tool
- **TypeScript**: Language superset

### UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Lucide**: Icon library
- **Tailwind CSS**: Utility-first CSS framework
- **Class Variance Authority**: Component variant management