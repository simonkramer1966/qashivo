# Collections Workflow System

This document explains how Qashivo's automated collections workflow operates, including the default workflow configuration, invoice grouping logic, and how planned actions are generated for each debtor.

## Overview

Qashivo uses a **supervised autonomy model** for collections:
1. **AI Plans**: The system analyzes overdue invoices overnight and generates a daily plan
2. **User Approves**: Users review and approve the plan (or make adjustments)
3. **AI Executes**: Approved actions are automatically executed throughout the day

## Default Collection Workflow

The "Standard Collection" workflow consists of 5 escalating steps:

| Step | Day | Channel | Purpose |
|------|-----|---------|---------|
| 1 | Day 1 | Email | Friendly payment reminder |
| 2 | Day 7 | Email | Follow-up requesting status update |
| 3 | Day 14 | Email | Formal notice requiring payment within 7 days |
| 4 | Day 14 | SMS | Brief text reminder with overdue summary |
| 5 | Day 30 | Email | Final notice warning of debt recovery proceedings |

### Template Variables

All templates support these dynamic variables:

| Variable | Description |
|----------|-------------|
| `{{contactName}}` | Debtor's full name |
| `{{companyName}}` | Your company name |
| `{{invoiceNumber}}` | Invoice reference (single invoice) |
| `{{invoiceAmount}}` | Invoice total (single invoice) |
| `{{dueDate}}` | Original due date |
| `{{daysOverdue}}` | Days past due date |
| `{{invoiceTable}}` | HTML table of all overdue invoices |
| `{{invoiceCount}}` | Number of overdue invoices |
| `{{totalOverdue}}` | Total outstanding amount across all invoices |
| `{{oldestInvoiceDays}}` | Days overdue for the oldest invoice |

## Invoice Grouping Logic

### The Problem with Per-Invoice Actions

If a debtor has 5 overdue invoices, sending 5 separate reminder emails is:
- Annoying for the customer
- Unprofessional in appearance
- Inefficient for collections

### The Solution: Contact-Level Consolidation

Qashivo groups all overdue invoices by contact and generates **one action per contact** rather than one per invoice.

```
Contact: ABC Ltd (3 overdue invoices)
├── Invoice #001 - £1,500 (45 days overdue)
├── Invoice #002 - £800 (30 days overdue)
└── Invoice #003 - £2,200 (15 days overdue)

→ Generates ONE action with:
   - invoiceCount: 3
   - totalOverdue: £4,500
   - oldestInvoiceDays: 45
   - invoiceTable: HTML table listing all 3
```

### Step Selection Logic

The workflow step is determined by the **oldest overdue invoice**:

1. Find all overdue invoices for the contact
2. Calculate days overdue for each invoice
3. Use the maximum days overdue to determine the workflow step
4. If Day 45 and Step 3 is "Day 14", the contact is at Step 3

This ensures escalation is based on the longest-outstanding debt, not the newest invoice.

## Daily Plan Generation Process

### 1. Invoice Discovery

The system queries for invoices matching:
- Belongs to the tenant
- Due date is in the past
- Outstanding balance > 0 (amountPaid < amount)
- Status is not 'paid', 'cancelled', or 'void'

```sql
WHERE tenant_id = ?
  AND due_date <= NOW()
  AND COALESCE(amount_paid, 0) < amount
  AND status NOT IN ('paid', 'cancelled', 'void')
```

### 2. Contact Grouping

Invoices are grouped by contact ID:

```typescript
Map<contactId, {
  contact: Contact,
  invoices: [{invoice, daysOverdue}],
  schedule: CollectionSchedule,
  assignment: CustomerScheduleAssignment
}>
```

### 3. Step Calculation

For each contact group:
1. Find the oldest invoice (max days overdue)
2. Look up the assigned collection schedule
3. Find which step matches: `daysOverdue >= step.triggerDays`
4. Select the highest-numbered matching step

### 4. Action Generation

For each contact with a matching step:
1. Check if this step was already executed (via action history)
2. If not executed, create a planned action with:
   - Contact details
   - Consolidated invoice data (table, count, total)
   - Template and channel from the schedule step
   - Status: "planned"

### 5. VIP Exception Flagging

Certain actions are flagged for manual review:
- First contact with high-value customers (>£10K)
- Disputed invoices
- VIP-flagged contacts
- Low AI confidence scores

These appear in the "VIP" tab rather than auto-executing.

## Data Flow Diagram

```
┌─────────────────┐
│   Xero Sync     │
│  (Invoices)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Daily Plan     │
│  Generator      │
│  (Overnight)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Planned Tab   │────▶│   VIP Tab       │
│  (Auto-execute) │     │  (Manual Review)│
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  User Approval  │     │  User Decision  │
│  (One-click)    │     │  (Edit/Skip)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐
│  Action         │
│  Executor       │
│  (Email/SMS/    │
│   Voice)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Recovery Tab   │
│  (Completed     │
│   Actions)      │
└─────────────────┘
```

## Schedule Assignment

### Automatic Assignment

New contacts imported from Xero are automatically assigned the default "Standard Collection" schedule.

### Manual Override

Users can:
- Assign different schedules to specific contacts
- Create custom schedules for different customer segments
- Pause automation for specific contacts
- Mark contacts as VIP for manual handling

## Template Customization

### Creating Custom Templates

1. Navigate to Settings > Communication Templates
2. Create templates for each step (email, SMS, or voice)
3. Use template variables for personalization
4. Test with preview before activating

### Schedule Configuration

1. Navigate to Settings > Collection Schedules
2. Create or edit a schedule
3. Define steps with:
   - Trigger day (days after due date)
   - Channel (email, SMS, voice, WhatsApp)
   - Template selection
   - Priority level

## Best Practices

1. **Early stages (Day 1-14)**: Use consolidated reminders listing all invoices
2. **Later stages (Day 30+)**: Consider per-invoice focus for specific disputes
3. **Voice calls**: Reserve for high-value or unresponsive debtors
4. **SMS**: Use as a supplement to email, not a replacement
5. **Escalation**: Each step should increase in urgency without being aggressive
