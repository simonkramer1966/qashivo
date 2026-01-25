# Qashivo (formerly Nexus AR)

## Overview
Qashivo is an AI-first autonomous cashflow management solution for UK SMEs. Core positioning: **"Qashivo IS the credit controller"** - autonomous AI agents that execute collections work while users supervise (not assistive software where users execute). Target: MVP ready by December 15, 2025, with 10 paying customers by mid-January 2026.

### Key Differentiators
- 60-second Xero connect with instant AI analysis
- Supervised autonomy model: AI plans overnight, user approves daily, AI executes throughout the day
- Voice-driven natural language interface as primary UX
- User workflow: 10 minutes daily to supervise (vs traditional 2-3 hours executing)

### Commercial Strategy
- **Pricing Tiers**: Micro £49, Starter £149 (Most Popular), Professional £499, Enterprise Custom
- **Target**: Starter tier (£149) for first 10 customers
- **De-risk**: 90-day DSO guarantee to reduce purchase friction

## AI-First Development Roadmap (Nov 18 - Dec 15, 2025)

### Infrastructure Reuse Status
**70%+ of core infrastructure already built and reusable:**
- ✅ Email/SMS/Voice execution (SendGrid, Vonage, Retell)
- ✅ Xero sync and onboarding
- ✅ Scoring services (credit, risk, prioritization)
- ✅ Action Centre UI foundation
- ✅ Database schema (actions, schedules, assignments)
- 🛠️ Needs adaptation: Daily plan generation, approval workflow, autonomous execution

### Week 1 (Nov 18-24): Supervised Autonomy Core
**Goal**: Transform scheduler from "always running" to "generates plan → user approves → AI executes"

**Deliverables:**
- Backend generates daily plan from scoring (reuses collectionsAutomation + creditScoringService)
- User approves plan with one click via DailyPlanApprovalModal
- AI auto-executes at configured time
- Policy settings UI for automation configuration
- End-to-end tested flow

**Technical Tasks:**
1. Add automation policy fields to tenants table (approvalMode, executionTime, dailyLimits, minConfidence, exceptionRules)
2. Create GET /api/automation/daily-plan endpoint
3. Create POST /api/automation/approve-plan endpoint
4. Modify actionExecutor to check approval status
5. Build DailyPlanApprovalModal component
6. Build automation-settings page
7. Integrate approval modal into dashboard

**Reuse**: 80% backend services, 40% frontend components

### Week 2 (Nov 25-Dec 1): Automation Feed & Exceptions
**Goal**: Redesign Action Centre from "user's todo list" to "AI's work log + exceptions queue"

**Deliverables:**
- Action Centre shows completed actions first (what AI did)
- Exceptions Queue for items needing review
- Exception flagging logic (first contact >£10K, disputes, VIPs, low confidence)
- Outcome tracking from all channels
- Timeline view (Today/Yesterday/Last 7 days)

**Technical Tasks:**
1. Redesign action-centre.tsx with timeline grouping
2. Create exceptionHandler service with flagging rules
3. Build ExceptionsQueue component/tab
4. Enhance outcome tracking in actionExecutor
5. Parse Retell webhook outcomes

**Reuse**: 60% existing Action Centre

### Week 3 (Dec 2-8): AI Performance Dashboard
**Goal**: Show AI's autonomous work results, not user's pending work

**Deliverables:**
- Dashboard shows AI performance metrics (actions taken, outcomes, commitments)
- DSO trend visualization (baseline vs current)
- Coverage % indicator (customers contacted in last 7 days)
- Outcome-based analytics
- Channel effectiveness breakdown

**Technical Tasks:**
1. Redesign dashboard with AI performance focus
2. Add metrics: actions over time, outcome distribution, DSO trend
3. Build coverage gauge
4. Apply Tufte/Few visualization principles
5. Optional: Real-time execution monitor

**Reuse**: 50% existing dashboard components

### Week 4 (Dec 9-15): Polish & Launch Prep
**Goal**: Templates, onboarding flow, final QA

**Deliverables:**
- Professional email/SMS/voice templates (3 email, 2 SMS, 1 voice script)
- Polished 60-second Xero onboarding
- Enhanced audit trail (message previews, recordings, compliance exports)
- Error handling and edge cases
- Demo-ready application

**Technical Tasks:**
1. Create message_templates table and default templates
2. Enhance OnboardingWizard with instant analysis banner
3. Add audit trail features to ActionDrawer
4. Test API failures, empty states, permissions
5. End-to-end QA and demo validation

**Reuse**: 75% existing components

### Success Metrics for V1 Launch
- ✅ User can onboard in 60 seconds
- ✅ Daily plan approval takes <1 minute
- ✅ AI autonomously executes 30+ actions/day
- ✅ Dashboard shows AI performance clearly
- ✅ Exceptions handled in <5 minutes
- ✅ Demo script completes successfully
- ✅ Ready for first 10 paying customers

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

#### Cardless v2.0 (Compact) - Desktop Application Standard
The desktop application follows **Cardless v2.0 (Compact)** design principles, implemented on the Customers2 page and CardlessCustomerDrawer. This system prioritizes data density, typography-driven layouts, and minimal decoration.

**Design Philosophy:**
- Pure white backgrounds (`bg-white`) - no gradients or glassmorphism
- Typography-driven hierarchy - content speaks for itself
- Minimal decoration - remove visual noise that doesn't convey meaning
- Data-dense layouts - max-w-7xl containers for wider data views
- Compact sizing - ~25% smaller than standard v1.0

**Brand Color Palette:**
- **Green #4FAD80**: Positive states, success, paid status
- **Amber #E8A23B**: Warning states, pending, attention needed
- **Red #C75C5C**: Negative states, overdue, errors
- **Teal #17B6C3**: Interactive actions only (buttons, links) - never for status

**Typography Scale (Compact):**
- Page titles: `text-2xl font-bold text-gray-900`
- Section headers: `text-xs text-gray-400 uppercase tracking-wider`
- Table text: `text-[13px] text-gray-900`
- Labels: `text-xs text-gray-500`
- Metric values: `text-lg font-semibold tabular-nums`

**Spacing (Compact):**
- Page padding: `px-6 py-5`
- Section gaps: `space-y-4` or `gap-4`
- Table row padding: `py-2` or `py-2.5`
- Between elements: `gap-3`
- Dividers: `border-gray-100` (subtle)

**Component Sizing:**
- Inputs/Buttons: `h-9` (36px - minimum desktop touch target)
- Icon buttons: `h-9 w-9` with `p-2.5`
- Button padding: `px-2.5` minimum
- Border radius: `rounded-lg` (8px)

**Table Design:**
- No visible table element - use `div` rows with `border-b border-gray-50`
- Row hover: `hover:bg-gray-50`
- Sortable columns with subtle indicators
- Inline actions on hover

**Drawer Layout (CardlessCustomerDrawer):**
- Full-height panel with two-column layout (50/50 split)
- Left: Customer info, activity timeline, communication forms
- Right: Invoice list with filtering and selection
- Footer actions: fixed position, `border-t border-gray-100`
- Inline metrics in header (not separate cards)

**Activity Timeline:**
- Vertical timeline with `border-l-2 border-gray-100`
- Timeline dots: `w-2 h-2 rounded-full` with status colors
- Truncation fix: `w-0 flex-1 min-w-0` on text containers
- Channel icons in muted gray

**Form Elements:**
- Inputs: `bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]`
- Primary buttons: `bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full`
- Secondary buttons: `text-gray-600 hover:text-gray-900`

**Reference Implementation:** `client/src/pages/customers2.tsx` and `client/src/components/customers/CardlessCustomerDrawer.tsx`

#### Cardless v3.0 - Mobile Application (Future)
Reserved for future mobile-optimized design guidelines. Will include larger touch targets (h-11+), simplified navigation, and mobile-first layouts.

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