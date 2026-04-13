# Qashivo Security & Compliance Scan — 6 April 2026

## Summary

| Category | Status | Findings |
|----------|--------|----------|
| Secrets & Key Exposure | 🟡 | 1 warning (settings.local.json creds) |
| Unprotected Endpoints | 🔴 | 5 critical, 6 warnings |
| Communication Safety | 🔴 | 1 critical (prospectScorecardRoutes bypass) |
| Xero API Compliance | 🔴 | 1 critical (unencrypted tokens at rest) |
| GDPR & Data Protection | 🟡 | 2 warnings (PII in logs, error messages) |
| Database Security | ✅ | Tenant isolation verified |
| Infrastructure | 🟡 | 2 warnings (test endpoints in prod, CSRF) |
| FCA Compliance | 🔵 | Audit trail present, no new concerns |
| CIE Privacy | N/A | CIE not yet implemented |

**Critical issues:** 7
**Warnings:** 10
**Last scan:** First automated scan

---

## Critical Findings (fix immediately)

### 1. Direct sgMail.send() bypasses communication mode
**Category:** Communication Safety
**File:** `server/routes/prospectScorecardRoutes.ts` (line ~156)
**Risk:** Scorecard confirmation emails bypass `enforceCommunicationMode()` — sends to real addresses even when tenant is in testing mode.
**Fix:** Replace direct `sgMail.send()` with `sendEmail()` wrapper from `server/services/sendgrid.ts`.

### 2. Xero OAuth tokens stored unencrypted in database
**Category:** Xero API Compliance / GDPR
**File:** `shared/schema.ts` — `xeroAccessToken`, `xeroRefreshToken` as plain `text()`
**Risk:** Database breach exposes Xero API credentials in plaintext. Token encryption infrastructure exists (`server/utils/tokenEncryption.ts`) but is not applied to Xero tokens on the tenants table.
**Fix:** Apply `encryptToken()` on write and `decryptToken()` on read for Xero tokens. Migration needed for existing tokens.

### 3. Unprotected public demo endpoints with minimal validation
**Category:** Unprotected Endpoints
**File:** `server/routes/demoRoutes.ts`
**Risk:** `POST /api/demo/start-call` accepts arbitrary name/phone with weak validation. Rate limiting by IP (30/24h) is the only control. Demo call results (`/api/demo/call-results/:callId`) lack tenant isolation — any callId returns data.
**Fix:** Add stricter input validation (Zod schemas). Add tenant-scoped lookups for call results.

### 4. Token enumeration in invite system
**Category:** Unprotected Endpoints
**File:** `server/routes/partnerRoutes.ts` (lines 555, 615, 711)
**Risk:** Invite verification returns different responses for valid vs invalid tokens, enabling enumeration of invite tokens and discovery of SME client IDs.
**Fix:** Return uniform responses regardless of token validity. Rate limit verification attempts.

### 5. Unprotected Xero OAuth callback endpoints
**Category:** Unprotected Endpoints
**File:** `server/routes/integrationRoutes.ts` (lines 484, 500, 579)
**Risk:** OAuth callbacks `/api/xero/callback`, `/api/xero/test-callback`, `/api/xero/mock-auth` have no authentication. State parameter uses base64-encoded data (easily decodable).
**Fix:** Cryptographically sign state tokens. Gate test/mock endpoints behind `NODE_ENV !== 'production'`.

### 6. Public SME onboarding token leakage
**Category:** Unprotected Endpoints
**File:** `server/routes/partnerRoutes.ts` (lines 711, 779, 831)
**Risk:** Access tokens passed in query strings for GET requests — leaks in browser history, logs, referrer headers.
**Fix:** Pass tokens in POST body or use session-bound authentication.

### 7. Missing tenant isolation on demo calls
**Category:** Unprotected Endpoints
**File:** `server/routes/demoRoutes.ts` (line ~312)
**Risk:** `storage.getDemoCall(callId)` has no tenantId filter — any caller can access any demo call transcript/analysis.
**Fix:** Add tenantId validation to demo call lookups.

---

## Warnings

### 8. .claude/settings.local.json contains production credentials
**Category:** Secrets
**Risk:** Database connection string with password embedded in local dev file. Not in git, but risk if directory shared.
**Fix:** Scrub credentials from settings.local.json. Add `.claude/` to .gitignore.

### 9. PII logged in plain text during Xero sync
**Category:** GDPR
**Files:** `server/services/xeroSync.ts` (lines 275, 336, 389, 453, 540)
**Risk:** Contact names appear in console.log during sync operations.
**Fix:** Use contact IDs instead of names in log messages.

### 10. API error messages may expose PII
**Category:** GDPR
**Files:** `server/sync/adapters/XeroAdapter.ts` (lines 142, 735, 740)
**Risk:** Error messages include up to 500 chars of raw API response.
**Fix:** Sanitize error messages; use coded error strings.

### 11. Missing CSRF protection on state-changing operations
**Category:** Infrastructure
**Risk:** No CSRF token validation on POST/PATCH/DELETE endpoints.
**Fix:** Implement CSRF token generation/validation middleware.

### 12. Xero test/mock endpoints accessible in production
**Category:** Infrastructure
**Files:** `server/routes/integrationRoutes.ts` — `/api/xero/test-callback`, `/api/xero/mock-auth`
**Fix:** Gate behind `NODE_ENV !== 'production'` check.

### 13. Missing rate limiting on invite acceptance
**Category:** Unprotected Endpoints
**File:** `server/routes/partnerRoutes.ts` (line 615)
**Fix:** Implement exponential backoff after failed attempts.

### 14. Weak input validation on demo endpoints
**Category:** Unprotected Endpoints
**File:** `server/routes/demoRoutes.ts` (lines 155-166)
**Fix:** Use Zod schemas for strict name/phone validation.

### 15. OAuth state uses decodable base64
**Category:** Unprotected Endpoints
**File:** `server/routes/partnerRoutes.ts` (line 805)
**Fix:** Use cryptographically signed state tokens with server-side storage.

### 16. Public partner waitlist endpoint lacks CAPTCHA
**Category:** Unprotected Endpoints
**File:** `server/routes/miscRoutes.ts` — `POST /api/public/partner-waitlist`
**Fix:** Add CAPTCHA validation and stricter rate limiting.

### 17. Admin auth relies solely on user flag
**Category:** Unprotected Endpoints
**File:** `server/routes/adminRoutes.ts` (line 194)
**Fix:** Verify platformAdmin flag against database on each request.

---

## Informational

### 18. Token encryption TODO comment is stale
**File:** `shared/schema.ts` — comment says tokens should be encrypted, but `tokenEncryption.ts` already exists. Apply it.

### 19. SendGrid webhook verification uses X-Forwarded-For
**File:** `server/routes/webhooks.ts`
**Risk:** Header spoofable. Consider SendGrid's official signed webhook verification.

---

## Clean Categories

- **Database Security**: Tenant isolation verified across all query patterns. All queries filter by tenantId. Drizzle ORM provides parameterised queries by default.
- **API Key Isolation**: Anthropic API key server-side only. Only public Clerk key on frontend. Token encryption infrastructure exists.
- **.gitignore**: Properly excludes .env and .env.* files. .env confirmed not in git history.
- **Communication Wrappers (all except scorecard)**: Email, SMS, and voice all route through central wrappers that fail closed. Test mode defaults for new tenants. SSE + sync module verified clean.

---

## Recommendations for Next Session

**P0 (fix immediately):**
1. Route `prospectScorecardRoutes.ts` email through `sendEmail()` wrapper
2. Encrypt Xero tokens at rest (apply existing tokenEncryption.ts)
3. Add tenant isolation to demo call lookups

**P1 (fix this sprint):**
4. Gate test/mock Xero endpoints behind NODE_ENV check
5. Cryptographically sign OAuth state parameters
6. Uniform responses for invite token verification (prevent enumeration)
7. Remove PII from sync log messages

**P2 (backlog):**
8. CSRF protection middleware
9. CAPTCHA on public waitlist endpoint
10. SendGrid signed webhook verification

---

*Scan performed: 6 April 2026 (automated Monday run)*
*Scanner: Documentation Coworker (Claude Cowork)*
*Next scheduled scan: 13 April 2026*
