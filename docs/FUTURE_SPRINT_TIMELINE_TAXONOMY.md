# FUTURE SPRINT — Timeline Event Taxonomy (Option B)

**Priority:** Medium — scheduled after MVP stabilisation
**Prerequisite:** Option A deployed (channelToCategory mapping fix)
**Depends on:** Taxonomy audit complete (April 2026)

---

## PROBLEM

The timelineEvents table has no `eventCategory` field. Category is derived at query time from `channel` and `outcomeType` via a mapping function. This works (after Option A fix) but is fragile, requires in-memory filtering, and means category logic is duplicated across query points.

## SOLUTION

Add an `eventCategory` field to timelineEvents, populate it on all 30 creation points, and backfill existing records.

## SCHEMA CHANGE

```
timelineEvents (extended)
├── eventCategory: varchar NOT NULL default 'communication'
│   Values: 'communication' | 'promise' | 'dispute' | 
│           'payment' | 'risk' | 'note' | 'system'
```

## CATEGORY ASSIGNMENT RULES

| eventCategory | When to assign |
|---------------|---------------|
| communication | Default for all outbound/inbound email, SMS, voice that don't match a more specific category |
| promise | PTP confirmation sent, inbound PTP detected, promise modification, payment plan, arrangement confirmed |
| dispute | Inbound dispute detected, dispute raised by user |
| payment | Payment received (Xero sync), probable payment detected, payment confirmed |
| risk | Wrong contact detected, refused to pay, Companies House alert, credit score change |
| note | Manual notes added by user |
| system | Legal windows, compliance blocks, bounces, VIP changes, escalations |

## CREATION POINTS TO UPDATE (30 total)

| # | File | Current channel | New eventCategory |
|---|------|----------------|-------------------|
| 1 | webhooks.ts:665 (Inbound SMS) | sms | communication (unless outcomeType is promise/dispute → use that) |
| 2 | webhooks.ts:781 (Inbound WhatsApp) | whatsapp | communication (unless outcomeType detected) |
| 3 | webhooks.ts:~2290 (Inbound email) | email | communication (unless outcomeType detected) |
| 4 | collectionsPipeline.ts:560 (AI email) | email | communication |
| 5 | actionExecutor.ts:1186 (Action executed) | mapped | communication |
| 6 | actionExecutor.ts:475 (Compliance block) | system | system |
| 7 | actionExecutor.ts:1231 (Legal window set) | system | system |
| 8 | inboundReplyPipeline.ts:398 (AI reply) | email | communication |
| 9 | emailClarificationService.ts:301 (PTP confirmation) | email | promise |
| 10 | emailClarificationService.ts:943 (AI escalation) | email | system |
| 11 | emailClarificationService.ts:1240 (Clarification) | email | communication |
| 12 | emailClarificationService.ts:1302 (Partial escalation) | email | system |
| 13 | emailClarificationService.ts:1618 (Voice follow-up) | email | communication |
| 14 | intentAnalyst.ts:1328 (Promise modification) | from message | promise |
| 15 | xeroSync.ts:776 (Legal window auto-clear) | system | payment |
| 16 | event-bus.ts:179 (Hard bounce) | system | system |
| 17 | customerTimelineService.ts:619 (Manual note) | note | note |
| 18 | customerTimelineService.ts:809 (Bulk sync) | varies | varies (match source) |
| 19 | contactRoutes.ts:1129 (User note) | note | note |
| 20 | contactRoutes.ts:1295 (Voice call) | voice | communication |
| 21 | contactRoutes.ts:2348 (User email) | email | communication |
| 22 | contactRoutes.ts:2538 (User SMS) | sms | communication |
| 23 | contactRoutes.ts:4786 (Legal resume) | system | system |
| 24 | contactRoutes.ts:4804 (Debt recovery) | system | system |
| 25 | contactRoutes.ts:4830 (Legal extend) | system | system |
| 26 | contactRoutes.ts:4921 (Probable payment) | system | payment |
| 27 | contactRoutes.ts:5087 (VIP promoted) | internal → system | system |
| 28 | contactRoutes.ts:5234 (VIP returned) | internal → system | system |
| 29 | onboardingRoutes.ts:1296 (Payment sim) | system | payment |
| 30 | legalWindowJob.ts:82,131 (Legal expiry) | system | system |

## SPECIAL CASE: INBOUND MESSAGES WITH INTENT

For inbound messages (creation points 1, 2, 3), the eventCategory should be set AFTER intent extraction runs. Initially created as 'communication', then updated when intentAnalyst detects:
- promise_to_pay → update to 'promise'
- dispute → update to 'dispute'  
- paid_confirmed → update to 'payment'
- wrong_contact → update to 'risk'
- refused → update to 'risk'

This requires either:
a. A post-intent-extraction update call (simpler)
b. Creating the timeline event after intent extraction (reorder pipeline — riskier)

Recommend option (a): add an updateTimelineEventCategory() call at the end of intent extraction.

## BACKFILL MIGRATION

After schema change, run a one-time migration to populate eventCategory on existing records:

```sql
-- Promises
UPDATE timeline_events SET event_category = 'promise'
WHERE outcome_type IN ('promise_to_pay', 'request_more_time', 
  'payment_plan', 'promise_delayed', 'promise_accelerated');

UPDATE timeline_events SET event_category = 'promise'
WHERE summary ILIKE '%arrangement confirmed%'
  OR summary ILIKE '%payment confirmed%'
  OR summary ILIKE '%payment arrangement%';

-- Disputes
UPDATE timeline_events SET event_category = 'dispute'
WHERE outcome_type = 'dispute';

-- Payments
UPDATE timeline_events SET event_category = 'payment'
WHERE outcome_type = 'paid_confirmed';

-- Risk
UPDATE timeline_events SET event_category = 'risk'
WHERE outcome_type IN ('refused', 'wrong_contact');

-- Notes
UPDATE timeline_events SET event_category = 'note'
WHERE channel = 'note';

-- System
UPDATE timeline_events SET event_category = 'system'
WHERE channel IN ('system', 'internal')
  AND event_category = 'communication'; -- only if not already set

-- Everything else stays as 'communication' (default)
```

## QUERY SIMPLIFICATION

After migration, the channelToCategory() mapping function becomes unnecessary. Filter queries change from:

```typescript
// Before (Option A): fetch all, map in memory, filter
const events = await db.select()...;
const mapped = events.map(e => ({ ...e, category: channelToCategory(e) }));
const filtered = mapped.filter(e => e.category === requestedCategory);
```

To:

```typescript
// After (Option B): filter at DB level
const events = await db.select()
  .from(timelineEvents)
  .where(eq(timelineEvents.eventCategory, requestedCategory));
```

This is faster (DB-level filtering), simpler (no mapping function), and consistent (all query points use the same field).

## ALSO FIX IN THIS SPRINT

1. Deprecate activityEvents table — stop querying it in debtor detail. All events should come from timelineEvents.
2. Fix channel='internal' on VIP events → change to 'system'
3. Fix direction='system' on escalation events → change to 'internal'
4. Add eventCategory to the Action Centre Activity Feed as an alternative filter dimension

## ESTIMATED EFFORT

- Schema change + migration: 30 minutes
- Update 30 creation points: 2-3 hours
- Backfill script: 30 minutes
- Update query points: 1 hour
- Testing: 1 hour
- Total: half day

---

*Saved: 5 April 2026*
*Prerequisite: Option A (channelToCategory mapping fix) deployed first*
*This task is non-urgent — Option A provides working filters immediately*
