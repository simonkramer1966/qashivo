# Adaptive Scheduler - Usage Guide

## Overview

The adaptive scheduler uses composite scoring and DSO-driven portfolio control to intelligently schedule collection actions. This guide explains how to use and test the system.

## Architecture

### Components

1. **Adaptive Scheduler** (`server/lib/adaptive-scheduler.ts`)
   - Composite scoring: `Score = α·P(pay) - β·Friction - γ·Risk + δ·UrgencyBoost`
   - Constraint enforcement (quiet hours, frequency caps, disputes, overrides)
   - Cold-start logic with segment priors

2. **Portfolio Controller** (`server/services/portfolioController.ts`)
   - Nightly DSO recomputation
   - Urgency factor adjustment: ±10% based on `projected DSO - target DSO`
   - Bounds: urgency ∈ [0.1, 1.0]

3. **Action Planner** (`server/services/actionPlanner.ts`)
   - Scans overdue invoices
   - Calls adaptive scheduler for recommendations
   - Creates scheduled actions in queue

## Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run test/adaptive-scheduler.test.ts
npx vitest run test/portfolio-controller.test.ts
```

### Test Coverage

**Adaptive Scheduler Tests:**
- Composite scoring formula
- Urgency factor impact
- Friction penalties
- Constraint enforcement (disputes, overrides, quiet hours, frequency caps)
- Cold-start logic with segment priors
- Channel selection
- Reasoning output

**Portfolio Controller Tests:**
- Urgency increase when projected DSO > target DSO
- Urgency decrease when projected DSO < target DSO
- Urgency bounds (min 0.1, max 1.0)
- State persistence
- Error handling

## Manual Operations

### Run Action Planning Once

Plan actions for a specific tenant and schedule:

```bash
tsx scripts/plan-once.ts <tenantId> <scheduleId>

# Example
tsx scripts/plan-once.ts 6feb7f4d-ba6f-4a67-936e-9cff78f49c59 schedule-123
```

**Output:**
```
🚀 Planning adaptive actions for tenant: ...
✅ Planning complete!
   Invoices processed: 150
   Actions created: 45
   Skipped (disputed): 3
   Skipped (low priority): 90
   Skipped (recent action): 12
```

### Run Portfolio Controller Once

Run the nightly DSO adjustment for all tenants:

```bash
tsx scripts/controller-once.ts
```

**Output:**
```
🌙 Running portfolio controller (DSO adjustment)...
[CONTROL] tenant=xxx schedule=yyy projDSO=48 target=45 Δ=+3 urgency 0.50→0.55
✅ Portfolio controller complete!
```

## API Endpoints

### 1. Portfolio Health Monitoring

Get real-time DSO metrics for all adaptive schedules:

```bash
GET /health/portfolio
Authorization: Bearer <token>
```

**Response:**
```json
{
  "tenantId": "6feb7f4d-ba6f-4a67-936e-9cff78f49c59",
  "schedules": [
    {
      "scheduleId": "schedule-123",
      "scheduleName": "Default Collections",
      "projectedDSO": 48.5,
      "targetDSO": 45,
      "urgencyFactor": 0.55,
      "delta": 3.5,
      "lastUpdated": "2025-10-20T02:00:00Z"
    }
  ],
  "summary": {
    "avgProjectedDSO": 48.5,
    "avgTargetDSO": 45
  }
}
```

### 2. Manual Invoice Override

Prevent automated actions for specific invoices:

```bash
POST /api/invoices/:id/override
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer in bankruptcy proceedings",
  "action": "pause_collections"
}
```

**Response:**
```json
{
  "success": true,
  "invoiceId": "inv-123",
  "override": {
    "userId": "user-456",
    "reason": "Customer in bankruptcy proceedings",
    "action": "pause_collections",
    "timestamp": "2025-10-20T10:30:00Z"
  }
}
```

## Automation Schedule

The system runs two cron jobs:

1. **Nightly Portfolio Controller** (2am daily)
   - Calculates projected DSO for each tenant
   - Adjusts urgency factors based on `delta = projected - target`
   - Persists state to `scheduler_state` table

2. **Action Planning** (every 6 hours)
   - Scans overdue invoices for all tenants with adaptive scheduling enabled
   - Calls adaptive scheduler for recommendations
   - Creates scheduled actions above threshold score (default: 40)

## Configuration

### Workflow Settings

Adaptive settings are stored in `workflows.adaptiveSettings` (JSONB):

```json
{
  "targetDSO": 45,
  "urgencyFactor": 0.5,
  "quietHours": [22, 8],
  "maxDailyTouches": 3,
  "minScoreThreshold": 40
}
```

### Segment Priors (Cold-Start)

When customers lack behavior signals, segment-based priors are used:

```typescript
const SEGMENT_PRIORS = {
  small_business: {
    avgPaymentDelayDays: 21,
    promiseKeepRate: 0.65,
    responseRate: 0.45,
  },
  enterprise: {
    avgPaymentDelayDays: 45,
    promiseKeepRate: 0.80,
    responseRate: 0.60,
  },
  freelancer: {
    avgPaymentDelayDays: 14,
    promiseKeepRate: 0.50,
    responseRate: 0.40,
  },
};
```

## Debugging

### Enable Debug Logging

The scheduler logs decisions at key points:

```typescript
console.log(
  `[PLAN] tenant=${tenantId} invoice=${invoiceNumber} ` +
  `ch=${channel} score=${priority.toFixed(1)} reasoning="${reasoning}"`
);
```

### Check Scheduler State

Query the database to see current urgency factors:

```sql
SELECT 
  s.tenant_id,
  s.schedule_id,
  s.urgency_factor,
  s.projected_dso,
  s.updated_at
FROM scheduler_state s
ORDER BY s.updated_at DESC;
```

### Review Scheduled Actions

See what actions were created:

```sql
SELECT 
  a.id,
  a.invoice_id,
  a.type,
  a.scheduled_for,
  a.metadata->>'priority' as priority,
  a.metadata->>'reasoning' as reasoning
FROM actions a
WHERE a.status = 'scheduled'
  AND a.metadata->>'adaptiveScheduler' = 'true'
ORDER BY a.scheduled_for;
```

## Performance

### Constraints

- **Quiet Hours:** No actions scheduled between 22:00 and 08:00
- **Frequency Cap:** Max 3 actions per customer per 7 days
- **Daily Touch Limit:** Max 2 actions per customer per day
- **Min Gap:** 24 hours minimum between actions

### Scoring Thresholds

- **Default Threshold:** 40 (actions below this score are skipped)
- **Typical Range:** 0-100
- **High Priority:** >70
- **Medium Priority:** 40-70
- **Low Priority:** <40 (skipped)

## Troubleshooting

### No Actions Created

1. Check workflow is active: `SELECT * FROM workflows WHERE scheduler_type = 'adaptive' AND is_active = true`
2. Verify invoices are overdue: `SELECT * FROM invoices WHERE due_date < NOW() AND status NOT IN ('paid', 'cancelled')`
3. Check urgency factor isn't too low: `SELECT urgency_factor FROM scheduler_state WHERE urgency_factor < 0.2`
4. Review score threshold: Default is 40, may be too high

### Urgency Not Adjusting

1. Verify portfolio controller is running: Check logs at 2am daily
2. Check DSO calculation: `tsx scripts/controller-once.ts` to run manually
3. Verify scheduler state persists: `SELECT * FROM scheduler_state ORDER BY updated_at DESC`

### Tests Failing

1. Ensure mocks are set up correctly for database calls
2. Check that imports match actual file structure
3. Run with verbose logging: `npx vitest run --reporter=verbose`

## Further Reading

- [Edward Tufte - Data Visualization Principles](https://www.edwardtufte.com/)
- [Stephen Few - Perceptual Edge](http://www.perceptualedge.com/)
- [Composite Scoring in Credit Collections](https://www.example.com) (internal doc)
