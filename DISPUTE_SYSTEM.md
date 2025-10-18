# Debtor Dispute System

## Overview

The Debtor Dispute System enables customers to formally challenge invoices they believe are incorrect, while providing internal collectors with a structured workflow to investigate and resolve disputes efficiently. Disputed invoices are automatically excluded from overdue calculations and collection workflows until resolution.

### Key Features

- **Self-Service Submission**: Debtors can submit disputes directly through the portal
- **Automatic Holds**: Disputed invoices are immediately flagged and removed from collection actions
- **Evidence Support**: File attachments for supporting documentation (requires object storage setup)
- **Response Workflow**: Collectors can review, investigate, and respond with resolution details
- **Audit Trail**: Complete history of dispute lifecycle and resolution outcomes
- **Multi-Channel Integration**: Disputes appear in both debtor portal and internal CRM

---

## Database Architecture

### Disputes Table

The `disputes` table stores all formal dispute submissions with full lifecycle tracking.

```typescript
export const disputes = pgTable("disputes", {
  // Identity
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // Dispute Details
  type: varchar("type").notNull(),                    // quality, billing, delivery, pricing, etc.
  status: varchar("status").notNull().default("pending"),  // pending, under_review, resolved, rejected
  summary: text("summary").notNull(),                  // Brief description of the issue
  
  // Submitter Contact (captured at submission time)
  buyerContactName: varchar("buyer_contact_name").notNull(),
  buyerContactEmail: varchar("buyer_contact_email"),
  buyerContactPhone: varchar("buyer_contact_phone"),
  
  // Response Management
  responseDueAt: timestamp("response_due_at").notNull(),  // SLA deadline (7 days from submission)
  respondedAt: timestamp("responded_at"),
  respondedByUserId: varchar("responded_by_user_id").references(() => users.id),
  resolution: text("resolution"),                      // Collector's response notes
  resolutionType: varchar("resolution_type"),          // accepted, rejected, partial_credit
  creditNoteAmount: decimal("credit_note_amount", { precision: 10, scale: 2 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Category of dispute (quality, billing, delivery, pricing, other) |
| `status` | string | Current state: `pending` → `under_review` → `resolved`/`rejected` |
| `summary` | text | Detailed explanation of why the invoice is being disputed |
| `buyerContactName` | string | Name of person submitting dispute (captured at submission) |
| `responseDueAt` | timestamp | Deadline for collector response (auto-set to 7 days from submission) |
| `resolution` | text | Collector's investigation findings and resolution details |
| `resolutionType` | string | Outcome: `accepted` (full credit), `rejected` (no change), `partial_credit` (compromise) |
| `creditNoteAmount` | decimal | Amount credited if resolution type is `accepted` or `partial_credit` |

#### Status Lifecycle

```
pending → under_review → resolved
                       ↘ rejected
```

- **pending**: Newly submitted, awaiting collector assignment
- **under_review**: Collector is investigating the dispute
- **resolved**: Dispute accepted (full or partial credit issued)
- **rejected**: Dispute rejected (invoice stands as-is)

---

### Dispute Evidence Table

The `disputeEvidence` table stores file attachments supporting dispute claims.

```typescript
export const disputeEvidence = pgTable("dispute_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeId: varchar("dispute_id").notNull().references(() => disputes.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // File Details
  filename: varchar("filename").notNull(),
  originalFilename: varchar("original_filename").notNull(),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageUrl: text("storage_url").notNull(),
  
  // Metadata
  uploadedBy: varchar("uploaded_by").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id),
  notes: text("notes"),
  checksum: varchar("checksum"),
  virusScanStatus: varchar("virus_scan_status").default("pending"),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Note**: Evidence upload is currently planned but not implemented. Requires object storage setup and FormData handling in the frontend.

---

## Debtor Workflow

### 1. Accessing the Dispute Portal

Debtors access the dispute system through the self-service portal after authenticating with magic link + OTP.

**Portal URL**: `/debtor-portal` (after authentication)

**Navigation**: Overview tab → Disputes tab

### 2. Submitting a Dispute

#### Eligibility

Debtors can dispute invoices that:
- Are **not already disputed** (no active dispute exists)
- Are **not fully paid** (status ≠ "paid")

#### Submission Form

```typescript
{
  invoiceId: string;      // Selected from eligible invoices dropdown
  type: string;           // quality | billing | delivery | pricing | other
  summary: string;        // Detailed description of the issue
}
```

#### Frontend Implementation

```typescript
// DisputesTab Component (client/src/pages/debtor-portal.tsx)
const createDisputeMutation = useMutation({
  mutationFn: async (data: { invoiceId: string; type: string; summary: string }) => {
    return await apiRequest("POST", "/api/debtor/disputes", data);
  },
  onSuccess: () => {
    toast({ title: "Dispute submitted" });
    queryClient.invalidateQueries({ queryKey: ["/api/debtor/disputes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debtor/overview"] });
  }
});
```

#### Backend Processing

```typescript
// POST /api/debtor/disputes (server/debtor-routes.ts)
router.post("/api/debtor/disputes", requireDebtorAuth, async (req, res) => {
  const { contactId, tenantId } = req.session.debtorAuth!;
  
  // Validate dispute data
  const disputeData = insertDisputeSchema.parse({
    ...req.body,
    tenantId,
    submittedBy: contactId,
    status: "pending",
    responseDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  // Verify invoice ownership
  const invoice = await storage.getInvoice(disputeData.invoiceId, tenantId);
  if (!invoice || invoice.contactId !== contactId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  const dispute = await storage.createDispute(disputeData);
  return res.json(dispute);
});
```

#### What Happens After Submission

1. **Dispute Record Created**: Stored in `disputes` table with `status: "pending"`
2. **Response Deadline Set**: Auto-calculated as 7 days from submission
3. **Contact Details Captured**: Buyer name, email, phone stored at submission time
4. **Invoice Flagged**: Invoice marked as having an active dispute
5. **Collector Notified**: Dispute appears in internal CRM "On Hold" tab

### 3. Tracking Dispute Status

Debtors can view all their disputes in the Disputes tab:

```typescript
// GET /api/debtor/disputes
{
  id: "dispute-123",
  invoiceId: "inv-456",
  invoiceNumber: "INV-2025-001",
  type: "quality",
  summary: "Products delivered with manufacturing defects",
  status: "under_review",
  responseDueAt: "2025-10-25T12:00:00Z",
  respondedAt: null,
  resolution: null,
  createdAt: "2025-10-18T09:30:00Z"
}
```

**Status Indicators**:
- **Pending**: Awaiting collector review
- **Under Review**: Collector is investigating
- **Resolved**: Dispute accepted (credit issued)
- **Rejected**: Dispute denied (invoice stands)

---

## Collector Workflow

### 1. Viewing Disputed Invoices

Internal collectors see disputed invoices in the **Action Centre → On Hold Tab**.

#### Frontend Query

```typescript
// GET /api/actions/dashboard
const formalDisputes = await db
  .select({
    dispute: disputes,
    invoice: invoices,
    contact: contacts
  })
  .from(disputes)
  .leftJoin(invoices, eq(disputes.invoiceId, invoices.id))
  .leftJoin(contacts, eq(invoices.contactId, contacts.id))
  .where(eq(disputes.tenantId, tenantId))
  .orderBy(desc(disputes.createdAt));
```

#### Display Format

Each disputed invoice shows:
- Invoice number and amount
- Buyer company name and contact
- Dispute type and summary
- Days until response due
- Current status

### 2. Responding to Disputes

Collectors respond via the dispute detail modal with investigation findings.

#### API Endpoint

```typescript
POST /api/disputes/:disputeId/respond

Request Body:
{
  status: "under_review" | "resolved" | "rejected",
  responseNotes: string,
  resolutionType?: "accepted" | "rejected" | "partial_credit",
  creditNoteAmount?: number
}

Response:
{
  id: "dispute-123",
  status: "resolved",
  responseNotes: "Quality issue confirmed. Full credit issued.",
  resolutionType: "accepted",
  creditNoteAmount: 3450.00,
  respondedBy: "user-789",
  respondedAt: "2025-10-20T14:30:00Z"
}
```

#### Backend Implementation

```typescript
// server/routes.ts
app.post("/api/disputes/:disputeId/respond", isAuthenticated, async (req, res) => {
  const user = await storage.getUser(req.user.claims.sub);
  const { disputeId } = req.params;
  const { status, responseNotes, resolutionType, creditNoteAmount } = req.body;
  
  // Validate status
  if (!['under_review', 'resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  
  // Get dispute and verify tenant ownership
  const dispute = await storage.getDispute(disputeId, user.tenantId);
  if (!dispute) {
    return res.status(404).json({ message: "Dispute not found" });
  }
  
  // Update dispute with collector response
  const updatedDispute = await storage.updateDispute(disputeId, user.tenantId, {
    status,
    resolution: responseNotes,
    resolutionType,
    creditNoteAmount,
    respondedByUserId: user.id,
    respondedAt: new Date()
  });
  
  // Create action log if resolved/rejected
  if (status === 'resolved' || status === 'rejected') {
    await storage.createAction(user.tenantId, {
      invoiceId: dispute.invoiceId,
      userId: user.id,
      type: 'note',
      status: 'completed',
      subject: `Dispute ${status}`,
      content: `Dispute ${status} by collector. Response: ${responseNotes}`,
      metadata: {
        disputeId: dispute.id,
        disputeStatus: status
      }
    });
  }
  
  res.json(updatedDispute);
});
```

### 3. Resolution Types

| Type | Description | Action |
|------|-------------|--------|
| **accepted** | Dispute is valid; full credit issued | Update invoice status, create credit note |
| **partial_credit** | Dispute partially valid; compromise reached | Issue partial credit, adjust invoice balance |
| **rejected** | Dispute is invalid; invoice stands | No financial adjustment, update dispute status |

---

## Invoice Integration

### Automatic Exclusion from Collections

Disputed invoices are automatically excluded from:
1. Overdue calculations
2. Automated collection workflows
3. Follow-up action generation

#### Implementation

```typescript
// server/routes.ts - Action Centre Dashboard
const invoiceIdsWithDisputes = formalDisputes
  .filter(({ dispute }) => dispute.status !== 'resolved')
  .map(({ dispute }) => dispute.invoiceId);

// Filter out disputed invoices from overdue list
const overdueInvoices = allInvoices.filter(inv => 
  !invoiceIdsWithDisputes.includes(inv.id) &&
  inv.status === 'overdue'
);
```

### Interest Calculation Pausing

The interest calculator automatically pauses accrual during active dispute periods.

```typescript
// server/services/interest-calculator.ts
const activeDisputes = await storage.getInvoiceDisputes(invoiceId, tenantId);

// Merge overlapping dispute periods to prevent double-counting
const mergedDisputeWindows = mergeDisputeWindows(
  activeDisputes
    .filter(d => d.status !== 'resolved')
    .map(d => ({
      start: d.createdAt,
      end: d.respondedAt || new Date()
    }))
);

// Subtract dispute days from total accrual period
const totalDisputeDays = mergedDisputeWindows.reduce((sum, window) => {
  return sum + Math.ceil((window.end - window.start) / (1000 * 60 * 60 * 24));
}, 0);

const billableDays = totalDaysOverdue - totalDisputeDays;
```

### Visual Indicators

#### Debtor Portal
- **Overview Tab**: Disputed invoices show "Disputed" badge
- **Status**: Shows as "On Hold" instead of "Overdue"
- **Interest**: Accrual paused indicator displayed

#### Internal CRM
- **On Hold Tab**: Dedicated section for all disputed invoices
- **Badge**: Red "Disputed" label on invoice cards
- **Action Blocking**: Collection actions disabled for disputed invoices

---

## API Reference

### Debtor Portal Endpoints

#### Get Disputes
```
GET /api/debtor/disputes

Authentication: Debtor session (magic link + OTP)

Response: Dispute[]
[
  {
    id: "dispute-123",
    invoiceId: "inv-456",
    invoiceNumber: "INV-2025-001",
    type: "quality",
    status: "pending",
    summary: "Manufacturing defects found in delivered products",
    buyerContactName: "Alex Thompson",
    buyerContactEmail: "alex.thompson@testbuyer.com",
    responseDueAt: "2025-10-25T12:00:00Z",
    respondedAt: null,
    resolution: null,
    createdAt: "2025-10-18T09:30:00Z"
  }
]
```

#### Submit Dispute
```
POST /api/debtor/disputes

Authentication: Debtor session (magic link + OTP)

Request Body:
{
  invoiceId: "inv-456",
  type: "quality" | "billing" | "delivery" | "pricing" | "other",
  summary: "Detailed description of the dispute reason"
}

Response: Dispute
{
  id: "dispute-123",
  invoiceId: "inv-456",
  tenantId: "tenant-789",
  contactId: "contact-012",
  type: "quality",
  status: "pending",
  summary: "Manufacturing defects found...",
  buyerContactName: "Alex Thompson",
  buyerContactEmail: "alex.thompson@testbuyer.com",
  buyerContactPhone: "+447700900123",
  responseDueAt: "2025-10-25T09:30:00Z",
  createdAt: "2025-10-18T09:30:00Z"
}

Errors:
- 400: Invalid dispute data (Zod validation failure)
- 403: Invoice does not belong to authenticated contact
- 500: Database error
```

### Internal Collector Endpoints

#### Respond to Dispute
```
POST /api/disputes/:disputeId/respond

Authentication: Replit Auth (internal users only)

Request Body:
{
  status: "under_review" | "resolved" | "rejected",
  responseNotes: "Investigation findings and resolution details",
  resolutionType?: "accepted" | "rejected" | "partial_credit",
  creditNoteAmount?: 3450.00
}

Response: Dispute
{
  id: "dispute-123",
  status: "resolved",
  resolution: "Quality issue confirmed. Full credit issued per our warranty policy.",
  resolutionType: "accepted",
  creditNoteAmount: 3450.00,
  respondedByUserId: "user-789",
  respondedAt: "2025-10-20T14:30:00Z",
  updatedAt: "2025-10-20T14:30:00Z"
}

Errors:
- 400: Invalid status or missing required fields
- 403: User not associated with tenant
- 404: Dispute not found for this tenant
- 500: Database error
```

---

## Storage Layer Methods

### Core CRUD Operations

```typescript
// Get all disputes for an invoice
async getInvoiceDisputes(invoiceId: string, tenantId: string): Promise<Dispute[]>

// Get single dispute by ID
async getDispute(id: string, tenantId: string): Promise<Dispute | undefined>

// Create new dispute
async createDispute(disputeData: InsertDispute): Promise<Dispute>

// Update dispute (collector response)
async updateDispute(
  id: string, 
  tenantId: string, 
  updates: Partial<InsertDispute>
): Promise<Dispute>
```

### Usage Examples

```typescript
// Create dispute
const dispute = await storage.createDispute({
  invoiceId: "inv-123",
  tenantId: "tenant-456",
  contactId: "contact-789",
  type: "quality",
  status: "pending",
  summary: "Products damaged during shipping",
  buyerContactName: "John Doe",
  buyerContactEmail: "john@example.com",
  responseDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

// Update with collector response
const resolved = await storage.updateDispute("dispute-123", "tenant-456", {
  status: "resolved",
  resolution: "Confirmed shipping damage. Full replacement shipped.",
  resolutionType: "accepted",
  respondedByUserId: "user-789",
  respondedAt: new Date()
});
```

---

## Frontend Components

### Debtor Portal - Disputes Tab

**Location**: `client/src/pages/debtor-portal.tsx`

**Features**:
- List all disputes with status badges
- Filter eligible invoices for new disputes
- Submit new dispute form with validation
- Real-time status updates via TanStack Query

**Key UI Elements**:
```tsx
// New Dispute Button (only shows if eligible invoices exist)
<Button 
  onClick={() => setShowNewDispute(true)}
  data-testid="button-new-dispute"
>
  Submit New Dispute
</Button>

// Dispute Submission Form
<Select 
  value={selectedInvoiceId}
  onValueChange={setSelectedInvoiceId}
  data-testid="select-dispute-invoice"
>
  {availableInvoices.map(inv => (
    <SelectItem value={inv.id}>
      {inv.invoiceNumber} - £{inv.totalAmount}
    </SelectItem>
  ))}
</Select>

<Select 
  value={disputeType}
  onValueChange={setDisputeType}
  data-testid="select-dispute-type"
>
  <SelectItem value="quality">Quality Issue</SelectItem>
  <SelectItem value="billing">Billing Error</SelectItem>
  <SelectItem value="delivery">Delivery Problem</SelectItem>
  <SelectItem value="pricing">Pricing Dispute</SelectItem>
  <SelectItem value="other">Other</SelectItem>
</Select>

<Textarea
  value={disputeSummary}
  onChange={(e) => setDisputeSummary(e.target.value)}
  placeholder="Explain why you're disputing this invoice..."
  data-testid="textarea-dispute-summary"
/>
```

### Internal CRM - On Hold Tab

**Location**: `client/src/pages/action-centre.tsx`

**Features**:
- View all active disputes across all customers
- Quick response workflow with modal
- SLA deadline tracking (7-day response time)
- Automatic refresh after resolution

**Display Format**:
```tsx
<Card data-testid={`card-dispute-${dispute.id}`}>
  <CardHeader>
    <div className="flex justify-between">
      <span className="font-semibold">{dispute.invoiceNumber}</span>
      <Badge variant="destructive">Disputed</Badge>
    </div>
    <div className="text-sm text-gray-600">
      {dispute.buyerContactName} - {dispute.contact.companyName}
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div>
        <strong>Type:</strong> {dispute.type}
      </div>
      <div>
        <strong>Summary:</strong> {dispute.summary}
      </div>
      <div>
        <strong>Response Due:</strong> 
        {daysUntilDue > 0 
          ? `${daysUntilDue} days remaining`
          : 'OVERDUE'}
      </div>
    </div>
  </CardContent>
  <CardFooter>
    <Button 
      onClick={() => openResponseModal(dispute)}
      data-testid={`button-respond-${dispute.id}`}
    >
      Respond to Dispute
    </Button>
  </CardFooter>
</Card>
```

---

## Testing

### Seed Data

The debtor portal seed script creates test disputes for development:

```bash
tsx scripts/seed-debtor-portal.ts
```

**Created Test Data**:
- 1 disputed invoice: INV-2025-002 (£3,450.00, quality issue)
- Response due: 7 days from creation
- Status: pending
- Buyer: Alex Thompson (alex.thompson@testbuyer.com)

### Manual Testing Workflow

1. **Access Debtor Portal**:
   - Set `DEBUG_AUTH=true` in environment
   - POST to `/api/debtor/auth/request-link` with `alex.thompson@testbuyer.com`
   - Navigate to debtor portal, verify with OTP

2. **View Existing Dispute**:
   - Click "Disputes" tab
   - Verify INV-2025-002 appears with "Pending" status

3. **Submit New Dispute**:
   - Click "Submit New Dispute"
   - Select eligible invoice from dropdown
   - Choose dispute type
   - Enter detailed summary
   - Submit and verify success toast

4. **Collector Response** (requires internal login):
   - Navigate to Action Centre → On Hold
   - Click on disputed invoice
   - Enter response notes
   - Select resolution type
   - Submit response

5. **Verify Updates**:
   - Return to debtor portal
   - Refresh disputes tab
   - Verify status changed to "Resolved" or "Rejected"
   - Check resolution notes appear

---

## Future Enhancements

### Evidence Upload System

**Current Status**: Database schema exists but API/UI not implemented

**Required Components**:

1. **Object Storage Setup**:
   ```typescript
   await setupObjectStorage();
   // Creates bucket and sets environment variables
   ```

2. **Backend Endpoint**:
   ```typescript
   POST /api/debtor/disputes/:disputeId/evidence
   Content-Type: multipart/form-data
   
   {
     file: File,
     notes?: string
   }
   ```

3. **Frontend Upload**:
   ```tsx
   <input
     type="file"
     accept="image/*,application/pdf"
     onChange={handleFileUpload}
     data-testid="input-dispute-evidence"
   />
   ```

4. **Storage Integration**:
   ```typescript
   const storageUrl = await uploadToObjectStorage(file);
   await storage.createDisputeEvidence({
     disputeId: dispute.id,
     tenantId,
     filename: file.name,
     storageUrl,
     mimeType: file.type,
     fileSize: file.size
   });
   ```

### Email Notifications

**Planned Features**:
- Email debtor when dispute status changes
- Remind collectors of approaching response deadlines
- Notify admins of overdue dispute responses

**Implementation**:
```typescript
// SendGrid integration
await sendEmail({
  to: dispute.buyerContactEmail,
  subject: `Dispute Update: ${dispute.invoiceNumber}`,
  template: "dispute-resolved",
  data: {
    invoiceNumber: dispute.invoiceNumber,
    resolution: dispute.resolution,
    creditAmount: dispute.creditNoteAmount
  }
});
```

### Advanced Analytics

**Planned Metrics**:
- Dispute rate by customer/invoice type
- Average resolution time
- Resolution type distribution (accepted vs rejected)
- Financial impact (total credited amounts)
- Collector performance (response time, resolution quality)

---

## Best Practices

### For Debtors

1. **Be Specific**: Provide detailed explanations in the summary field
2. **Act Quickly**: Submit disputes as soon as issues are identified
3. **Gather Evidence**: Prepare supporting documentation (photos, emails, delivery receipts)
4. **Track Status**: Monitor dispute progress in the portal

### For Collectors

1. **Respond Promptly**: Stay within the 7-day SLA deadline
2. **Investigate Thoroughly**: Review invoice details, delivery records, and customer history
3. **Document Findings**: Provide clear, professional response notes
4. **Be Fair**: Consider partial credits when appropriate
5. **Create Action Logs**: Use the automated action creation for resolved/rejected disputes

### For Developers

1. **Multi-Tenant Isolation**: Always filter disputes by `tenantId`
2. **Status Validation**: Enforce valid status transitions (pending → under_review → resolved/rejected)
3. **Invoice Ownership**: Verify invoice belongs to contact before accepting dispute
4. **Interest Pausing**: Ensure disputed invoices excluded from interest calculations
5. **Audit Trail**: Maintain complete history of status changes and responses

---

## Troubleshooting

### Common Issues

**Problem**: Dispute submission returns 403 Forbidden
- **Cause**: Invoice doesn't belong to authenticated contact
- **Solution**: Verify session contains correct `contactId` and `tenantId`

**Problem**: Disputed invoice still appears in overdue list
- **Cause**: Cache invalidation or filter logic issue
- **Solution**: Check that `invoiceIdsWithDisputes` correctly excludes active disputes

**Problem**: Interest still accruing during dispute
- **Cause**: Dispute window calculation error
- **Solution**: Verify `mergeDisputeWindows` properly handles overlapping periods

**Problem**: Collector can't respond to dispute
- **Cause**: Tenant ID mismatch or missing authentication
- **Solution**: Ensure user authenticated with Replit Auth and belongs to correct tenant

---

## Summary

The Debtor Dispute System provides a complete workflow for managing invoice challenges:

- **Debtors** submit disputes through a self-service portal with live status tracking
- **Collectors** review and respond through the internal CRM with structured workflows
- **System** automatically excludes disputed invoices from collections and pauses interest
- **Database** maintains complete audit trail of dispute lifecycle and resolutions

The system is production-ready for dispute submission and resolution, with evidence upload planned as a future enhancement once object storage is configured.
