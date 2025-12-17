# Qashivo Service Architecture

## Overview

Qashivo uses a two-phase collections pipeline where services work together to plan, approve, execute, and learn from collection activities. The architecture follows a "supervised autonomy" model where AI generates plans overnight, users approve them daily, and AI executes throughout the day.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QASHIVO SERVICE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │   Data Sources   │    │  Planning Phase  │    │ Execution Phase  │      │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘      │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        STORAGE LAYER (PostgreSQL)                    │   │
│  │  invoices | contacts | actions | promisesToPay | inboundMessages    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Categories

### 1. Data Integration Services

| Service | File | Purpose |
|---------|------|---------|
| **Xero Service** | `xero.ts` | OAuth integration with Xero accounting software |
| **Xero Sync** | `xeroSync.ts` | Syncs invoices, contacts, payments from Xero |
| **Xero Health Check** | `xeroHealthCheck.ts` | Monitors and refreshes Xero OAuth tokens |
| **Xero Onboarding** | `xeroOnboardingService.ts` | Handles 60-second Xero connection flow |
| **Sync Scheduler** | `syncScheduler.ts` | Schedules periodic syncs (hourly API, 4-hourly Xero) |

**Data Flow:**
```
Xero API → xeroSync.ts → storage (invoices, contacts) → syncScheduler.ts (cron)
```

---

### 2. Collection Planning Services

| Service | File | Purpose |
|---------|------|---------|
| **Collections Automation** | `collectionsAutomation.ts` | Scans overdue invoices, matches to schedules |
| **Action Planner** | `actionPlanner.ts` | Phase 1: Creates scheduled actions in queue |
| **Daily Plan Generator** | `dailyPlanGenerator.ts` | Generates tomorrow's plan for user approval |
| **Charlie Decision Engine** | `charlieDecisionEngine.ts` | AI decision-making for action selection |
| **Portfolio Controller** | `portfolioController.ts` | Adjusts urgency based on DSO targets |

**Data Flow:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                     PLANNING PIPELINE (Nightly)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  portfolioController ──► collectionsAutomation ──► actionPlanner    │
│         │                        │                      │            │
│    Adjusts DSO            Scans invoices          Creates actions   │
│    urgency factor         vs schedules            (pending_approval) │
│                                  │                      │            │
│                                  ▼                      ▼            │
│                          dailyPlanGenerator ◄───────────┘            │
│                                  │                                   │
│                          Generates daily plan                        │
│                          for user approval                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3. Action Execution Services

| Service | File | Purpose |
|---------|------|---------|
| **Action Executor** | `actionExecutor.ts` | Phase 2: Executes approved scheduled actions |
| **Communications Orchestrator** | `communicationsOrchestrator.ts` | Unified send interface with pre-send checks |
| **AI Message Generator** | `aiMessageGenerator.ts` | Generates personalized message content |
| **Message Pre-Generator** | `messagePreGenerator.ts` | Pre-generates messages for approval preview |
| **Playbook Engine** | `playbookEngine.ts` | Manages tone profiles and escalation stages |
| **Charlie Playbook** | `charliePlaybook.ts` | Charlie's collection conversation strategies |

**Data Flow:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    EXECUTION PIPELINE (Continuous)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Approves Plan                                                  │
│         │                                                            │
│         ▼                                                            │
│  actionExecutor.ts (every 10 min via collectionsScheduler)          │
│         │                                                            │
│         ├── aiMessageGenerator.ts (generates content)                │
│         ├── messagePreGenerator.ts (pre-generates drafts)           │
│         └── messagePostProcessor.ts (ensures HTML format)            │
│         │                                                            │
│         ▼                                                            │
│  communicationsOrchestrator.ts                                       │
│         │                                                            │
│         ├── runPreSendChecks():                                      │
│         │   ├── checkBusinessHours (9am-6pm)                         │
│         │   ├── checkDailyLimits (per channel)                       │
│         │   ├── checkCooldown (contact frequency)                    │
│         │   ├── checkVulnerability (pauseManager)                    │
│         │   ├── checkDispute (pauseManager)                          │
│         │   └── checkLegalHold                                       │
│         │                                                            │
│         ├── Email Adapter ──► sendgrid.ts                            │
│         ├── SMS Adapter ──► vonage.ts                                │
│         └── Voice Adapter ──► retell-service.ts                      │
│                                                                      │
│         ▼                                                            │
│  logOutboundMessage() → storage                                      │
│  websocketService.broadcastActionCompleted()                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Communication Channel Services

| Service | File | Purpose |
|---------|------|---------|
| **SendGrid** | `sendgrid.ts` | Email delivery via SendGrid API |
| **Email Service** | `email/EmailService.ts` | Email service abstraction |
| **SendGrid Email Service** | `email/SendGridEmailService.ts` | SendGrid implementation |
| **Vonage** | `vonage.ts` | SMS and WhatsApp via Vonage API |
| **Retell Service** | `../retell-service.ts` | AI voice calls via Retell API |

---

### 5. Inbound Communication & Intent Services

| Service | File | Purpose |
|---------|------|---------|
| **Intent Analyst** | `intentAnalyst.ts` | AI analysis of inbound messages (OpenAI) |
| **Webhook Handler** | `webhookHandler.ts` | Processes inbound webhooks |

**Intent Types Detected:**
- `payment_plan` - Customer wants payment plan
- `dispute` - Customer disputes invoice
- `promise_to_pay` - Customer commits to pay date
- `payment_confirmation` - Customer confirms payment made
- `vulnerability` - Hardship/vulnerability detected (flags for human review)
- `callback_request` - Customer wants phone callback
- `admin_issue` - Missing PO, wrong address, etc.
- `general_query` - General questions

**Data Flow:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                     INBOUND PROCESSING PIPELINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Email/SMS/Voice Webhook                                             │
│         │                                                            │
│         ▼                                                            │
│  webhookHandler.ts                                                   │
│         │                                                            │
│         ▼                                                            │
│  intentAnalyst.ts (OpenAI analysis)                                  │
│         │                                                            │
│         ├──► promise_to_pay ──► Create PTP record + pause schedule   │
│         ├──► dispute ──► Create exception for human review           │
│         ├──► vulnerability ──► Flag for human review                 │
│         ├──► payment_confirmation ──► Log + verify                   │
│         └──► callback_request ──► Schedule callback action           │
│                                                                      │
│         ▼                                                            │
│  promiseReliabilityService.ts (tracks PTP reliability)               │
│  pauseManager.ts (pauses automation for contact)                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 6. Monitoring & Detection Services

| Service | File | Purpose |
|---------|------|---------|
| **PTP Breach Detector** | `ptpBreachDetector.ts` | Detects broken payment promises |
| **Promise Reliability** | `promiseReliabilityService.ts` | Tracks customer PTP reliability score |
| **Collections Scheduler** | `collectionsScheduler.ts` | Manages automation job scheduling |
| **Pause Manager** | `lib/pause-manager.ts` | Controls invoice pause states (dispute, PTP, payment plan) |

**Pause Manager Integration:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAUSE MANAGER                                │
├─────────────────────────────────────────────────────────────────────┤
│  Controls invoice pause overlays that suspend automation:           │
│                                                                      │
│  pauseState: null | dispute | ptp | payment_plan                    │
│                                                                      │
│  When paused:                                                        │
│  • Adaptive scheduler skips invoice                                  │
│  • Communication automation suspended                                │
│  • Timer-based exceptions still tracked                              │
│                                                                      │
│  Triggers:                                                           │
│  • intentAnalyst → dispute detected → pauseManager.pause(dispute)   │
│  • intentAnalyst → PTP detected → pauseManager.pause(ptp)           │
│  • ptpBreachDetector → breach detected → pauseManager.resume()      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**PTP Breach Detection Flow:**
```
PTP Breach Detector (hourly check)
        │
        ├──► Promise date passed?
        ├──► Invoice still unpaid?
        └──► Promise status = 'active'?
                │
                ▼
        Updates promise status to 'breached'
        Creates follow-up action for collector
        Updates customer reliability score
        Calls pauseManager.resumeInvoice()
```

---

### 7. Scoring & Analytics Services

| Service | File | Purpose |
|---------|------|---------|
| **Credit Scoring Service** | `creditScoringService.ts` | Customer credit risk scoring |
| **Action Prioritization** | `actionPrioritizationService.ts` | Prioritizes actions by value/risk |
| **Customer Segmentation** | `customerSegmentationService.ts` | Segments customers by behavior |
| **Dynamic Risk Scoring** | `dynamicRiskScoringService.ts` | Real-time risk score updates |
| **Collection Learning** | `collectionLearningService.ts` | Learns from collection outcomes |
| **Metrics Service** | `metricsService.ts` | Dashboard metrics calculation |
| **Business Analytics** | `businessAnalytics.ts` | Business intelligence queries |
| **ARD Calculation** | `ardCalculationService.ts` | Average Receivables Days calculation |
| **Invoice Health Analyzer** | `invoiceHealthAnalyzer.ts` | Analyzes invoice payment probability |

---

### 8. Support Services

| Service | File | Purpose |
|---------|------|---------|
| **Websocket Service** | `websocketService.ts` | Real-time updates to dashboard |
| **Permission Service** | `permissionService.ts` | RBAC permission checks |
| **Subscription Service** | `subscriptionService.ts` | Stripe subscription management |
| **Onboarding Service** | `onboardingService.ts` | User onboarding wizard |
| **Demo Data Service** | `demoDataService.ts` | Demo mode data generation |
| **Demo Mode Service** | `demoModeService.ts` | Demo mode management |
| **Job Queue** | `jobQueue.ts` | Background job processing |
| **OpenAI** | `openai.ts` | OpenAI API client wrapper |
| **Interest Calculator** | `interest-calculator.ts` | Late payment interest calculation |
| **Invoice PDF** | `invoicePDF.ts` | PDF generation for invoices |
| **Message Post-Processor** | `messagePostProcessor.ts` | Ensures HTML formatting in AI messages |
| **Agent Manager** | `agentManager.ts` | Manages Retell AI agents |
| **Workflow Seeder** | `workflowSeeder.ts` | Seeds default workflow configurations |
| **Default Workflow Setup** | `defaultWorkflowSetup.ts` | Sets up default collection workflows |

---

## Key Integration Points

### 1. Actions Table (Central Queue)

The `actions` table is the central coordination point:

```
Status Flow:
pending_approval → scheduled (after user approval) → executing → completed/failed
                                                   ↘ exception (needs review)
```

### 2. Pause Manager

`lib/pause-manager.ts` controls automation pauses:
- Pauses when PTP is received
- Pauses when dispute is raised
- Pauses when vulnerability detected
- Unpauses when breach detected

### 3. Scheduler Constraints

`lib/adaptive-scheduler.ts` enforces:
- Business hours (9am-6pm)
- Daily limits per channel
- Cooldown between contacts
- Urgency factor adjustments

---

## Startup Initialization Order

From `server/index.ts` (conditional on `NODE_ENV !== 'test'`):

1. Express middleware setup
2. API routes registration
3. Session store (PostgreSQL)
4. Dashboard WebSocket service
5. API middleware system (Xero, SendGrid, Retell providers)
6. Collections scheduler (`collectionsScheduler.ts` - starts planner/executor intervals)
7. Xero sync scheduler (`syncScheduler.ts`)
8. Xero health check service (`xeroHealthCheck.ts` - every 20 min)
9. PTP breach detector (`ptpBreachDetector.ts` - every 60 min)
10. Workflow timer processor (`jobs/workflow-timer-processor.ts` - every 15 min)
11. Portfolio controller cron jobs (via `node-cron`):
    - 2am nightly: `runNightly()` urgency recomputation
    - Every 6 hours: `planAdaptiveActions()` for adaptive workflows
12. Object Storage video streaming
13. Vite dev server (development only)

---

## Scheduled Jobs

### Interval-Based Timers (setInterval)

| Job | Frequency | Service | Source |
|-----|-----------|---------|--------|
| Action Planner | Every 60 minutes | actionPlanner.ts | collectionsScheduler.ts |
| Action Executor | Every 10 minutes | actionExecutor.ts | collectionsScheduler.ts |
| PTP Breach Detection | Every 60 minutes | ptpBreachDetector.ts | ptpBreachDetector.ts |
| Workflow Timer Processing | Every 15 minutes | workflow-timer-processor.ts | server/jobs/ |
| API Syncs | Hourly | syncService.ts | syncScheduler.ts |
| Xero Background Syncs | Every 4 hours | xeroSync.ts | syncScheduler.ts |
| Xero Health Checks | Every 20 minutes | xeroHealthCheck.ts | xeroHealthCheck.ts |

### Cron Jobs (node-cron)

| Job | Schedule | Service | Source |
|-----|----------|---------|--------|
| Portfolio Urgency Recompute | 2am daily (`0 2 * * *`) | portfolioController.runNightly() | server/index.ts |
| Adaptive Action Planning | Every 6 hours (`0 */6 * * *`) | actionPlanner.planAdaptiveActions() | server/index.ts |

Note: The 6-hour adaptive planning job calls `planAdaptiveActions()` for all active adaptive workflows, not `dailyPlanGenerator`.

---

## Complete Automation Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        QASHIVO COMPLETE AUTOMATION LOOP                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      OUTBOUND FLOW (Nightly → Daily)                │    │
│  │                                                                      │    │
│  │  portfolioController ──► collectionsAutomation ──► actionPlanner   │    │
│  │          │                        │                      │          │    │
│  │    (2am nightly)           (scans invoices)      (creates actions)  │    │
│  │                                   │                      │          │    │
│  │                                   ▼                      ▼          │    │
│  │                           dailyPlanGenerator ◄───────────┘          │    │
│  │                                   │                                  │    │
│  │                           (generates plan)                          │    │
│  │                                   │                                  │    │
│  │                                   ▼                                  │    │
│  │                           USER APPROVAL                              │    │
│  │                                   │                                  │    │
│  │                                   ▼                                  │    │
│  │              actionExecutor (every 10 min via collectionsScheduler)  │    │
│  │                     │                                                │    │
│  │                     ├── aiMessageGenerator (generates content)       │    │
│  │                     ├── messagePreGenerator (pre-generates drafts)   │    │
│  │                     └── messagePostProcessor (ensures HTML format)   │    │
│  │                                                                      │    │
│  │                     ▼                                                │    │
│  │           communicationsOrchestrator                                 │    │
│  │           ├── runPreSendChecks():                                   │    │
│  │           │   ├── checkBusinessHours (9am-6pm)                      │    │
│  │           │   ├── checkDailyLimits (per channel)                    │    │
│  │           │   ├── checkCooldown (contact frequency)                 │    │
│  │           │   ├── checkVulnerability (pauseManager)                 │    │
│  │           │   ├── checkDispute (pauseManager)                       │    │
│  │           │   └── checkLegalHold                                    │    │
│  │           ├── Email → sendgrid.ts                                   │    │
│  │           ├── SMS → vonage.ts                                       │    │
│  │           └── Voice → retell-service.ts                             │    │
│  │                     │                                                │    │
│  │                     ▼                                                │    │
│  │           websocketService.broadcastActionCompleted()               │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       INBOUND FLOW (Real-time)                      │    │
│  │                                                                      │    │
│  │  Retell Webhook / SendGrid Inbound / Vonage Inbound                │    │
│  │                          │                                           │    │
│  │                          ▼                                           │    │
│  │                   webhookHandler.ts                                  │    │
│  │                          │                                           │    │
│  │                          ▼                                           │    │
│  │                   intentAnalyst.ts (OpenAI)                          │    │
│  │                          │                                           │    │
│  │    ┌─────────────────────┼─────────────────────┐                    │    │
│  │    │                     │                     │                    │    │
│  │    ▼                     ▼                     ▼                    │    │
│  │  PTP Detected      Dispute Detected     Vulnerability               │    │
│  │    │                     │                     │                    │    │
│  │    ▼                     ▼                     ▼                    │    │
│  │  pauseManager       pauseManager         FLAG FOR                   │    │
│  │  .pause(ptp)        .pause(dispute)     HUMAN REVIEW                │    │
│  │    │                     │                     │                    │    │
│  │    ▼                     ▼                     │                    │    │
│  │  promiseReliability  Create exception         │                    │    │
│  │  Service.recordPTP   for review               │                    │    │
│  │                                                │                    │    │
│  └───────────────────────────┬────────────────────┘                    │    │
│                              │                                          │    │
│                              ▼                                          │    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    MONITORING (Continuous)                          │    │
│  │                                                                      │    │
│  │  ptpBreachDetector (hourly)                                         │    │
│  │         │                                                            │    │
│  │         ├── Checks promisesToPay table                              │    │
│  │         ├── Detects breaches (date passed + unpaid)                 │    │
│  │         ├── Updates promise status to 'breached'                    │    │
│  │         ├── Calls pauseManager.resumeInvoice()                      │    │
│  │         ├── promiseReliabilityService.recordBreach()                │    │
│  │         └── Creates follow-up action                                │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Missing: Communication Outcome Processor

Currently there is no unified service to:
1. Process outcomes from all channels (voice call results, email replies, SMS responses)
2. Determine next actions based on outcomes
3. Create follow-up actions automatically
4. Update contact engagement scores

This is the planned `CommunicationOutcomeProcessor` service that would:
- Receive outcomes from Retell webhooks (call disposition, PTP, disputes)
- Receive analyzed intents from Intent Analyst
- Create appropriate follow-up actions
- Update contact records with engagement data
- Trigger escalation or de-escalation based on outcomes
