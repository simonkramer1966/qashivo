# Qashivo — Technical Reference

> Last updated: March 2026

---

## 1. Product Overview

Qashivo is an AI-first autonomous cashflow management platform for UK SMEs, delivered as a B2B2B SaaS product through accounting firms. It acts as an AI credit controller, replacing the manual, inconsistent, and outcome-blind process of debtor management with a structured, supervised autonomy loop.

**Core value proposition:**
- Accounting firms connect their SME clients to Qashivo
- Qashivo imports receivables from Xero, builds a daily collection plan, and executes outreach
- Humans (accountants or SME staff) approve actions before execution
- Debtor responses (promises to pay, disputes, requests for more time) are captured as structured outcomes
- The cashflow forecast updates in real time based on actual debtor intent

**Target market:** UK SMEs (5–100 employees) with outstanding receivables, served through accounting firms as the primary channel.

**Deployment:** Hosted on Replit; PostgreSQL database on Neon serverless; frontend and backend served from a single Express/Vite process.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI Components | Shadcn/ui (Radix UI primitives), Tailwind CSS |
| Routing | Wouter |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Backend | Node.js, Express.js (TypeScript ES modules) |
| ORM | Drizzle ORM + Drizzle Kit |
| Database | PostgreSQL (Neon serverless) |
| Auth | Replit OpenID Connect + Passport.js (local strategy) |
| Sessions | Express-session with PostgreSQL session store |
| Email | SendGrid (transactional), Gmail/Outlook OAuth (connected accounts) |
| SMS | Vonage |
| Voice | Retell AI |
| AI | OpenAI (GPT-4 series) |
| Payments | Stripe |
| Accounting | Xero (OAuth 2.0) |
| Icons | Lucide React |
| Charts | Recharts |

---

## 3. Directory Structure

```
/
├── client/                     # React frontend (Vite)
│   └── src/
│       ├── pages/              # Route-level page components (~70 pages)
│       ├── components/         # Shared and feature components
│       │   ├── action-centre/  # Action queue, approval workflow UI
│       │   ├── collections/    # Collections management UI
│       │   ├── contacts/       # Contact detail panels, timeline
│       │   ├── dashboard/      # Charts, KPI tiles, cashflow forecast
│       │   ├── layout/         # AppLayout, AdminLayout, sidebar, nav
│       │   ├── onboarding/     # 6-step onboarding wizard steps
│       │   ├── settings/       # RBAC, reports, integrations settings UI
│       │   └── ui/             # Shadcn/Radix primitives
│       ├── hooks/              # Custom React hooks
│       └── lib/                # Utility functions, queryClient setup
│
├── server/                     # Express backend
│   ├── index.ts                # Server entry point, middleware setup
│   ├── routes.ts               # Root router (registers all route modules)
│   ├── auth.ts                 # Passport.js local strategy
│   ├── replitAuth.ts           # Replit OIDC authentication
│   ├── storage.ts              # Data access layer abstraction (IStorage)
│   ├── vite.ts                 # Vite dev server integration (do not modify)
│   ├── routes/                 # Feature route modules
│   ├── services/               # Business logic services
│   ├── jobs/                   # Background jobs
│   └── middleware/             # Auth, RBAC, API abstraction
│
├── shared/
│   └── schema.ts               # Drizzle ORM schema (~92 tables), Zod schemas, shared types
│
├── migrations/                 # Drizzle database migrations
├── attached_assets/            # User-uploaded static assets
├── docs/                       # Feature-level technical documentation
├── drizzle.config.ts           # Drizzle Kit configuration (do not modify)
├── vite.config.ts              # Vite build configuration (do not modify)
└── replit.md                   # Architecture notes and user preferences
```

---

## 4. Backend — Route Modules

All route modules are registered in `server/routes.ts` via `registerRoutes()`, after `setupAuth(app)` and `app.use(sanitizeObject)` middleware.

| Module | File | Routes | Purpose |
|---|---|---|---|
| Collections | `collectionsRoutes.ts` | 84 | Actions queue, collection automation, payment plans, activity logs |
| Invoices | `invoiceRoutes.ts` | 23 | Invoice CRUD, send email/SMS/voice, invoice health analysis |
| Dashboard | `dashboardRoutes.ts` | 25 | Dashboard KPIs, analytics, cashflow forecast, cash inflow |
| Integrations | `integrationRoutes.ts` | 44 | Xero OAuth, accounting providers, email/bank connections |
| Onboarding | `onboardingRoutes.ts` | 28 | 6-step onboarding wizard, demo data, demo mode toggle |
| Contacts | `contactRoutes.ts` | 43 | Contacts CRUD, notes, timeline, debtor snapshot |
| Settings | `settingsRoutes.ts` | 36 | RBAC, user invitations, tenant config, scheduled reports |
| Misc | `miscRoutes.ts` | 35 | Automation, subscriptions, wallet, attention items, voice |
| Admin | `adminRoutes.ts` | — | Platform admin: tenant management, analytics, waitlist |
| Partner | `partnerRoutes.ts` | — | Partner firm management, client relationships |
| Email Connection | `emailConnectionRoutes.ts` | — | Gmail/Outlook OAuth, email polling, inbox management |
| Webhooks | `webhooks.ts` | — | Inbound webhooks from Xero, Retell AI, Stripe |
| Sync | `syncRoutes.ts` | — | Manual and scheduled Xero sync |
| Workflow Profile | `workflowProfileRoutes.ts` | — | Workflow template management |
| Documentation | `documentationRoutes.ts` | — | AI-generated documentation endpoints |
| Prospect Scorecard | `prospectScorecardRoutes.ts` | — | Partner prospect scoring |

### Public Routes (no auth required)
- `POST /api/public/partner-waitlist` — Founding Partners waitlist form submission
- `GET /api/public/debtor-portal/:token` — Debtor self-service portal access via magic link

---

## 5. Backend — Services Layer

Located in `server/services/`. Services contain all business logic and are called by route handlers via the `storage` interface.

### AI & Decision Making
| Service | Purpose |
|---|---|
| `openai.ts` | OpenAI API wrapper for completions, intent analysis, content generation |
| `charlieDecisionEngine.ts` | Core AI agent ("Charlie") — orchestrates collection decisions |
| `charliePlaybook.ts` | Playbook definitions and escalation logic for the AI agent |
| `intentAnalyst.ts` | Processes inbound communications (email, SMS, voice) through OpenAI for intent detection, sentiment, and action generation |
| `aiMessageGenerator.ts` | Generates personalised collection messages using debtor context |
| `actionPlanner.ts` | Plans the next collection action based on invoice state and debtor profile |
| `dailyPlanGenerator.ts` | Builds the daily collection plan for human approval |
| `actionPrioritizationService.ts` | Ranks and prioritises actions in the queue |

### Collections & Workflow
| Service | Purpose |
|---|---|
| `collectionsAutomation.ts` | Orchestrates automated collection sequences and cadence enforcement |
| `collectionsScheduler.ts` | Schedules timed collection events |
| `actionExecutor.ts` | Executes approved actions (sends emails, SMS, initiates voice calls) |
| `playbookEngine.ts` | Applies collection playbook rules to contacts |
| `communicationsOrchestrator.ts` | Coordinates multi-channel communication routing |
| `ptpBreachDetector.ts` | Background service detecting broken promises to pay |
| `communicationOutcomeProcessor.ts` | Processes and persists structured outcomes from communications |

### Financial & Analytics
| Service | Purpose |
|---|---|
| `ardCalculationService.ts` | Calculates Average Rolling Days (ARD) and DSO metrics |
| `salesForecastService.ts` | Generates cashflow forecasts from invoice and outcome data |
| `dashboardCashInflowService.ts` | Computes expected cash inflow timeline |
| `dso.ts` | Days Sales Outstanding calculations |
| `invoiceHealthAnalyzer.ts` | AI-powered invoice risk and health analysis |
| `invoiceStateMachine.ts` | Manages invoice lifecycle state transitions |
| `dynamicRiskScoringService.ts` | Real-time risk scoring for debtors |
| `promiseReliabilityService.ts` | Tracks reliability scores for debtor payment promises |
| `attentionItemService.ts` | Surfaces high-priority items requiring human attention |
| `interest-calculator.ts` | Late payment interest calculations |
| `irregularBufferService.ts` | Accounts for irregular payment patterns in forecasting |

### Email
| Service | Purpose |
|---|---|
| `email/EmailService.ts` | Abstract email service interface |
| `email/SendGridEmailService.ts` | SendGrid implementation |
| `email/ConnectedEmailService.ts` | Gmail/Outlook OAuth-connected account sending |
| `emailConnection.ts` | OAuth flow management for connecting personal/firm email accounts |
| `emailPollingService.ts` | Polls connected email accounts every 5 minutes for inbound replies |
| `emailMatchingService.ts` | Multi-strategy engine matching inbound emails to debtors |
| `emailClarificationService.ts` | Handles clarification requests in email conversations |
| `emailCommunications.ts` | Core outbound email construction and delivery |
| `inboundEmailNormalizer.ts` | Normalises inbound email formats from different providers |
| `inboundEmailQueue.ts` | Queue management for inbound email processing |
| `sendgrid.ts` | SendGrid webhook processing and deliverability tracking |

### Integrations
| Service | Purpose |
|---|---|
| `xeroSync.ts` | Xero data sync (contacts, invoices, payments, bank accounts) |
| `syncScheduler.ts` | Schedules automatic Xero sync intervals |
| `subscriptionService.ts` | Stripe subscription management |

### Scoring
| Service | Purpose |
|---|---|
| `scoring/debtorScoring.ts` | Deterministic weighted scoring (0–100) based on payment history |

Scoring metrics: `onTimeRate`, `avgDaysLate`, `p90DaysLate`, `late30PlusRate`, `volatility`, `paymentRecency`.

Score bands:
- **EXCELLENT** (≥85) → GENTLE strategy
- **GOOD** (70–84) → STANDARD strategy
- **OK** (50–69) → STANDARD+ strategy
- **RISKY** (<50) → FIRM strategy
- **UNKNOWN** (<3 invoices) → default strategy

### Platform & Administration
| Service | Purpose |
|---|---|
| `securityAuditService.ts` | Logs security events (login, logout, role changes, session expiry) with IP/user-agent |
| `permissionService.ts` | Resolves RBAC permissions for users |
| `metricsService.ts` | Platform-wide metrics for admin and investor dashboards |
| `onboardingService.ts` | Manages 6-step onboarding state machine |
| `demoDataService.ts` | Seeds demo data for new tenants |
| `demoModeService.ts` | Toggles demo mode on/off per tenant |
| `reportGenerator.ts` | Generates HTML email reports (Aged Debtors, Cashflow Forecast, DSO Summary) |
| `reportScheduler.ts` | Runs scheduled report delivery via SendGrid |
| `documentationSyncService.ts` | AI-powered auto-documentation from git diffs |
| `portfolioController.ts` | Partner-level portfolio analytics across multiple client tenants |
| `clientPartnerService.ts` | Manages partner–client relationships |
| `customerTimelineService.ts` | Builds unified communication timeline for contacts |
| `contactEmailResolver.ts` | Resolves correct contact email for outreach |
| `agentManager.ts` | Manages AI agent instances and state |
| `messagePreGenerator.ts` | Pre-generates personalised messages ahead of action execution |
| `messagePostProcessor.ts` | Post-processes AI-generated messages for compliance and formatting |
| `jobQueue.ts` | Generic job queue for deferred processing |
| `mockResponderService.ts` | Simulates debtor responses for testing |
| `ensureMasterAdmin.ts` | Bootstrap utility to ensure platform admin user exists |
| `defaultWorkflowSetup.ts` | Seeds default workflow templates for new tenants |

### Universal API Middleware (`server/middleware/`)
| File | Purpose |
|---|---|
| `rbac.ts` | Role-Based Access Control — `withPermission()` middleware factory |
| `APIMiddleware.ts` | Standardises provider interfaces |
| `ProviderRegistry.ts` | Registry for accounting/comms provider implementations |
| `AuthManager.ts` | Provider-level OAuth token management |
| `providers/XeroProvider.ts` | Xero-specific API implementation |
| `providers/QuickBooksProvider.ts` | QuickBooks integration stub |
| `providers/SageProvider.ts` | Sage integration stub |
| `providers/SendGridProvider.ts` | SendGrid provider implementation |
| `providers/RetellProvider.ts` | Retell AI voice provider implementation |

---

## 6. Background Jobs

Located in `server/jobs/`.

| Job | File | Trigger | Purpose |
|---|---|---|---|
| Debtor Scoring | `debtorScoringJob.ts` | After Xero sync, or manually from Settings | Computes weighted risk scores for all contacts; stores results in `debtor_profiles` via `analysis_jobs` table |
| Workflow Timer Processor | `workflow-timer-processor.ts` | Scheduled interval | Processes exception-based triggers — PTP breach detection, plan breach follow-ups, scheduled workflow steps |

---

## 7. Authentication & Security

### Authentication Methods
1. **Replit OIDC** (`server/replitAuth.ts`) — OAuth 2.0 via Replit's OpenID Connect provider
2. **Password Auth** (`server/auth.ts`) — Local Passport.js strategy with bcrypt hashing

### Password Requirements
- Minimum 10 characters
- Mixed case (upper + lower)
- At least one number
- At least one special character
- Enforced on signup, password reset, and invite acceptance

### Session Security
- 24-hour absolute TTL
- 30-minute idle timeout
- Session regeneration on login
- Rolling sessions (TTL resets on activity)
- PostgreSQL-backed session store (`sessions` table)

### Rate Limiting
- Login: 5 attempts per 15 minutes
- Signup: 3 attempts per hour
- Password reset: 3 attempts per hour

### RBAC — 6 Tiers
| Role | Access Level |
|---|---|
| **Owner** | Full control including subscription management; subscription creator |
| **Admin** | Full system access except subscription management |
| **Accountant / Partner** | Admin-level access across multiple tenants (partner firms) |
| **Manager** | Oversees credit controllers; sees cashflow and financing; no Settings access |
| **Credit Controller** | Collections work only; no Settings, cashflow, or financing |
| **Read Only** | View-only access; no Settings |

Permissions are enforced via `withPermission()` middleware from `server/middleware/rbac.ts`. Key permissions: `invoices:edit`, `customers:edit`, `collections:sms`, `collections:voice`, `admin:users`, `admin:settings`.

**Contact-level access:** Credit controllers and read-only users only see contacts and invoices assigned to them. Managers and above have full access.

### Audit Logging
All audit, partner, and security events are consolidated into the `activity_logs` table with a `category` field (`audit`, `partner`, `security`, `communication`, `system`). Typed FK columns link events to relevant entities (`debtorId`, `invoiceId`, `actionId`, `outcomeId`).

### Webhook Security
HMAC verification on all inbound webhooks (Xero, Stripe). OAuth state parameters are HMAC-signed for CSRF protection.

---

## 8. Data Model

The schema is defined in `shared/schema.ts` using Drizzle ORM. Approximately 92 tables across 7 domains.

### Core System & Multi-Tenancy
| Table | Purpose |
|---|---|
| `sessions` | Express session storage |
| `tenants` | Organisation entities; Xero/email integration config; AI automation policies |
| `users` | User accounts with role and tenant association |
| `tenant_metadata` | Usage limits, feature flags, billing state |
| `subscription_plans` | Stripe-backed subscription tier definitions |

### Contacts & Customers
| Table | Purpose |
|---|---|
| `contacts` | Debtors and vendors; credit state, risk score, playbook stage |
| `customer_contact_persons` | Named individuals within a customer firm (billing contacts, escalation contacts) |
| `contact_notes` | Internal notes, follow-ups, and reminders |
| `debtor_profiles` | Scoring results with factor breakdown JSON |

### Invoices & Financials
| Table | Purpose |
|---|---|
| `invoices` | Accounts receivable; lifecycle from OPEN to PAID/VOID; outcome override state |
| `bills` | Accounts payable |
| `bill_payments` | Payments made against bills |
| `bank_accounts` | Integrated bank account records |
| `bank_transactions` | Bank feed transactions |
| `wallet_transactions` | Qashivo-managed fund movements (advances, payouts, insurance) |

### Collections & Workflow
| Table | Purpose |
|---|---|
| `actions` | AI-generated collection task queue; approval state; channel type |
| `outcomes` | Canonical structured outcomes from debtor responses (PTP, Dispute, More Time, etc.) |
| `workflows` | Visual workflow definitions |
| `workflow_nodes` | Individual nodes in a workflow graph |
| `workflow_connections` | Edges/transitions between workflow nodes |
| `workflow_timers` | Exception-based triggers (PTP breach, plan breach) |
| `communication_templates` | Reusable message templates |
| `global_templates` | Platform-wide default templates |
| `tenant_templates` | Tenant-customised templates |

### Debtor Commitments
| Table | Purpose |
|---|---|
| `payment_plans` | Installment-based repayment agreements |
| `payment_plan_invoices` | Junction: which invoices belong to a plan |
| `promises_to_pay` | Dated payment commitments from debtors |
| `payment_promises` | Extended PTP tracking with confidence and follow-up state |
| `disputes` | Formal dispute records with resolution workflow |
| `magic_link_tokens` | Secure passwordless tokens for debtor portal access |

### Analytics & Learning
| Table | Purpose |
|---|---|
| `risk_scores` | ML-driven risk assessments per contact |
| `debtor_profiles` | Deterministic scoring results (0–100) with factor JSON |
| `customer_behavior_signals` | Statistical debtor behaviour profiles (avg days to pay, response rates) |
| `action_effectiveness` | Feedback loop: did this action lead to a reply, payment, or open? |
| `analysis_jobs` | Background job tracking for scoring runs |
| `sales_forecasts` | Cashflow forecast snapshots |
| `ard_history` | Historical ARD/DSO time series data |
| `activity_logs` | Unified audit trail for all system, security, and communication events |

### Communications
| Table | Purpose |
|---|---|
| `voice_calls` | Retell AI voice call logs and transcripts |
| `sms_messages` | Bidirectional SMS tracking |
| `timeline_events` | Chronological communication and event history per contact |
| `scheduled_reports` | Automated report delivery configuration |

### Partner & Platform
| Table | Purpose |
|---|---|
| `partners` | Accounting firm entities in the B2B2B model |
| `partner_client_relationships` | Links partner users to client tenants with access level |
| `investor_leads` | Marketing and demo tracking for investor relations |
| `partner_waitlist` | Founding Partners waitlist signups |

---

## 9. Multi-Tenant & Partner Architecture

### Three-Tier Hierarchy
```
Platform (Qashivo)
    └── Partners (Accounting Firms)
            └── Tenants (SME Clients)
                    └── Users (SME Staff)
```

- Partners can manage multiple client tenants
- Session-based tenant switching allows accountants to work across clients
- Strict data isolation: all queries are scoped to `tenantId`
- Partner users have `Accountant / Partner` role, granting admin-level access across their client portfolio

### Platform Admin
- Internal Qashivo employee interface at `/qashivo-admin` and `/admin/*`
- Protected by `user.platformAdmin === true` flag
- Provides: tenant management, partner oversight, waitlist management, platform analytics, user provisioning

---

## 10. Third-Party Integrations

### Xero
- OAuth 2.0 connection per tenant
- Syncs: contacts, invoices, payments, bank accounts, credit notes
- Bidirectional: payments captured in Xero update invoice state in Qashivo
- Webhooks for real-time updates

### SendGrid
- Transactional email delivery
- Inbound email parsing via SendGrid Inbound Parse webhook
- Scheduled report delivery
- Fallback when no connected email account is configured

### Gmail / Outlook (Email OAuth)
- Users connect their own email account via OAuth
- Outbound collection emails sent from the user's own address
- Inbound emails polled every 5 minutes
- Multi-strategy matching: thread headers → sender mapping → domain mapping → direct email → domain match
- Unmatched emails surface in the Inbox with one-click assignment

### Vonage
- SMS outbound for collection chasers
- SMS inbound (WhatsApp and standard SMS)
- Webhook endpoint for inbound message processing

### Retell AI
- AI voice calls with dynamic, personalised scripts
- Compliance features (opt-out detection, call recording consent)
- Post-call: transcript analysed for intent, outcome stored, follow-up email generated automatically

### OpenAI
- Intent detection on all inbound communications
- Sentiment analysis
- Message generation (email, SMS, voice scripts)
- Escalation trigger detection
- Full conversation thread analysis for multi-tranche payment extraction
- Auto-documentation generation from git diffs

### Stripe
- Subscription billing for tenants
- Payment collection via Debtor Self-Service Portal
- Webhook processing for payment events

---

## 11. Frontend Architecture

### Pages (`client/src/pages/`)
Key pages:

| Page | Route | Purpose |
|---|---|---|
| `dashboard.tsx` | `/dashboard` | Main SME overview: KPIs, cashflow, aging |
| `action-centre.tsx` | `/actions` | Primary credit controller workflow hub |
| `contacts.tsx` | `/contacts` | Contact list with filtering and search |
| `Contact.tsx` | `/contacts/:id` | Contact detail with timeline and invoices |
| `invoices.tsx` | `/invoices` | Invoice list |
| `cash-flow.tsx` | `/cashflow` | Cashflow forecast visualisation |
| `settings.tsx` | `/settings` | Tenant settings: users, RBAC, integrations, reports |
| `onboarding.tsx` | `/onboarding` | 6-step onboarding wizard |
| `debtor-portal.tsx` | `/portal/:token` | Debtor self-service portal |
| `founding-partners.tsx` | `/founding-partners` | Public marketing landing page |
| `admin-waitlist.tsx` | `/admin/waitlist` | Platform admin: waitlist management |
| `investors/metrics.tsx` | `/investors/metrics` | Investor KPI dashboard |

### Design System
Two responsive design systems:
- **Cardless v2.0 (Desktop)** — data-dense, typographic, white background, compact spacing
- **Cardless v3.0 (Mobile)** — Apple HIG-inspired, card-based, generous touch targets

Data visualisation principles follow Edward Tufte and Stephen Few: maximise data-ink ratio, remove chartjunk, use colour only to convey meaning.

### State Management
- **TanStack Query v5** for all server state (fetching, caching, invalidation)
- React Hook Form + Zod for all forms
- Zustand or local state for transient UI state

### Key Hooks
| Hook | Purpose |
|---|---|
| `useAuth.ts` | Current user, tenant, and authentication state |
| `usePermissions.ts` | RBAC permission checks in the UI |
| `useDashboardWebSocket.ts` | Real-time dashboard updates |
| `useCurrency.ts` | Tenant currency formatting |
| `useInactivityTimer.ts` | Session idle timeout enforcement |

---

## 12. Key Feature Specifications

### 6-Step Onboarding Wizard
Steps: (1) Company Details, (2) Connect Xero, (3) Connect Email, (4) Connect Bank, (5) Debtor Scoring (background), (6) Contact Data Analysis.

Completion requires: step 1 COMPLETED; steps 2–6 COMPLETED, SKIPPED, or RUNNING. Steps 5 and 6 run as background jobs after Xero sync.

### Debtor Self-Service Portal
- Magic link + OTP authentication (no password required for debtors)
- Debtors can view invoices, raise disputes, submit promises to pay, and make payments via Stripe
- Accessible at `/portal/:token`

### Intent Analyst (Inbound Communications)
All inbound channels (email, SMS, voice transcripts) pass through `intentAnalyst.processInboundMessage()`. OpenAI classifies intent and sentiment, generates a structured outcome, and creates a follow-up action if required. Results written to the `outcomes` table.

### Active Conversation Auto-Reply
When a debtor replies to a collection email, the AI responds immediately, bypassing cadence restrictions. OpenAI detects escalation triggers (hostile language, requests to speak to a human) and decides whether to continue the automated conversation or create a human action.

### PTP Breach Detection
Background job monitors all active promises to pay. If a payment date passes without the invoice balance decreasing, the promise is marked BREACHED and a follow-up action is created for the credit controller.

### Payment Plans
Multi-invoice installment plans with plan-level breach detection. Daily job checks whether outstanding balances have decreased as per the agreed schedule. Breaches trigger follow-up actions.

### Automated Scheduled Reports
Reports available: Aged Debtors, Cashflow Forecast, Collection Performance, DSO Summary. Configurable frequency (daily, weekly, monthly). Generated as HTML emails and delivered via SendGrid. Managed under Settings > Reports.

### Universal Voice Call Follow-Up
Every completed voice call triggers an AI-generated personalised follow-up email. The system gathers debtor context, generates the email via OpenAI, respects channel cooldowns and touch limits, and stores the email in the timeline for visibility.

---

## 13. Environment & Secrets

Required environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing key |
| `OPENAI_API_KEY` | OpenAI API access |
| `SENDGRID_API_KEY` | SendGrid email delivery |
| `VONAGE_API_KEY` / `VONAGE_API_SECRET` | Vonage SMS |
| `RETELL_API_KEY` | Retell AI voice |
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` | Xero OAuth |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Stripe payments |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth for email connection |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Outlook OAuth for email connection |
| `REPLIT_DOMAINS` | Replit deployment domain (set automatically) |

---

## 14. Running the Project

The project runs as a single process: Express serves the API and Vite serves the React frontend in development.

```bash
npm run dev        # Start development server (workflow: "Start application")
npm run db:push    # Push schema changes to the database
```

The Vite config and `drizzle.config.ts` must not be modified — they are preconfigured for the Replit environment.

---

## 15. Legal

The platform is operated by **Nexus KPI Limited** (trading as Qashivo).
