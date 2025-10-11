# Qashivo Developer Handover Document
**Project: Nexus AR - AI-Driven Accounts Receivable Platform**  
**Last Updated: October 11, 2025**  
**Status: Investor MVP - Demo Ready**

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [API Structure](#api-structure)
6. [Frontend Architecture](#frontend-architecture)
7. [Core Features Implemented](#core-features-implemented)
8. [External Integrations](#external-integrations)
9. [Key Services & Components](#key-services--components)
10. [Development Workflow](#development-workflow)
11. [Recent Work & Current State](#recent-work--current-state)
12. [Known Issues & Next Steps](#known-issues--next-steps)

---

## 1. Project Overview

### Business Context
Nexus AR (marketed as "Qashivo") is an AI-driven accounts receivable and debt recovery platform designed to automate collection processes. The platform offers intelligent automation, multi-channel communication, and data-driven insights to improve cash flow and reduce days sales outstanding (DSO) for businesses.

### Target Market
- **Primary**: B2B companies with complex AR processes
- **Pricing Tiers**: 
  - Standard: £49/month
  - Premium: £99/month
- **Competitive Edge**: AI-powered Intent Analyst system (unique vs competitors like Kolleno)

### Demo Tenant
**Investor Demo Ltd** (ID: `6feb7f4d-ba6f-4a67-936e-9cff78f49c59`)
- Customer: Tech Startups Ltd (David Richardson)
- Total Outstanding: £76,250 across 7 invoices
- Demonstrates full invoice lifecycle and multi-channel communications

---

## 2. Technical Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Framework**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom glassmorphism theme
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack Query v5 (React Query)
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React + React Icons (for logos)

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **API Design**: RESTful with multi-tenant architecture
- **Session Management**: Express sessions (PostgreSQL-backed)
- **Build System**: ESBuild

### Database
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Migration Tool**: Drizzle Kit
- **Schema**: Multi-tenant with row-level tenant isolation

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Strategy**: Passport.js custom OIDC
- **Session Storage**: PostgreSQL (connect-pg-simple)

### External Services
- **Accounting**: Xero (OAuth 2.0)
- **Email**: SendGrid (API + Inbound Parse)
- **SMS/WhatsApp**: Vonage
- **Voice AI**: Retell AI
- **AI/ML**: OpenAI (GPT-4 for intent analysis)
- **Payments**: Stripe (subscription management)

---

## 3. System Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────┐
│           Frontend (React + TypeScript)          │
│  - Pages (Wouter routing)                        │
│  - Components (Shadcn/ui)                        │
│  - State (TanStack Query)                        │
└─────────────────────────────────────────────────┘
                        ↕ HTTP/REST
┌─────────────────────────────────────────────────┐
│           Backend (Express + TypeScript)         │
│  - API Routes (/api/*)                           │
│  - Services Layer                                │
│  - Middleware (auth, tenant isolation)           │
└─────────────────────────────────────────────────┘
                        ↕ SQL
┌─────────────────────────────────────────────────┐
│         Database (PostgreSQL + Drizzle)          │
│  - Multi-tenant schema                           │
│  - Tenant-based data isolation                   │
└─────────────────────────────────────────────────┘
```

### Key Architectural Patterns

#### 1. Multi-Tenancy
- Every table has `tenantId` foreign key to `tenants` table
- Row-level security via middleware (`isAuthenticated`)
- User-tenant association through `users.tenantId`

#### 2. Intent Analyst System (Core AI Feature)
**Three-Layer Architecture:**
```
Webhook Layer → AI Analysis Engine → Action Generation
     ↓                   ↓                    ↓
  Capture          OpenAI Intent         Auto-create
  Inbound          Detection             Actions (≥60%
  Messages         + Sentiment           confidence)
```

**Intent Types:**
- `payment_plan`: Customer negotiating payment terms
- `dispute`: Invoice disputes
- `promise_to_pay`: Payment commitments
- `general_query`: General questions
- `unknown`: Low confidence (<60%)

**Data Flow:**
1. Inbound message → Webhook (`/api/webhooks/{provider}/inbound`)
2. Store in `inbound_messages` table
3. AI analysis via OpenAI
4. Extract entities (amounts, dates, reasons)
5. Create action if confidence ≥ 60%
6. Metadata stores full transcript + analysis

#### 3. Universal API Middleware
Provides standardized interface for accounting software:
- OAuth token management (refresh, expiry handling)
- Data transformation (Xero → Internal schema)
- Secure token injection
- Currently: Xero fully implemented, Sage/QB planned

---

## 4. Database Schema

### Core Tables

#### **tenants** (Multi-tenancy root)
```sql
id (PK), name, subdomain, settings (JSONB)
xeroAccessToken, xeroRefreshToken, xeroTenantId, xeroExpiresAt
collectionsAutomationEnabled, communicationMode
brandPrimaryColor, industry, businessType
```

#### **users**
```sql
id (PK), email, firstName, lastName
tenantId (FK → tenants)
role (owner, admin, user, partner, client_owner)
stripeCustomerId, stripeSubscriptionId
```

#### **contacts** (Customers & Vendors)
```sql
id (PK), tenantId (FK), xeroContactId
name, email, phone, companyName, address
role (customer, vendor, both)
paymentTerms, creditLimit, preferredContactMethod
riskScore, riskBand, creditAssessment (JSONB)
-- AR Overlay fields (collections-specific)
arContactName, arContactEmail, arContactPhone, arNotes
```

#### **invoices**
```sql
id (PK), tenantId (FK), contactId (FK)
xeroInvoiceId, invoiceNumber, amount, amountPaid
status (pending, paid, overdue, cancelled, payment_plan)
collectionStage (initial → reminder_1 → reminder_2 → formal_notice → final_notice → escalated)
isOnHold, escalationFlag, legalFlag
issueDate, dueDate, paidDate
workflowId, lastReminderSent, reminderCount
nextAction, nextActionDate
```

#### **actions** (Communication tracking)
```sql
id (PK), tenantId (FK), invoiceId (FK), contactId (FK), userId (FK)
type (email, sms, call, whatsapp, payment, note, workflow_start)
status (pending, scheduled, executing, completed, failed)
subject, content, scheduledFor, completedAt
metadata (JSONB) -- stores direction, messageId, analysis
-- Intent fields
intentType, intentConfidence, sentiment
aiGenerated, source (automated, manual)
```

#### **inbound_messages** (AI Intent Analysis)
```sql
id (PK), tenantId (FK), contactId (FK), invoiceId (FK)
channel (email, sms, whatsapp, voice)
from, to, subject, content, receivedAt
-- AI Analysis Results
analyzed, intentType, intentConfidence, sentiment
extractedEntities (JSONB) -- amounts, dates, promises, reasons
analysisMetadata (JSONB) -- full AI response
actionCreated, actionId (FK → actions)
```

#### **payment_plans**
```sql
id (PK), tenantId (FK), contactId (FK), createdByUserId (FK)
planNumber, totalAmount, installments
status (proposed, active, completed, defaulted, cancelled)
startDate, endDate, paymentFrequency (weekly, biweekly, monthly)
notes, termsAccepted, termsAcceptedAt
```

#### **workflows & workflow_nodes** (Visual workflow builder)
```sql
-- workflows table
id (PK), tenantId (FK), name, description
trigger (overdue_x_days, new_invoice, payment_received)
isActive, priority

-- workflow_nodes table  
id (PK), workflowId (FK), type (trigger, action, condition, delay)
config (JSONB) -- node-specific settings
position (JSONB) -- canvas coordinates
```

### Important Relationships
```
tenants (1) ──→ (∞) users
tenants (1) ──→ (∞) contacts
tenants (1) ──→ (∞) invoices
contacts (1) ──→ (∞) invoices
invoices (1) ──→ (∞) actions
contacts (1) ──→ (∞) payment_plans
payment_plans (1) ──→ (∞) payment_plan_invoices ←─ (∞) invoices
```

### Indexes (Performance Critical)
```sql
-- Invoices (server-side filtering)
idx_invoices_tenant_status (tenantId, status)
idx_invoices_due_date (dueDate)
idx_invoices_next_action_date (tenantId, nextActionDate)

-- Contacts (search)
idx_contacts_name, idx_contacts_email, idx_contacts_company_name

-- Actions (action centre queries)
idx_actions_tenant_status, idx_actions_intent_type
```

---

## 5. API Structure

### Authentication & User Management
```
GET  /api/auth/user              - Get current user
GET  /api/auth/login             - Initiate Replit OAuth
GET  /api/auth/logout            - Logout
GET  /api/callback               - OAuth callback
GET  /api/user/accessible-tenants - List accessible tenants
POST /api/user/switch-tenant     - Switch active tenant
```

### Core Business Logic
```
# Invoices
GET    /api/invoices                      - List with filters (status, search, pagination)
GET    /api/invoices/:id                  - Get single invoice
POST   /api/invoices/:id/hold             - Put invoice on hold
POST   /api/invoices/:id/unhold           - Remove hold
POST   /api/invoices/:id/mark-paid        - Mark as paid
POST   /api/invoices/:id/initiate-voice-call - Start AI voice call
GET    /api/invoices/interest-summary     - Calculate interest on overdue

# Contacts
GET    /api/contacts                      - List with filters
GET    /api/contacts/:id                  - Get single contact
POST   /api/contacts/:id/ar-details       - Update AR overlay fields
POST   /api/contacts/:id/notes            - Add note
DELETE /api/contacts/:id/cleanup          - Clean duplicate contacts

# Actions (Communications)
GET    /api/actions                       - List all actions
GET    /api/actions/all                   - Paginated with search (Comms tab)
POST   /api/actions                       - Create manual action
GET    /api/action-centre/tabs            - Get tab counts (Queries, PTP, etc.)

# Payment Plans
POST   /api/payment-plans                 - Create plan
GET    /api/payment-plans/:id             - Get plan details
POST   /api/payment-plans/:id/link-invoices - Link invoices to plan
```

### Provider Integrations
```
# Xero
GET    /api/providers/xero/connect        - Initiate OAuth
GET    /api/xero/callback                 - OAuth callback
POST   /api/xero/disconnect               - Disconnect
POST   /api/xero/sync                     - Manual sync
GET    /api/xero/sync/settings            - Get sync settings
POST   /api/xero/sync/settings            - Update sync settings

# Communication Providers
POST   /api/communications/send           - Send email/SMS via template
POST   /api/test/email                    - Test email delivery
POST   /api/test/sms                      - Test SMS delivery
POST   /api/test/voice                    - Test voice call
```

### Webhooks (Inbound Processing)
```
POST   /api/webhooks/sendgrid/inbound     - Email inbound parse
POST   /api/webhooks/vonage/sms           - SMS messages
POST   /api/webhooks/vonage/whatsapp      - WhatsApp messages
POST   /api/webhooks/retell/transcript    - Voice call transcripts
POST   /api/webhooks/xero                 - Xero data change events
```

### Collections Automation
```
GET    /api/collections/automation/status  - Check if enabled
POST   /api/collections/automation/toggle  - Enable/disable
GET    /api/collections/templates          - Get comm templates
POST   /api/collections/templates          - Create template
GET    /api/collections/schedules          - Get workflows
POST   /api/collections/schedules          - Create workflow
```

### Machine Learning
```
POST   /api/ml/seasonal-patterns           - Analyze payment patterns
POST   /api/ml/customer-segmentation       - Segment customers
POST   /api/ml/risk-score                  - Calculate risk score
POST   /api/ml/payment-prediction          - Predict payment likelihood
```

### Documentation (Auto-sync)
```
GET    /api/documentation/content          - Get docs
POST   /api/documentation/detect-changes   - Detect code changes
POST   /api/documentation/generate-updates - AI-generate updates
POST   /api/documentation/apply-updates    - Apply approved updates
```

---

## 6. Frontend Architecture

### Directory Structure
```
client/src/
├── pages/                    # Route components
│   ├── action-centre.tsx     # Main collections workspace
│   ├── invoices.tsx          # Invoice list & details
│   ├── contacts.tsx          # Customer management
│   ├── workflows.tsx         # Visual workflow builder
│   ├── settings.tsx          # Tenant settings
│   ├── onboarding.tsx        # Multi-step onboarding
│   └── ...
├── components/
│   ├── ui/                   # Shadcn components
│   ├── layout/               # App shell (sidebar, header)
│   ├── invoices/             # Invoice-specific components
│   │   ├── AIVoiceDialog.tsx # Voice call initiation
│   │   └── ...
│   └── workspace/            # Action centre components
├── lib/
│   ├── queryClient.ts        # TanStack Query setup
│   └── utils.ts              # Utility functions
└── hooks/
    └── use-toast.ts          # Toast notifications
```

### Key Pages

#### **Action Centre** (`action-centre.tsx`)
**Purpose**: Central hub for collections activities
**Features**:
- Tab-based workflow categorization:
  - Comms (all communications)
  - Queries, Overdue, Upcoming PTP, Broken Promises, Disputes
- 8-column communications table:
  - Customer, Direction (↓/↑), Type, Date/Time, Invoice, Subject/Message, Status, Intent
- Real-time 15-second auto-refresh
- Smart timestamp with tooltips (hover for exact date/time)
- Pagination with search/filter
- Message content display (3-line truncation)

**Data Flow**:
```
useQuery('/api/actions/all') → Paginated comms
  ↓
Display in table with:
- Inbound message content from metadata.originalMessage.content
- Outbound message from subject field
- Intent badges (PTP, Dispute, Query)
- Direction icons (teal for inbound, grey for outbound)
```

#### **Invoices** (`invoices.tsx`)
**Features**:
- Server-side filtering by status (all, overdue, paid, pending)
- Search by invoice number or customer name
- Interest calculation display
- AI Voice Call dialog with 4 script templates:
  - Soft Approach (≤14 days overdue)
  - Professional Follow-up (≤30 days)
  - Firm Collection (≤60 days)
  - Final Notice (>60 days)
- Hold/Unhold functionality
- Payment plan creation

### Design System

#### Color Scheme
```css
--primary: #17B6C3        /* Nexus teal */
--primary-hover: #1396A1  /* Darker teal */
```

#### Glassmorphism UI
```css
/* Page background */
bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50

/* Cards */
bg-white/80 backdrop-blur-sm border-white/50 shadow-lg

/* Metrics cards */
bg-white/70 backdrop-blur-md border-0 shadow-xl

/* Form inputs */
bg-white/70 border-gray-200/30

/* Primary buttons */
bg-[#17B6C3] hover:bg-[#1396A1] text-white
```

### State Management Pattern
```tsx
// TanStack Query for server state
const { data, isLoading } = useQuery<Invoice[]>({
  queryKey: ['/api/invoices', { status, search }],
  // Custom queryFn when passing URL params
  queryFn: async () => {
    const params = new URLSearchParams({ status, search });
    const res = await fetch(`/api/invoices?${params}`);
    return res.json();
  },
  refetchOnMount: true,
  staleTime: 0, // Always fresh
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/invoices', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    toast({ title: 'Success!' });
  },
});
```

---

## 7. Core Features Implemented

### ✅ Multi-Channel Communications
1. **Email (SendGrid)**
   - Outbound templates
   - Inbound parse webhook
   - Intent analysis on replies
   - Template variables: {customer_name}, {invoice_number}, etc.

2. **SMS (Vonage)**
   - Bidirectional messaging
   - International support
   - Webhook for inbound
   - Character count optimization

3. **WhatsApp (Vonage)**
   - Business API integration
   - Template approval flow
   - Media support (images, PDFs)

4. **AI Voice Calls (Retell AI)**
   - 4 severity-based scripts
   - Dynamic variable injection
   - Automatic transcript capture
   - Intent extraction from calls

### ✅ AI Intent Analyst
**Capabilities**:
- Analyze inbound emails, SMS, WhatsApp, voice
- Extract entities:
  - Amounts: "£5,000", "$1,200.50"
  - Dates: "end of month" → 2025-10-31
  - Promises: "I'll pay next Friday"
  - Dispute reasons: "incorrect invoice", "service issue"
- Sentiment: positive, neutral, negative
- Confidence scoring (0-100%)
- Auto-create actions if ≥60% confidence
- Flag for manual review if <60%

**Implementation**:
- Service: `server/services/intentAnalyst.ts`
- OpenAI Integration: GPT-4 with structured outputs
- Webhook handlers: `server/routes/webhooks.ts`

### ✅ Xero Integration
- OAuth 2.0 authentication
- Auto token refresh (2-hour expiry handling)
- Bidirectional sync:
  - Pull: Invoices, Contacts, Payments, Bank Transactions
  - Push: Payment status updates
- Incremental sync with cursor tracking
- Webhook support for real-time updates
- Background scheduler (4-hour intervals)

### ✅ Collections Automation
- Visual workflow builder (React Flow)
- Trigger-based execution:
  - Invoice overdue X days
  - New invoice created
  - Payment received
- Action types: Email, SMS, Call, Wait, Condition
- Template library with variables
- Schedule management
- Customer segment assignment

### ✅ Payment Plans
- Flexible installment creation
- Invoice linking (multiple invoices per plan)
- Payment schedule generation
- Status tracking (proposed, active, completed, defaulted)
- Automatic invoice status sync

### ✅ Action Centre Workspace
- Tab-based workflow categorization
- Priority queue with AI suggestions
- Bulk actions (assign, complete, snooze)
- Real-time updates (15s polling)
- Smart filtering and search
- Mobile-responsive design

---

## 8. External Integrations

### Xero (Accounting)
**Setup Location**: `server/providers/xero.ts`
**OAuth Flow**:
1. `/api/providers/xero/connect` → Redirect to Xero
2. User authorizes
3. `/api/xero/callback` → Store tokens
4. Background refresh every 2 hours

**Sync Service**: `server/services/xeroSync.ts`
- Full sync on first connect
- Incremental sync thereafter
- Entity mappings: Xero → Internal schema
- Error handling with retry logic

**Environment Variables**:
```
XERO_CLIENT_ID
XERO_CLIENT_SECRET  
XERO_REDIRECT_URI
```

### SendGrid (Email)
**Setup**: `server/services/sendgrid.ts`
**Capabilities**:
- Transactional email
- Template system
- Inbound parse (email replies)
- Link tracking
- Open tracking

**Inbound Parse**:
1. Configure: `https://yourdomain.com/api/webhooks/sendgrid/inbound`
2. Webhook receives raw email
3. Extract: from, to, subject, text, html
4. Store in `inbound_messages`
5. Trigger intent analysis

**Environment Variables**:
```
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
```

### Vonage (SMS/WhatsApp)
**Setup**: `server/services/vonage.ts`
**Features**:
- SMS: Worldwide delivery
- WhatsApp Business: Template messaging
- Message status tracking
- Delivery receipts

**Webhooks**:
- SMS: `/api/webhooks/vonage/sms`
- WhatsApp: `/api/webhooks/vonage/whatsapp`
- Status: `/api/webhooks/vonage/status`

**Environment Variables**:
```
VONAGE_API_KEY
VONAGE_API_SECRET
VONAGE_PHONE_NUMBER
```

### Retell AI (Voice)
**Setup**: `server/services/retell-service.ts`
**Capabilities**:
- AI agent configuration
- Phone number provisioning
- Call initiation
- Real-time transcription
- Intent extraction from speech

**Script Templates**:
```javascript
// Soft approach (≤14 days)
"Hi {customer_name}, this is {agent_name} from {organization}..."

// Firm collection (≤60 days)
"This is a formal notice regarding overdue payment..."
```

**Webhook**: `/api/webhooks/retell/transcript`
- Receives call transcript
- Extracts intent/entities
- Creates action with metadata

**Environment Variables**:
```
RETELL_API_KEY
RETELL_AGENT_ID
RETELL_PHONE_NUMBER
```

### OpenAI (AI Services)
**Usage**:
- Intent analysis (GPT-4)
- Entity extraction
- Sentiment analysis
- Documentation auto-sync
- Customer segmentation

**Models**:
- `gpt-4-turbo-preview`: Intent analysis
- `gpt-3.5-turbo`: Simpler tasks

**Environment Variables**:
```
OPENAI_API_KEY
```

---

## 9. Key Services & Components

### Backend Services

#### **Intent Analyst** (`server/services/intentAnalyst.ts`)
**Purpose**: AI-powered analysis of inbound communications
**Methods**:
```typescript
class IntentAnalystService {
  async processInboundMessage(messageId: string): Promise<void>
  private async analyzeIntent(message): Promise<IntentAnalysisResult>
  private async createActionFromIntent(message, analysis): Promise<void>
  private extractPaymentDate(text: string): Date | null
}
```

**OpenAI Prompt Structure**:
```
Analyze this customer message for payment-related intent:
- Intent type: payment_plan | dispute | promise_to_pay | general_query | unknown
- Confidence: 0-100
- Sentiment: positive | neutral | negative
- Extract: amounts, dates, reasons
```

#### **Collections Scheduler** (`server/services/collectionsScheduler.ts`)
**Purpose**: Execute automated workflows
**Initialization**:
```typescript
// server/index.ts
import { initializeCollectionsScheduler } from './services/collectionsScheduler';
await initializeCollectionsScheduler();
```

**How It Works**:
1. Every 15 minutes, check for scheduled actions
2. Filter by `nextActionDate <= now`
3. Execute action (send email/SMS/call)
4. Update invoice `lastReminderSent`, `reminderCount`
5. Calculate next action based on workflow

#### **Xero Sync Service** (`server/services/xeroSync.ts`)
**Purpose**: Bidirectional sync with Xero
**Methods**:
```typescript
class XeroSyncService {
  async syncInvoices(tenantId: string): Promise<void>
  async syncContacts(tenantId: string): Promise<void>
  async syncPayments(tenantId: string): Promise<void>
  async syncBankTransactions(tenantId: string): Promise<void>
  private async refreshTokenIfNeeded(tenant): Promise<void>
}
```

**Sync Strategy**:
- **Full Sync**: First connection, pulls all historical data
- **Incremental**: Uses `UpdatedDateUTC` cursor for changes only
- **Scheduler**: Background job every 4 hours
- **Webhook**: Real-time updates for invoice changes

#### **Action Executor** (`server/services/actionExecutor.ts`)
**Purpose**: Execute queued actions
**Supported Actions**:
- `email`: Use SendGrid template
- `sms`: Send via Vonage
- `whatsapp`: Send via Vonage WhatsApp
- `call`: Initiate Retell AI call
- `payment`: Record payment

**Execution Flow**:
```typescript
async function executeAction(actionId: string): Promise<void> {
  const action = await storage.getAction(actionId);
  
  switch (action.type) {
    case 'email':
      await sendEmail(action.metadata.template, action.contactId);
      break;
    case 'sms':
      await sendSMS(action.content, action.contactId);
      break;
    // ... other types
  }
  
  await storage.updateAction(actionId, { 
    status: 'completed',
    completedAt: new Date()
  });
}
```

### Frontend Components

#### **AI Voice Dialog** (`client/src/components/invoices/AIVoiceDialog.tsx`)
**Purpose**: Initiate AI voice calls with script selection
**Features**:
- 4 severity-based scripts (auto-recommended)
- Variable preview with real data
- Script customization
- Compliance disclosures
- Mobile-optimized (scrollable, fixed headers)

**Props**:
```typescript
interface AIVoiceDialogProps {
  invoice: Invoice;
  customer: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Usage**:
```tsx
<AIVoiceDialog
  invoice={selectedInvoice}
  customer={invoiceCustomer}
  open={showVoiceDialog}
  onOpenChange={setShowVoiceDialog}
/>
```

#### **Customer Overdue Dialog** (`client/src/components/workspace/CustomerOverdueDialog.tsx`)
**Purpose**: Show all overdue invoices for a customer
**Features**:
- Grouped invoice list
- Bulk actions (email, SMS, call)
- Payment plan creation
- Invoice hold/unhold
- Total outstanding calculation

---

## 10. Development Workflow

### Environment Setup

1. **Clone & Install**
```bash
git clone <repo-url>
cd qashivo
npm install
```

2. **Environment Variables**
Create `.env` file:
```bash
# Database
DATABASE_URL=postgresql://...

# Replit Auth
REPLIT_CLIENT_ID=...
REPLIT_CLIENT_SECRET=...

# Xero
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback

# SendGrid
SENDGRID_API_KEY=...

# Vonage
VONAGE_API_KEY=...
VONAGE_API_SECRET=...

# Retell AI
RETELL_API_KEY=...

# OpenAI
OPENAI_API_KEY=...

# Stripe (subscriptions)
STRIPE_SECRET_KEY=...
```

3. **Database Migrations**
```bash
# Push schema changes (NO manual SQL migrations)
npm run db:push

# Force push (if data loss warning)
npm run db:push --force

# Generate migration files (optional)
npm run db:generate
```

4. **Run Development Server**
```bash
npm run dev
# Backend: http://localhost:5000
# Frontend: Served by Vite at same port
```

### Code Conventions

#### **File Organization**
```
- Use TypeScript for all new files
- Frontend: Pascal case for components, camelCase for utilities
- Backend: camelCase for services, routes
- Shared types in `shared/schema.ts`
```

#### **Database Operations**
```typescript
// ✅ CORRECT: Use Drizzle ORM
await db.insert(invoices).values({...}).returning();

// ❌ WRONG: Raw SQL (except for complex queries)
await db.execute(sql`INSERT INTO invoices...`);

// ✅ Migrations: Use npm run db:push
// ❌ NO manual SQL migration files
```

#### **API Routes Pattern**
```typescript
// server/routes.ts
app.get('/api/resource', isAuthenticated, async (req: any, res) => {
  try {
    const user = await storage.getUser(req.user.claims.sub);
    if (!user?.tenantId) {
      return res.status(400).json({ message: "User not associated with tenant" });
    }
    
    // Tenant-scoped query
    const data = await storage.getResource(user.tenantId);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

#### **Frontend Data Fetching**
```typescript
// ✅ Use TanStack Query
const { data, isLoading } = useQuery<Type>({
  queryKey: ['/api/resource'],
});

// ✅ Mutations
const mutation = useMutation({
  mutationFn: (payload) => apiRequest('POST', '/api/resource', payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
  },
});

// ❌ Don't use fetch directly in components
```

### Testing Workflow

1. **Test Email**
```bash
curl http://localhost:5000/api/test/email
```

2. **Test SMS**
```bash
curl -X POST http://localhost:5000/api/test/sms \
  -H "Content-Type: application/json" \
  -d '{"to": "+44...", "message": "Test"}'
```

3. **Test Voice**
```bash
curl -X POST http://localhost:5000/api/test/voice \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+44..."}'
```

4. **Trigger Workflow**
- Use Action Centre "Test Mode"
- Enable Collections Automation in Settings
- Create test invoice with overdue date

### Debugging Tips

#### **Check Logs**
```bash
# Server logs
tail -f server.log

# Database queries (Drizzle debug)
export DEBUG=drizzle:*
npm run dev
```

#### **Inspect Webhooks**
- SendGrid: Check inbound parse logs
- Vonage: Check message status webhooks
- Retell: Check transcript delivery
- Use `ngrok` for local webhook testing

#### **Common Issues**

**Xero Token Expired**
```typescript
// Check token expiry
const tenant = await storage.getTenant(tenantId);
if (new Date() > new Date(tenant.xeroExpiresAt)) {
  await xeroProvider.refreshAccessToken(tenantId);
}
```

**Intent Analysis Not Triggering**
```sql
-- Check inbound messages
SELECT * FROM inbound_messages WHERE analyzed = false;

-- Check intent service logs
grep "Intent Analyst" server.log
```

**Actions Not Executing**
```sql
-- Check pending actions
SELECT * FROM actions WHERE status = 'pending' AND scheduled_for <= NOW();

-- Verify scheduler is running
grep "Collections scheduler" server.log
```

---

## 11. Recent Work & Current State

### Latest Developments (October 2025)

#### **Comms Tab Implementation** ✅
- 8-column communications table
- Pagination in same row as search (like invoices list)
- 3-line message preview with smaller font (text-xs)
- Tooltip on hover showing exact date/time (DD/MM/YYYY HH:MM:SS)
- Fixed inbound message display (was showing summary, now shows actual customer message from `metadata.originalMessage.content`)
- Direction icons: Teal (↓) for inbound, Grey (↑) for outbound
- Real-time 15-second auto-refresh
- Customer filter dropdown

#### **AI Voice Call System** ✅
- 4 script templates based on days overdue
- Auto-recommendation with visual badge
- Dynamic variable injection: {customer_name}, {invoice_number}, etc.
- Mobile-optimized dialog (max-h-85vh, scrollable)
- Compliance disclosures (identity verification, recording notice)
- Smart reset: Script selection resets per invoice
- Backend: `/api/invoices/:id/initiate-voice-call` endpoint
- Frontend: `AIVoiceDialog.tsx` component

#### **Intent Analyst Enhancements** ✅
- Date extraction: "end of month" → October 31
- Amount parsing: "£5,000", "$1,200.50"
- Promise tracking: Upcoming PTP vs Broken Promises
- Confidence-based auto-action (≥60%)
- Low-confidence flagging for manual review
- Full transcript storage in action metadata

#### **Database Optimizations** ✅
- Added indexes for server-side filtering
- Tenant-based query optimization
- Payment plan invoice linking
- AR overlay fields on contacts (separate from accounting data)

### Current System Status

**✅ Fully Functional**:
- Multi-channel communications (Email, SMS, WhatsApp, Voice)
- Xero integration with auto-sync
- Intent Analyst with entity extraction
- Action Centre workflow tabs
- Payment plan creation
- Collections automation scheduler
- Visual workflow builder
- Onboarding flow

**⚠️ In Progress**:
- AI response suggestions (currently only analyzes, doesn't suggest replies)
- Visual communication timeline on invoice pages
- Strategy assignment (customer segments)
- Team collaboration (multi-user workflows)
- Collection rate percentage metrics

**🔧 Known Technical Debt**:
- Some LSP diagnostics in `action-centre.tsx` (non-critical)
- SendGrid inbound parse requires DNS configuration per deployment
- Webhook verification signatures not fully implemented
- No retry queue for failed webhooks

---

## 12. Known Issues & Next Steps

### Known Issues

1. **LSP Diagnostics** (Low Priority)
   - File: `client/src/pages/action-centre.tsx`
   - 2 diagnostics present (likely type mismatches)
   - App runs fine, but should be cleaned up

2. **Webhook Security** (Medium Priority)
   - Add signature verification for all webhooks
   - Implement replay attack prevention
   - Rate limiting on webhook endpoints

3. **Error Handling** (Medium Priority)
   - Improve error messages for failed sync operations
   - Add user-facing error notifications
   - Implement graceful degradation for offline services

4. **Performance** (Low Priority)
   - Action Centre: Consider virtualization for large datasets
   - Invoice list: Implement infinite scroll vs pagination
   - Database: Add more indexes for complex queries

### Immediate Next Steps (Post-Demo)

1. **AI Response Suggestions** (High Priority)
   - Extend Intent Analyst to generate reply suggestions
   - "Insert Reply" button like Kolleno
   - Template-based responses with AI customization

2. **Visual Communication Timeline** (High Priority)
   - Add to invoice detail page
   - Show complete invoice lifecycle
   - Icons for different communication types

3. **Collection Metrics Dashboard** (Medium Priority)
   - Add % paid on-time, % paid late
   - Collection rate trends
   - Channel effectiveness analytics

4. **Team Features** (Medium Priority)
   - Account manager assignment
   - Task creation and assignment
   - Role-based permissions (already schema, needs UI)

5. **Strategy Templates** (Medium Priority)
   - Pre-built collection strategies
   - Industry-specific templates
   - A/B testing framework (schema exists)

### Long-Term Roadmap

**Q1 2026:**
- Predictive payment analytics (ML models exist, need UI)
- Customer segmentation automation
- Advanced reporting and exports

**Q2 2026:**
- Multi-currency support (schema ready)
- Additional accounting integrations (Sage, QuickBooks)
- Mobile app (React Native)

**Q3 2026:**
- Enterprise features (SSO, audit logs)
- White-label capabilities
- Partner/reseller program

### Competitive Priorities

Based on Kolleno analysis, focus on:
1. **Maintain AI Advantage**: Double down on Intent Analyst capabilities
2. **Adopt Best UX**: Visual timelines, AI response suggestions
3. **Add Team Features**: Account manager assignment, strategies
4. **Enhance Metrics**: Collection rates, percentage-based KPIs

---

## Quick Reference

### Important Files
```
# Core Application
server/index.ts               # Express server entry
server/routes.ts              # All API routes
server/storage.ts             # Data access layer
shared/schema.ts              # Database schema

# Services
server/services/intentAnalyst.ts        # AI intent analysis
server/services/collectionsScheduler.ts # Automation scheduler
server/services/xeroSync.ts             # Xero integration
server/services/sendgrid.ts             # Email service
server/services/vonage.ts               # SMS/WhatsApp

# Frontend
client/src/App.tsx            # Route definitions
client/src/pages/action-centre.tsx  # Main workspace
client/src/pages/invoices.tsx       # Invoice management
client/src/lib/queryClient.ts       # TanStack Query setup

# Configuration
.env                          # Environment variables
drizzle.config.ts            # Database config
vite.config.ts               # Build config
```

### Useful Commands
```bash
# Development
npm run dev                   # Start dev server
npm run db:push              # Update database schema
npm run db:studio            # Open Drizzle Studio (DB GUI)

# Testing
curl http://localhost:5000/api/test/email
curl http://localhost:5000/api/test/sms
curl http://localhost:5000/api/test/voice

# Database
npm run db:push              # Push schema changes
npm run db:push --force      # Force push (data loss)
npm run db:generate          # Generate migration

# Documentation
tsx scripts/sync-docs.ts     # Sync documentation with code
```

### Key Contacts & Resources
- **Replit Docs**: https://docs.replit.com
- **Xero API**: https://developer.xero.com
- **SendGrid**: https://docs.sendgrid.com
- **Vonage**: https://developer.vonage.com
- **Retell AI**: https://docs.retellai.com
- **Drizzle ORM**: https://orm.drizzle.team

---

## Final Notes

This application is **production-ready for the investor demo**. The core AI-powered collections workflow is fully functional, with robust multi-channel communication and intelligent intent analysis.

The codebase follows modern best practices with TypeScript, strong typing, and clear separation of concerns. The multi-tenant architecture ensures scalability, and the AI features provide a significant competitive advantage.

**Key Strengths**:
- Intent Analyst AI (unique vs competitors)
- Multi-channel automation (email, SMS, WhatsApp, voice)
- Real-time Action Centre with smart categorization
- Robust Xero integration with auto-sync
- Clean, maintainable codebase

**Areas for Growth**:
- AI response suggestions
- Visual communication timeline
- Team collaboration features
- Advanced analytics and reporting

Welcome aboard! The foundation is solid, and there's exciting work ahead to build on this platform.

---

*Last Updated: October 11, 2025*
*Prepared for: New Full-Stack Developer*
*Project Status: Investor MVP - Demo Ready*
