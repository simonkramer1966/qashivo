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

### Intent Analyst System (NEW - Oct 2025)
AI-powered inbound communication analysis that automatically processes all incoming messages:

**Three-Layer Architecture:**
1. **Webhook Layer**: Captures inbound comms from SendGrid (email), Vonage (SMS/WhatsApp), Retell (voice)
2. **AI Analysis Engine**: OpenAI-powered intent detection with confidence scoring
3. **Action Generation**: Auto-creates actions for high-confidence intents (≥60%)

**Intent Types Detected:**
- `payment_plan`: Customer wants to negotiate payment terms
- `dispute`: Customer disputes invoice or charges  
- `promise_to_pay`: Customer commits to specific payment date
- `general_query`: General questions about invoice/payment
- `unknown`: Unclear intent (flagged for manual review)

**Key Features:**
- Extracts entities: amounts, dates, promises, reasons
- Sentiment analysis: positive, neutral, negative
- Low-confidence (<60%) items flagged for manual triage
- Full transcript + analysis stored in action metadata

**Webhooks:**
- `/api/webhooks/sendgrid/inbound` - Email inbound parse
- `/api/webhooks/vonage/sms` - SMS messages
- `/api/webhooks/vonage/whatsapp` - WhatsApp messages  
- `/api/webhooks/retell/transcript` - Voice call transcripts

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
Integrations for automated email (SendGrid), SMS (Vonage), WhatsApp (Vonage), and AI voice calls (Retell AI).

**AI Voice Dialog (NEW - Oct 2025):**
Intelligent voice call initiation with personalized scripts that adapt to overdue severity:
- **4 Script Templates**: Soft Approach (≤14 days), Professional Follow-up (≤30 days), Firm Collection (≤60 days), Final Notice (>60 days)
- **Auto-Selection**: Recommends script based on days overdue with visual badge
- **Dynamic Variables**: Customer name, invoice details, organization name, amounts
- **Compliance**: Identity verification, call recording disclosure
- **Intent Capture**: Automatic transcript logging and sentiment analysis via Retell webhook
- **Smart Reset**: Script selection resets per invoice to ensure appropriate tone
- **Mobile-First**: Scrollable dialog with fixed headers (max-h-85vh)

Implementation:
- Frontend: `client/src/components/invoices/AIVoiceDialog.tsx`
- Backend: `/api/invoices/:id/initiate-voice-call` endpoint in `server/routes.ts`
- Service: Retell AI integration via `server/retell-service.ts`

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

## Competitive Analysis

### Kolleno (October 2025)
Leading accounts receivable automation platform with 1,000+ enterprise customers.

#### Core Features Observed

**1. Activity-Centric Dashboard**
- Central activity feed showing all customer interactions chronologically
- Metrics cards: Customers (185), Overdue (£2,000), Due (£12,000), Collected (£10,000)
- Filterable activity stream with customer names, dates, interaction types
- Clean, scannable list format for quick overview

**2. AI-Powered Communication**
- **AI Email Suggestion** feature that drafts personalized emails based on context
- Analyzes balance, payment history, and suggests appropriate tone
- "Insert Reply" button for quick implementation
- Shows balance details (£13,732.29) with contextual messaging

**3. Automated Workflows**
- Visual workflow builder with conditional triggers
- Example trigger: "Balance overdue >10,000"
- Action menu includes: Create task, Send email, Send SMS, Make phone call
- Workflow execution shown visually with icons and timelines

**4. Multi-Channel Action Center**
Their "Add Action" dropdown offers:
- 📞 Make a phone call
- 💬 Send an SMS  
- ✉️ Send an email
- 📋 Create a task
- 🎯 Assign to a strategy
- 👤 Assign an account manager
- 🔍 Dispute KYB/A (Know Your Business/Anti-fraud)

**5. Communications Timeline**
- Visual timeline showing complete invoice lifecycle
- Icons for different communication types (email, SMS, call, invoice)
- Historical view of all customer touchpoints
- Integration with invoice status changes

**6. Performance Analytics**
- Collected amount tracking (£150,000)
- Invoices Paid On Time: 90%
- Invoices Paid Late: 10%
- Bar charts showing payment trends over time
- Multiple metrics views for different stakeholders

**7. Enterprise Social Proof**
- Trusted by 1,000+ companies globally
- Notable clients: Payhawk, Autodesk, HubSpot, Stripe, GoCardless, Spendesk, Rakuten, DRATA
- 4.9/5 rating across G2, Capterra, Gartner
- ISO 27001 Certified security

#### Market Positioning
- **Tagline**: "Leave Your Collections Challenges to Kolleno"
- **Value Prop**: "Focus on every single invoice outstanding and leave no customer enquiry unaddressed"
- **Target**: Enterprise B2B companies with complex AR processes
- **Pricing**: Not shown, likely enterprise/custom pricing model

### Competitive Comparison: Nexus AR vs Kolleno

#### Where Nexus AR Leads ✅

**1. Intent Analyst AI (Our Secret Weapon)**
- Automatic inbound message analysis with date extraction
- AI-powered entity recognition (amounts, dates, promises)
- Sentiment analysis on all communications
- Confidence scoring (>60% auto-action, <60% manual review)
- **Kolleno doesn't show this capability**

**2. Intelligent Date Extraction**
- Automatically extracts payment commitment dates from messages
- Parses natural language: "end of month" → October 31
- Creates categorized actions: Upcoming PTP vs Broken Promises
- **Kolleno appears to lack automated date parsing**

**3. Action Centre Workflow Tabs**
- Pre-categorized workflows: Queries, Overdue, Upcoming PTP, Broken Promises, Disputes, Debt Recovery, Legal
- Automatic categorization based on AI intent analysis
- Real-time 15-second auto-refresh
- **More structured than Kolleno's generic activity feed**

**4. Message Content Display**
- Inbound SMS/email content shown in Action Centre
- Full message context with quotes and visual formatting
- Better context for decision-making
- **Kolleno shows less message detail in activity view**

#### Where Kolleno Leads 📊

**1. Visual Communication Timeline**
- Invoice lifecycle visualization with icons
- Better historical context at a glance
- **Opportunity**: Add visual timeline to invoice detail pages

**2. AI Email Drafting**
- Suggests complete email responses
- "Insert Reply" quick action
- **Opportunity**: Extend our Intent Analyst to suggest responses, not just analyze

**3. Strategy Assignment**
- Assign customers to collection strategies
- Account manager assignment workflow
- **Opportunity**: Add strategy templates and team assignment features

**4. Enhanced Metrics Dashboard**
- Collection rate percentages
- Paid on-time vs late breakdown
- **Opportunity**: Add percentage-based KPIs to dashboard

**5. Team Collaboration Features**
- Account manager assignment
- Task creation and assignment
- **Opportunity**: Multi-user workflows for enterprise

### Strategic Opportunities

**Near-Term Enhancements:**
1. **Visual Timeline**: Add invoice communication timeline to detail pages
2. **AI Response Suggestions**: Extend Intent Analyst to suggest reply messages
3. **Collection Rate Metrics**: Add % paid on-time, % paid late to dashboard
4. **Strategy Templates**: Pre-built collection strategy workflows

**Long-Term Differentiation:**
1. **Advanced Intent AI**: Our core strength - continue enhancing date/entity extraction
2. **Predictive Analytics**: Use ML to predict payment likelihood
3. **Voice AI Superiority**: Leverage Retell AI for better voice automation than competitors
4. **Real-time Intelligence**: 15-second Action Centre refresh vs static dashboards

### Key Takeaway
Kolleno is a mature, well-funded competitor with strong enterprise features. **Our competitive advantage is the Intent Analyst system** - no competitor shows AI-powered inbound analysis with automatic date extraction and categorization. We should double down on AI intelligence while selectively adopting their UX patterns (visual timelines, metrics) where they enhance user value.