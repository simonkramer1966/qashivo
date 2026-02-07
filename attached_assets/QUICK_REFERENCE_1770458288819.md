# Demo Xero System - Quick Reference Cheat Sheet

## 🚀 Quick Setup (5 minutes)

```bash
# 1. Copy files to project
cp xero-response-formats.ts server/services/xero/
cp demoXeroCompany.ts server/services/xero/
cp demoXeroInterceptor.ts server/services/xero/

# 2. Add to server startup (server/index.ts)
import { DemoXeroInterceptor } from './services/xero/demoXeroInterceptor';
DemoXeroInterceptor.initialize(); // Add this line

# 3. Modify Xero service (see INTEGRATION_GUIDE.ts)

# 4. Add routes (copy from COMPLETE_EXAMPLE.ts)

# 5. Done! Test it:
curl http://localhost:5000/api/demo/xero-companies
```

## 📊 Common Commands

### List Demo Companies
```bash
curl http://localhost:5000/api/demo/xero-companies
```

### Create Demo Company
```bash
# SaaS (reliable, monthly billing)
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1", "archetype": "SaaS"}'

# Construction (slow payer, large invoices)
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-construction-1", "archetype": "Construction"}'

# Retail (mixed behavior, frequent orders)
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-retail-1", "archetype": "Retail"}'
```

### Simulate Trading
```bash
# 7 days (default)
curl -X POST http://localhost:5000/api/demo/simulate-trading \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1", "days": 7}'

# 30 days (month)
curl -X POST http://localhost:5000/api/demo/simulate-trading \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1", "days": 30}'

# 90 days (quarter)
curl -X POST http://localhost:5000/api/demo/simulate-trading \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1", "days": 90}'
```

### Create Single Events
```bash
# New invoice
curl -X POST http://localhost:5000/api/demo/create-invoice \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1"}'

# Payment received
curl -X POST http://localhost:5000/api/demo/receive-payment \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1"}'

# Payment for specific invoice
curl -X POST http://localhost:5000/api/demo/receive-payment \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1", "invoiceId": "invoice-uuid-here"}'
```

### Manual Sync
```bash
curl -X POST http://localhost:5000/api/demo/sync-xero-data \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-saas-1"}'
```

### Clear Demo Company
```bash
curl -X DELETE http://localhost:5000/api/demo/xero-company/demo-saas-1
```

## 🎯 Quick Test Scenarios

### Test Collections Automation
```bash
# 1. Create slow-paying construction company
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-slow-1", "archetype": "Construction"}'

# 2. Verify overdue invoices exist
# Check your dashboard or database

# 3. Run collections automation
# Your existing workflow should work
```

### Test Payment Learning
```bash
# 1. Create mixed-behavior retail company
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-learn-1", "archetype": "Retail"}'

# 2. Simulate 90 days
curl -X POST http://localhost:5000/api/demo/simulate-trading \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-learn-1", "days": 90}'

# 3. Check learning profiles
# Should show payment patterns
```

### Test Cash Flow Forecasting
```bash
# 1. Create struggling wholesale company
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-forecast-1", "archetype": "Wholesale"}'

# 2. Check forecast
# Should show high-risk cash position
```

## 🔍 Database Queries

```sql
-- Check demo data synced correctly
SELECT tenant_id, COUNT(*) as invoice_count
FROM invoices
WHERE tenant_id LIKE 'demo-%'
GROUP BY tenant_id;

-- View unpaid invoices
SELECT invoice_number, contact_name, total, amount_due, due_date
FROM invoices
WHERE tenant_id = 'demo-saas-1'
  AND amount_due > 0
ORDER BY due_date;

-- Check payment history
SELECT p.date, p.amount, i.invoice_number, i.contact_name
FROM payments p
JOIN invoices i ON p.invoice_id = i.xero_invoice_id
WHERE p.tenant_id = 'demo-saas-1'
ORDER BY p.date DESC
LIMIT 10;

-- Calculate outstanding by contact
SELECT contact_name, 
       COUNT(*) as invoice_count,
       SUM(amount_due) as total_outstanding
FROM invoices
WHERE tenant_id = 'demo-saas-1'
  AND amount_due > 0
GROUP BY contact_name
ORDER BY total_outstanding DESC;
```

## 📋 Business Archetypes Quick Ref

| Archetype | Invoice Pattern | Payment Behavior | Avg Invoice | Best For Testing |
|-----------|----------------|------------------|-------------|------------------|
| **SaaS** | Monthly recurring | 95% on-time | £2,500 | Predictable revenue, subscription models |
| **Construction** | Quarterly milestones | 40% late | £45,000 | Large invoices, payment delays, escalation |
| **Retail** | Weekly orders | 60% on-time | £8,500 | Frequent billing, mixed behavior |
| **Manufacturing** | Bi-weekly batches | 85% on-time | £18,000 | B2B relationships, reliability |
| **Professional Services** | Ad-hoc projects | Mixed | £12,000 | Irregular billing, varied projects |
| **Wholesale** | Weekly orders | 50% late | £15,000 | Cash flow issues, credit management |

## 💡 Pro Tips

### 1. Naming Convention
```bash
# Use descriptive tenant IDs
demo-saas-reliable-1
demo-construction-slow-1
test-collections-1
demo-retail-mixed-behavior-1
```

### 2. Gradual Simulation
```bash
# Don't simulate too much at once
# Good: 7-30 day increments
curl ... -d '{"tenantId": "demo-saas-1", "days": 30}'

# Avoid: Generating years of data
curl ... -d '{"tenantId": "demo-saas-1", "days": 365}' # Too much!
```

### 3. Test Edge Cases
```bash
# Create multiple archetypes to test different scenarios
for archetype in SaaS Construction Retail Manufacturing; do
  curl -X POST http://localhost:5000/api/demo/setup-xero-company \
    -H "Content-Type: application/json" \
    -d "{\"tenantId\": \"demo-${archetype,,}-1\", \"archetype\": \"$archetype\"}"
done
```

### 4. Reset Between Tests
```bash
# Clear specific tenant
curl -X DELETE http://localhost:5000/api/demo/xero-company/demo-saas-1

# Or in code: reset all
DemoXeroInterceptor.resetAll();
```

## 🐛 Troubleshooting

### Data Not Appearing?
```bash
# Check server logs for:
# "Intercepting Xero API call" - means it's working
# "Using demo data" - confirms demo tenant

# Verify tenant ID matches exactly
curl http://localhost:5000/api/demo/xero-companies | grep "my-tenant-id"

# Force sync
curl -X POST http://localhost:5000/api/demo/sync-xero-data \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "my-tenant-id"}'
```

### Wrong Payment Behavior?
```typescript
// Adjust in demoXeroCompany.ts:
private static shouldBePaid(...) {
  const probabilities = {
    reliable: 0.95,  // Increase for more payments
    slow: 0.40,      // Decrease for fewer payments
    // ...
  };
}
```

### Need More Contacts?
```bash
# Create with custom count
const company = DemoXeroInterceptor.createCompany(
  'tenant-id',
  'SaaS',
  { contactCount: 20 }  // More contacts
);
```

## 📚 File Locations

```
server/
├── index.ts                          # Add DemoXeroInterceptor.initialize()
├── routes.ts                         # Add demo management routes
└── services/
    └── xero/
        ├── xero.ts                   # Modify to check for demo tenants
        ├── xero-response-formats.ts  # Type definitions (NEW)
        ├── demoXeroCompany.ts        # Company generator (NEW)
        └── demoXeroInterceptor.ts    # Interceptor (NEW)
```

## 🎓 Learning Path

1. **Day 1:** Setup and create first demo company
2. **Day 2:** Test basic sync and data flow
3. **Day 3:** Simulate trading, verify collections automation
4. **Day 4:** Test all 6 archetypes, compare behaviors
5. **Day 5:** Integrate with frontend, build demo selector UI

## 🚨 Important Notes

- ✅ Demo data uses separate tenant IDs - won't mix with real data
- ✅ All Xero API formats match exactly - no code changes needed
- ✅ Can create unlimited demo companies
- ✅ Simulation is deterministic - same archetype = similar patterns
- ⚠️ Don't use production tenant IDs for demo companies
- ⚠️ Clear demo data regularly to keep database clean
- ⚠️ Simulating >90 days at once may create too much data

## 🆘 Getting Help

1. Check server console logs for intercept messages
2. Review `INTEGRATION_GUIDE.ts` for detailed wiring
3. See `COMPLETE_EXAMPLE.ts` for full implementation
4. Test with curl commands before building UI
5. Verify database has the synced data

## 🎉 Success Checklist

- [ ] DemoXeroInterceptor.initialize() called at startup
- [ ] Server logs show "Demo Xero companies initialized"
- [ ] Can list demo companies via API
- [ ] Can create new demo company
- [ ] Sync pulls data into database
- [ ] Dashboard shows demo data
- [ ] Collections automation works with demo data
- [ ] Can simulate trading activity
- [ ] New invoices and payments appear after simulation
- [ ] Can clear demo companies when done
