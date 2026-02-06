# Qashivo Replit Optimization Plan
## Immediate Actions to Improve Performance & Reduce Complexity

---

## Executive Summary

**Current State:** 119 database tables, 50+ service files, overlapping functionality, N+1 query problems
**Target State:** 58 core tables, 25 essential services, optimized queries, clear architecture
**Expected Impact:** 50% faster API responses, 70% reduction in database load, 40% smaller codebase

---

## PART 1: Database Cleanup (CRITICAL - Do First)

### Tables to KEEP (58 tables)

```sql
-- Multi-tenant hierarchy (6)
users, partners, smeClients, partnerClientRelationships, tenants, sessions

-- Access control (5)
roles, permissions, rolePermissions, userPermissions, userRoles

-- Credit control core (8)
contacts, invoices, actions, outcomes, attentionItems, 
inboundMessages, conversations, emailMessages

-- Workflows (4)
workflows, workflowNodes, workflowConnections, workflowTemplates

-- Forecasting (3)
forecastSnapshots, forecastPoints, forecastVarianceTracking

-- Payment tracking (2)
bankTransactions, payment_events (add this new)

-- Integrations (5)
integrationEvents, xeroConnections, retellAgents, retellCalls, vonageMessages

-- Audit & activity (4)
activityLogs, auditEvents, systemEvents, errorLogs

-- Settings & config (6)
tenantSettings, partnerSettings, communicationTemplates, 
messageTemplates, workflowTemplateLibrary, playbookStages

-- Notifications (3)
notifications, notificationPreferences, emailQueue

-- Billing (5)
subscriptionPlans, subscriptions, invoicePayments, usageMetrics, billingEvents

-- Misc essential (7)
countries, currencies, industries, tags, comments, attachments, apiKeys
```

### Tables to DELETE (61 tables)

#### Migration Script (Run This First)

```sql
-- STEP 1: Backup everything
pg_dump qashivo_db > backup_before_cleanup.sql

-- STEP 2: Migrate legacy outcomes to unified table
INSERT INTO outcomes (
  "tenantId", "debtorId", "invoiceId", type, confidence, 
  "confidenceBand", "requiresHumanReview", extracted, 
  "sourceChannel", "createdAt"
)
SELECT 
  do."tenantId",
  do."contactId" as "debtorId",
  do."invoiceId",
  CASE 
    WHEN do."outcomeType" = 'PROMISE_TO_PAY' THEN 'promise_to_pay'
    WHEN do."outcomeType" = 'PAYMENT_PLAN' THEN 'payment_plan'
    WHEN do."outcomeType" = 'DISPUTE' THEN 'dispute'
    WHEN do."outcomeType" = 'VULNERABILITY' THEN 'vulnerability'
    ELSE 'general_query'
  END as type,
  COALESCE(do.confidence, 70) as confidence,
  CASE 
    WHEN COALESCE(do.confidence, 70) >= 80 THEN 'high'
    WHEN COALESCE(do.confidence, 70) >= 50 THEN 'medium'
    ELSE 'low'
  END as "confidenceBand",
  COALESCE(do."requiresHumanReview", false) as "requiresHumanReview",
  jsonb_build_object(
    'promise_to_pay_date', ptp."promisedPaymentDate",
    'promise_to_pay_amount', ptp."promisedAmount",
    'confirmed_by', ptp."confirmedBy",
    'conditions', ptp.conditions
  ) as extracted,
  COALESCE(do."sourceChannel", 'unknown') as "sourceChannel",
  do."detectedAt" as "createdAt"
FROM "detectedOutcomes" do
LEFT JOIN "promisesToPay" ptp ON ptp."detectedOutcomeId" = do.id
WHERE NOT EXISTS (
  SELECT 1 FROM outcomes o 
  WHERE o."invoiceId" = do."invoiceId" 
  AND o."createdAt" = do."detectedAt"
);

-- STEP 3: Verify migration
SELECT 
  (SELECT COUNT(*) FROM "detectedOutcomes") as old_count,
  (SELECT COUNT(*) FROM outcomes) as new_count;
-- These should match or new_count should be higher

-- STEP 4: Drop legacy outcome tables
DROP TABLE IF EXISTS "contactOutcomes" CASCADE;
DROP TABLE IF EXISTS "promisesToPay" CASCADE;
DROP TABLE IF EXISTS "paymentPromises" CASCADE;
DROP TABLE IF EXISTS "detectedOutcomes" CASCADE;
DROP TABLE IF EXISTS "outcomesHistory" CASCADE;

-- STEP 5: Drop unused communication tables
DROP TABLE IF EXISTS "smsMessages" CASCADE;
DROP TABLE IF EXISTS "whatsappMessages" CASCADE;
DROP TABLE IF EXISTS "callRecords" CASCADE;
DROP TABLE IF EXISTS "voicemails" CASCADE;
DROP TABLE IF EXISTS "messageDrafts" CASCADE;

-- STEP 6: Drop unused features
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS "reportTemplates" CASCADE;
DROP TABLE IF EXISTS "reportSchedules" CASCADE;
DROP TABLE IF EXISTS dashboards CASCADE;
DROP TABLE IF EXISTS "dashboardWidgets" CASCADE;
DROP TABLE IF EXISTS "customFields" CASCADE;
DROP TABLE IF EXISTS "customFieldValues" CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS "webhookDeliveries" CASCADE;
DROP TABLE IF EXISTS "backgroundJobs" CASCADE;
DROP TABLE IF EXISTS "jobSchedules" CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS "campaignTargets" CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS "segmentRules" CASCADE;
DROP TABLE IF EXISTS "automationRules" CASCADE;
DROP TABLE IF EXISTS "automationTriggers" CASCADE;
DROP TABLE IF EXISTS "scoringRules" CASCADE;
DROP TABLE IF EXISTS "creditScores" CASCADE;
DROP TABLE IF EXISTS "paymentPlans" CASCADE;
DROP TABLE IF EXISTS "paymentPlanInstallments" CASCADE;
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS "disputeResolutions" CASCADE;
DROP TABLE IF EXISTS escalations CASCADE;
DROP TABLE IF EXISTS "legalActions" CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS "collectionAgencies" CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS "writeOffs" CASCADE;
DROP TABLE IF EXISTS adjustments CASCADE;
DROP TABLE IF EXISTS credits CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS chargebacks CASCADE;

-- STEP 7: Drop over-normalized tables
DROP TABLE IF EXISTS "contactAddresses" CASCADE;
DROP TABLE IF EXISTS "contactEmails" CASCADE;
DROP TABLE IF EXISTS "contactPhones" CASCADE;
DROP TABLE IF EXISTS "contactNotes" CASCADE;
DROP TABLE IF EXISTS "invoiceLineItems" CASCADE;
DROP TABLE IF EXISTS "invoiceNotes" CASCADE;
DROP TABLE IF EXISTS "invoiceAttachments" CASCADE;
DROP TABLE IF EXISTS "actionAttachments" CASCADE;

-- STEP 8: Drop unused integrations
DROP TABLE IF EXISTS "quickBooksConnections" CASCADE;
DROP TABLE IF EXISTS "sageConnections" CASCADE;
DROP TABLE IF EXISTS "stripePayments" CASCADE;
DROP TABLE IF EXISTS "paypalPayments" CASCADE;
DROP TABLE IF EXISTS "goCardlessPayments" CASCADE;
DROP TABLE IF EXISTS "openBankingConnections" CASCADE;

-- STEP 9: Drop duplicate audit tables
DROP TABLE IF EXISTS "changeHistory" CASCADE;
DROP TABLE IF EXISTS "dataChanges" CASCADE;
DROP TABLE IF EXISTS "permissionAuditLog" CASCADE;
DROP TABLE IF EXISTS "partnerAuditLog" CASCADE;
DROP TABLE IF EXISTS "loginHistory" CASCADE;
DROP TABLE IF EXISTS "apiAuditLog" CASCADE;

-- STEP 10: Add critical indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_tenant_status" 
  ON invoices("tenantId", status) 
  WHERE status IN ('pending', 'overdue');

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_due_date" 
  ON invoices("dueDate") 
  WHERE status IN ('pending', 'overdue');

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_actions_tenant_status" 
  ON actions("tenantId", status) 
  WHERE status IN ('pending_approval', 'scheduled');

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_actions_scheduled" 
  ON actions("scheduledFor") 
  WHERE status = 'scheduled';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outcomes_invoice_date" 
  ON outcomes("invoiceId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_attention_items_status" 
  ON "attentionItems"("tenantId", status) 
  WHERE status = 'pending';

-- JSONB indexes for fast metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_actions_metadata_gin" 
  ON actions USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outcomes_extracted_gin" 
  ON outcomes USING GIN (extracted);

-- Foreign key indexes (often forgotten!)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_contact" 
  ON invoices("contactId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_actions_invoice" 
  ON actions("invoiceId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_outcomes_debtor" 
  ON outcomes("debtorId");

-- STEP 11: Verify table count
SELECT COUNT(*) as remaining_tables 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Should be around 58
```

---

## PART 2: Code Cleanup

### Services to DELETE

```bash
# Navigate to server/services
cd server/services

# DELETE these files (backup first!)
rm -f reportGenerator.ts
rm -f campaignManager.ts
rm -f segmentBuilder.ts
rm -f creditScoring.ts
rm -f paymentPlanManager.ts
rm -f disputeManager.ts
rm -f escalationManager.ts
rm -f legalActions.ts
rm -f settlementManager.ts
rm -f writeOffManager.ts
rm -f chargebackHandler.ts

# DELETE duplicate intent analyst files
rm -f intent-analyst.ts
rm -f intentAnalysis.ts
rm -f outcomeDetector.ts
rm -f outcome-detector.ts
rm -f promiseTracker.ts

# DELETE unused notification services
rm -f pushNotificationService.ts
rm -f slackNotificationService.ts
rm -f teamsNotificationService.ts
```

### Services to KEEP & ENHANCE

```
server/services/
├── core/
│   ├── intentAnalyst.ts          ✅ KEEP - Core AI functionality
│   ├── outcomesService.ts        ✅ KEEP - Update to use unified outcomes
│   ├── actionsService.ts         ✅ KEEP
│   └── attentionService.ts       ✅ KEEP
│
├── communication/
│   ├── emailService.ts           ✅ KEEP
│   ├── smsService.ts             ✅ KEEP
│   ├── retellService.ts          ✅ KEEP
│   └── messageGenerator.ts       ✅ KEEP (rename aiMessageGenerator.ts)
│
├── integrations/
│   ├── xeroService.ts            ✅ KEEP
│   ├── trueLayerService.ts       ✅ ADD NEW
│   └── vonageService.ts          ✅ KEEP
│
├── workflow/
│   ├── collectionsScheduler.ts   ✅ KEEP
│   ├── workflowEngine.ts         ✅ KEEP
│   └── workflowSeeder.ts         ✅ KEEP
│
└── analytics/
    ├── forecastService.ts        ✅ KEEP & ENHANCE
    ├── riskAssessment.ts         ✅ KEEP & ENHANCE
    └── dashboardService.ts       ✅ KEEP (rename dashboardCashInflowService.ts)
```

### Fix N+1 Query Problems

**BEFORE (Bad - Multiple queries):**
```typescript
// ❌ DON'T DO THIS
async function getInvoicesWithData(tenantId: string) {
  const invoices = await db.query.invoices.findMany({
    where: eq(invoices.tenantId, tenantId)
  });
  
  for (const invoice of invoices) {
    // N+1 problem: This runs once per invoice!
    invoice.contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, invoice.contactId)
    });
    
    invoice.outcomes = await db.query.outcomes.findMany({
      where: eq(outcomes.invoiceId, invoice.id)
    });
    
    invoice.actions = await db.query.actions.findMany({
      where: eq(actions.invoiceId, invoice.id)
    });
  }
  
  return invoices;
}
```

**AFTER (Good - Single query with joins):**
```typescript
// ✅ DO THIS INSTEAD
async function getInvoicesWithData(tenantId: string) {
  return await db.query.invoices.findMany({
    where: eq(invoices.tenantId, tenantId),
    with: {
      contact: true,  // Automatic join
      outcomes: {
        orderBy: desc(outcomes.createdAt),
        limit: 1  // Just the latest
      },
      actions: {
        where: inArray(actions.status, ['pending_approval', 'scheduled']),
        orderBy: desc(actions.createdAt)
      }
    }
  });
}
// This is ONE query with JOINs!
```

### API Routes Consolidation

**DELETE these duplicate routes:**
```bash
cd server/api

# Remove duplicate outcome routes
rm -f detected-outcomes.ts
rm -f promises.ts
rm -f payment-plans.ts
rm -f disputes.ts
rm -f escalations.ts

# Remove unused feature routes
rm -f reports.ts
rm -f campaigns.ts
rm -f segments.ts
rm -f scoring.ts
rm -f legal-actions.ts
rm -f settlements.ts
rm -f write-offs.ts
```

**KEEP these 10 core route files:**
```
server/api/
├── tenants.ts          # Tenant CRUD, settings
├── contacts.ts         # Contact/debtor management
├── invoices.ts         # Invoice management
├── actions.ts          # Action approval, execution
├── outcomes.ts         # Unified outcomes (all types)
├── attention.ts        # Attention items
├── workflows.ts        # Workflow builder
├── forecast.ts         # Cash flow forecasting
├── integrations.ts     # Xero, TrueLayer, Retell webhooks
└── admin.ts            # Partner management, billing
```

---

## PART 3: Background Jobs Optimization

### Replace Cron with BullMQ

**Install BullMQ:**
```bash
npm install bullmq ioredis
```

**Setup Redis connection:**
```typescript
// server/jobs/redis.ts
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});
```

**Create job queues:**
```typescript
// server/jobs/queues.ts
import { Queue } from 'bullmq';
import { redis } from './redis';

export const syncQueue = new Queue('sync', { connection: redis });
export const collectionsQueue = new Queue('collections', { connection: redis });
export const analysisQueue = new Queue('analysis', { connection: redis });
```

**Create workers:**
```typescript
// server/jobs/workers.ts
import { Worker } from 'bullmq';
import { redis } from './redis';
import { collectionsScheduler } from '../services/workflow/collectionsScheduler';
import { forecastService } from '../services/analytics/forecastService';
import { xeroService } from '../services/integrations/xeroService';

// Collections worker
new Worker('collections', async (job) => {
  switch (job.name) {
    case 'daily-plan':
      await collectionsScheduler.planActionsForTenant(job.data.tenantId);
      break;
    case 'execute-actions':
      await collectionsScheduler.executeActions();
      break;
  }
}, { 
  connection: redis,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000 // Max 10 jobs per second
  }
});

// Sync worker
new Worker('sync', async (job) => {
  if (job.name === 'sync-xero') {
    await xeroService.syncTenantData(job.data.tenantId);
  }
}, { connection: redis, concurrency: 3 });

// Analysis worker
new Worker('analysis', async (job) => {
  if (job.name === 'generate-forecast') {
    await forecastService.generateForecast(job.data.tenantId);
  }
}, { connection: redis, concurrency: 2 });
```

**Schedule recurring jobs:**
```typescript
// server/jobs/scheduler.ts
import { syncQueue, collectionsQueue, analysisQueue } from './queues';

export async function scheduleJobsForTenant(tenantId: string) {
  // Xero sync every 4 hours
  await syncQueue.add(
    'sync-xero',
    { tenantId },
    { 
      repeat: { pattern: '0 */4 * * *' },
      jobId: `sync-xero-${tenantId}` // Prevent duplicates
    }
  );
  
  // Daily collections plan at 6am
  await collectionsQueue.add(
    'daily-plan',
    { tenantId },
    { repeat: { pattern: '0 6 * * *' } }
  );
  
  // Forecast generation at 7am
  await analysisQueue.add(
    'generate-forecast',
    { tenantId },
    { repeat: { pattern: '0 7 * * *' } }
  );
}

// Execute actions every 10 minutes (global job)
await collectionsQueue.add(
  'execute-actions',
  {},
  { repeat: { pattern: '*/10 * * * *' } }
);
```

**DELETE old cron jobs:**
```bash
# Remove these files
rm -f server/cron/syncInvoices.ts
rm -f server/cron/syncPayments.ts
rm -f server/cron/generatePlans.ts
rm -f server/cron/executeActions.ts
rm -f server/cron/updateForecasts.ts
```

---

## PART 4: Frontend Optimization

### Bundle Size Reduction

**Update vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select'
          ],
          'chart-vendor': ['recharts'],
          'form-vendor': ['react-hook-form', 'zod'],
          'query-vendor': ['@tanstack/react-query']
        }
      }
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false // Disable in production
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query']
  }
});
```

### Lazy Loading Routes

**Update App.tsx:**
```typescript
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Workflows = lazy(() => import('./pages/Workflows'));
const Forecast = lazy(() => import('./pages/Forecast'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### Remove Unused Dependencies

**Check and remove:**
```bash
npm uninstall \
  moment \
  lodash \
  axios \
  redux \
  redux-saga \
  @reduxjs/toolkit \
  chart.js \
  d3 \
  any-other-unused-packages
```

**Use smaller alternatives:**
```bash
# Instead of moment (59KB) use date-fns (13KB)
npm install date-fns

# Instead of lodash (71KB) use lodash-es (24KB) or built-in JS
npm install lodash-es

# Instead of axios (13KB) use native fetch
# (no install needed, it's built-in)
```

---

## PART 5: Performance Monitoring

### Add Memory Monitoring

```typescript
// server/monitoring.ts
import os from 'os';
import v8 from 'v8';

export function startMemoryMonitoring() {
  setInterval(() => {
    const used = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapUsagePercent = (used.heapUsed / heapStats.heap_size_limit) * 100;
    
    console.log('Memory:', {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsagePercent: `${Math.round(heapUsagePercent)}%`
    });
    
    // Alert if memory critical
    if (heapUsagePercent > 80) {
      console.error('⚠️ MEMORY CRITICAL:', heapUsagePercent.toFixed(1) + '%');
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('Running garbage collection...');
        global.gc();
      }
    }
  }, 60000); // Every minute
}

// Call in server/index.ts
startMemoryMonitoring();
```

### Add API Response Time Tracking

```typescript
// server/middleware/performance.ts
import { Request, Response, NextFunction } from 'express';

export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 1000) {
      console.warn('⚠️ SLOW API REQUEST:', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        query: req.query,
        body: req.method === 'POST' ? 'omitted' : undefined
      });
    }
    
    // Log to database for analytics (async, don't block)
    logApiMetric({
      method: req.method,
      path: req.path,
      duration,
      statusCode: res.statusCode,
      timestamp: new Date()
    }).catch(console.error);
  });
  
  next();
}

// Add to server/index.ts
app.use(performanceMiddleware);
```

---

## PART 6: Replit-Specific Optimizations

### .replit Configuration

```toml
# .replit
run = "npm run dev"
hidden = [".config", "node_modules", ".git"]

[nix]
channel = "stable-23_11"

[deployment]
run = ["sh", "-c", "npm run build && npm run start"]
deploymentTarget = "cloudrun"

[env]
NODE_ENV = "production"
DATABASE_POOL_SIZE = "10"
```

### Reduce Dev Server Memory

**Update package.json:**
```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=2048' vite",
    "dev:server": "NODE_OPTIONS='--max-old-space-size=1024' tsx watch server/index.ts",
    "build": "tsc && vite build",
    "start": "NODE_ENV=production node dist/server/index.js"
  }
}
```

### Git Ignore Large Files

```gitignore
# .gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store

# Reduce repo size
*.mp3
*.wav
*.mp4
backup_*.sql
recordings/
temp/
```

---

## Expected Results After Optimization

### Database Performance
- **Before:** 119 tables, slow queries (500ms+)
- **After:** 58 tables, fast queries (<50ms)
- **Improvement:** ~90% faster for common queries

### API Response Times
- **Before:** p95 = 2000ms
- **After:** p95 = 200ms
- **Improvement:** 10x faster

### Memory Usage
- **Before:** 800MB+ (frequent OOM)
- **After:** 400MB average
- **Improvement:** 50% reduction

### Bundle Size
- **Before:** 2.5MB initial load
- **After:** 800KB initial load
- **Improvement:** 68% reduction

### Code Maintainability
- **Before:** 50+ service files, unclear patterns
- **After:** 25 focused services, clear agent pattern
- **Improvement:** Easier to navigate and modify

---

## Implementation Checklist

### Week 1: Database Cleanup
- [ ] Backup database completely
- [ ] Run migration script for outcomes table
- [ ] Verify migration (check row counts)
- [ ] Drop unused tables in stages
- [ ] Add critical indexes
- [ ] Test all core functionality
- [ ] Monitor query performance

### Week 2: Code Cleanup
- [ ] Delete unused service files
- [ ] Consolidate API routes
- [ ] Fix N+1 queries with Drizzle relations
- [ ] Remove unused dependencies
- [ ] Update imports across codebase
- [ ] Run full test suite
- [ ] Verify no broken functionality

### Week 3: Job System Migration
- [ ] Install BullMQ and Redis
- [ ] Create queues and workers
- [ ] Migrate cron jobs to BullMQ
- [ ] Test job execution
- [ ] Add job monitoring
- [ ] Remove old cron files
- [ ] Verify scheduled jobs running

### Week 4: Frontend Optimization
- [ ] Add lazy loading for routes
- [ ] Configure bundle splitting
- [ ] Remove unused dependencies
- [ ] Test loading times
- [ ] Add performance monitoring
- [ ] Deploy and verify

### Week 5: Monitoring & Polish
- [ ] Add memory monitoring
- [ ] Add API performance tracking
- [ ] Setup error alerting
- [ ] Document changes
- [ ] Train team on new structure
- [ ] Create runbook for operations

---

## Rollback Plan (If Something Breaks)

```bash
# Restore database from backup
psql qashivo_db < backup_before_cleanup.sql

# Restore code from git
git reset --hard <commit-hash-before-changes>
git push --force

# Clear Redis (if jobs stuck)
redis-cli FLUSHALL

# Restart services
npm run dev
```

---

## Success Metrics

Track these weekly:

```typescript
interface OptimizationMetrics {
  // Database
  tableCount: number;              // Target: 58
  avgQueryTime: number;            // Target: <50ms
  slowQueries: number;             // Target: <5 per day
  
  // API
  p50ResponseTime: number;         // Target: <100ms
  p95ResponseTime: number;         // Target: <200ms
  p99ResponseTime: number;         // Target: <500ms
  errorRate: number;               // Target: <0.1%
  
  // Memory
  avgMemoryUsage: number;          // Target: <400MB
  memoryLeaks: number;             // Target: 0
  gcFrequency: number;             // Target: <10/hour
  
  // Code
  serviceFileCount: number;        // Target: ~25
  routeFileCount: number;          // Target: ~10
  duplicateCode: number;           // Target: <5%
  
  // Frontend
  initialBundleSize: number;       // Target: <800KB
  timeToInteractive: number;       // Target: <2s
  
  // Jobs
  jobSuccessRate: number;          // Target: >99%
  jobQueueLength: number;          // Target: <100
  failedJobs: number;              // Target: <1/day
}
```

---

*This optimization plan will transform Qashivo from a bloated prototype into a lean, production-ready application. Follow it step-by-step, test thoroughly at each stage, and you'll have a system that's 10x faster and infinitely more maintainable.*