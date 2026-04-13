# ADDENDUM: The Cashflow Health Check — Interactive Quiz & Lead Generation

## ADD THIS TO CLAUDE_CODE_MARKETING_INTEGRATION.md as Step 3.15

---

### 3.15 Interactive Quiz — "The Cashflow Health Check"

Build an interactive scorecard quiz at `/cashflow-health-check` that scores a visitor's working capital cycle across three sections, captures their details as a lead, delivers a personalised results page, and rewards them with a free PDF copy of "The Cash Gap" by Simon Kramer.

---

### CONCEPT

**Title:** "The Cashflow Health Check"
**Subtitle:** "Score your working capital cycle in 2 minutes. Find out where cash is leaking from your business — and get a free copy of The Cash Gap to fix it."
**URL:** `/cashflow-health-check`

**The three sections mirror the working capital cycle and Qashivo's three pillars:**
1. **Credit Control** (maps to Qollections) — how you chase and collect
2. **Cashflow** (maps to Qashflow) — how you see and forecast cash
3. **Finance** (maps to Qapital) — how you fund gaps and manage working capital

---

### USER FLOW

```
1. Landing section — headline, value prop, "Start My Health Check" CTA
2. Lead capture form — name, email, company, role (BEFORE quiz)
3. Section 1: Credit Control — 4 questions, one per screen
4. Section 1 mini-result — instant score for Credit Control shown briefly
5. Section 2: Cashflow — 3 questions, one per screen
6. Section 2 mini-result — instant score for Cashflow
7. Section 3: Finance — 3 questions, one per screen
8. Full results page — overall score, breakdown by section, recommendations
9. Book delivery — "Your free copy of The Cash Gap is on its way" + PDF sent by email
10. CTA — "Book a Demo"
```

**Key UX detail:** After each section (not each question), show a brief animated mini-result — their score for that section appears with a colour indicator (red/amber/green) before transitioning to the next section. This creates three "reveal moments" that maintain engagement through the quiz.

---

### QUIZ QUESTIONS

Store all questions, answers, and scoring in `client/src/content/marketing.ts` so they can be edited without touching components.

---

#### SECTION 1: CREDIT CONTROL (4 questions)

Section intro screen:
- Icon: message/email
- Label: "SECTION 1 OF 3"
- Heading: "Credit Control"
- Subheading: "How do you chase and collect what you're owed?"

**Q1: "How do you currently chase overdue invoices?"**
- We don't really chase — we wait and hope (1)
- We send a manual email when we remember (2)
- We follow a template email sequence (3)
- We have a structured multi-channel process with escalation across email, SMS, and phone (4)

**Q2: "How quickly do you follow up when an invoice becomes overdue?"**
- We usually don't notice for weeks (1)
- Within a week or two (2)
- Within a few days (3)
- Automatically on the day it's due (4)

**Q3: "When a debtor replies with a dispute, query, or promise to pay — what happens?"**
- It probably gets lost in someone's inbox (1)
- We deal with it but there's no real system (2)
- We track it but follow-up is inconsistent (3)
- It's logged, categorised, and followed up systematically — with escalation to a human for complex cases (4)

**Q4: "How many communication channels do you use to chase debtors?"**
- Just email (1)
- Email and occasional phone calls (2)
- Email, phone, and sometimes SMS (3)
- Multiple channels — and we know which channel works best for each debtor (4)

**Section 1 max score: 16**

---

#### SECTION 2: CASHFLOW (3 questions)

Section intro screen:
- Icon: chart/trending
- Label: "SECTION 2 OF 3"
- Heading: "Cashflow"
- Subheading: "How well do you see and forecast your cash position?"

**Q5: "How well do you know your cash position right now — today?"**
- I'd have to check my bank account and guess (1)
- I have a rough idea from my accounting software (2)
- I review a cashflow report weekly (3)
- I have real-time visibility on cash in, cash out, and projected gaps (4)

**Q6: "Do you forecast your cashflow?"**
- No — we deal with problems as they come (1)
- We have a spreadsheet but it's usually out of date by Tuesday (2)
- We update a forecast monthly (3)
- We have a rolling forecast that updates automatically from live accounting data (4)

**Q7: "When did you last have a cashflow surprise — an unexpected shortfall?"**
- It happens regularly — almost every month (1)
- In the last month (2)
- In the last 6 months (3)
- Can't remember — we always see them coming (4)

**Section 2 max score: 12**

---

#### SECTION 3: FINANCE (3 questions)

Section intro screen:
- Icon: bank/building
- Label: "SECTION 3 OF 3"
- Heading: "Finance"
- Subheading: "How do you fund gaps and manage your working capital?"

**Q8: "When a cashflow gap appears, what do you do?"**
- Panic, delay payments, or dip into personal funds (1)
- Wait and hope a big invoice gets paid in time (2)
- Use an overdraft or existing credit facility (3)
- We have pre-arranged working capital options matched to our debtor book and cash cycle (4)

**Q9: "Do you know how much working capital your late-paying debtors are costing you?"**
- No idea (1)
- I know it's a problem but haven't quantified it (2)
- I have a rough estimate (3)
- Yes — I know the exact cash impact of every overdue day (4)

**Q10: "How do you decide which finance products are right for your business?"**
- I don't really understand the options (1)
- I ask my bank or accountant when things get tight (2)
- I've researched options but find it hard to compare (3)
- I have clear visibility on what's available, what I qualify for, and the right product for each situation (4)

**Section 3 max score: 12**

---

### SCORING

**Total max score: 40** (16 + 12 + 12)

**Section scores shown as percentage and rating:**
- 0-25%: Critical (Red — #EF4444)
- 26-50%: At Risk (Amber — #F59E0B)
- 51-75%: Good (Teal — #06B6D4)
- 76-100%: Excellent (Green — #10B981)

**Overall result tiers:**

**10-15 / 40: "Critical"** (Red)
- Headline: "Your working capital cycle has serious gaps"
- Summary: "Your credit control is mostly reactive, your cashflow visibility is limited, and you don't have structured options for funding gaps. Late payments are silently costing your business significant cash. The good news: the biggest improvements come from starting the basics — and they produce results within weeks."

**16-24 / 40: "At Risk"** (Amber)
- Headline: "Your working capital cycle has room to improve"
- Summary: "You have some processes in place, but gaps in your credit control, cashflow forecasting, or finance strategy mean cash is leaking through. You're doing better than most UK businesses, but there's a significant opportunity to tighten up and unlock working capital you didn't know you had."

**25-32 / 40: "Good"** (Teal)
- Headline: "Your working capital cycle is solid — with gaps to close"
- Summary: "You've built good foundations. The opportunity now is in connecting the pieces — linking your collection activity to cashflow forecasting, optimising which channels work for each debtor, and making sure your finance options match your actual cash cycle."

**33-40 / 40: "Excellent"** (Green)
- Headline: "Your working capital cycle is best-in-class"
- Summary: "You're ahead of the vast majority of UK businesses. The remaining opportunity is in intelligent automation — letting the system handle routine conversations while your team focuses on strategy and the relationships that matter most."

---

### RESULTS PAGE DESIGN

**Layout (scrollable single page, not a modal):**

1. **Score Header**
   - Large overall score: "Your Score: X / 40"
   - Overall tier badge with colour
   - Tier headline (e.g., "Your working capital cycle has room to improve")

2. **Section Breakdown — Three Cards in a Row**
   Each card shows:
   - Section name (Credit Control / Cashflow / Finance)
   - Score as a visual bar or circular progress (e.g., 10/16)
   - Section rating badge (Critical/At Risk/Good/Excellent)
   - One-line summary of their performance in that area
   Stack vertically on mobile.

3. **How You Compare**
   - "The average UK SME scores 17 out of 40."
   - "Businesses using Qashivo average 34 out of 40."
   - Visual bar showing their score vs average vs Qashivo users

4. **Your Personalised Recommendations**
   Three recommendation cards — one per section, tailored to their weakest area:
   - Each card has: section icon, section name, recommendation heading, 2-3 sentence recommendation
   - Recommendations come from a lookup based on their section score tier
   - Each recommendation naturally points toward what Qashivo solves (without being salesy)

5. **The Cash Gap Book Section**
   - Heading: "Your Free Copy of The Cash Gap"
   - Book cover image (placeholder — add `client/public/images/marketing/cash-gap-cover.png`)
   - Text: "The Cash Gap by Simon Kramer is the essential guide to closing the working capital gap in your business. Based on your Health Check results, chapters X, Y, and Z are particularly relevant to your situation."
   - "Your copy is being sent to [their email] now."
   - Secondary: "Also available in paperback on Amazon" with link (placeholder #)
   - The relevant chapter callout is dynamically chosen based on their weakest section:
     - Weakest = Credit Control → highlight credit control chapters
     - Weakest = Cashflow → highlight cashflow chapters
     - Weakest = Finance → highlight finance/working capital chapters
   - **NOTE:** Store chapter-to-section mapping in the CMS config so it can be updated as the book evolves

6. **CTA Section**
   - Heading: "Want to see your score improve?"
   - Subtext: "Book a 15-minute demo and we'll show you how Qashivo closes the gaps in your working capital cycle."
   - Primary CTA: "Book a Demo" → `/contact`
   - Secondary: "Share your score on LinkedIn" (nice to have — generates a text like "I just scored X/40 on the Cashflow Health Check by @Qashivo. Take yours free at qashivo.com/cashflow-health-check")

---

### PDF DELIVERY

On quiz completion, send an email via SendGrid (through `enforceCommunicationMode` wrapper):

**Subject:** "Your Cashflow Health Check Results + Free Copy of The Cash Gap"

**Email body:**
- Their name
- Overall score and tier
- Section breakdown (Credit Control X/16, Cashflow X/12, Finance X/12)
- "Based on your results, we recommend focusing on [weakest section] first."
- Attachment or download link: Full PDF of "The Cash Gap"
- CTA: "Book a Demo"

**PDF attachment:**
- Store the book PDF at `server/assets/the-cash-gap.pdf` (Simon will add the actual file)
- Attach to the SendGrid email as a PDF attachment
- If the file doesn't exist yet, include a placeholder message: "Your copy of The Cash Gap is being prepared and will be sent shortly."

---

### DATA SCHEMA

```sql
CREATE TABLE quiz_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  role TEXT,
  -- Section scores
  credit_control_score INTEGER,
  cashflow_score INTEGER,
  finance_score INTEGER,
  total_score INTEGER,
  -- Result tier
  credit_control_tier TEXT, -- 'critical' | 'at_risk' | 'good' | 'excellent'
  cashflow_tier TEXT,
  finance_tier TEXT,
  overall_tier TEXT,
  -- Raw data
  answers JSONB, -- full answer set: [{questionId, sectionId, answerId, score}]
  weakest_section TEXT, -- 'credit_control' | 'cashflow' | 'finance'
  -- Status
  completed BOOLEAN DEFAULT false,
  book_sent BOOLEAN DEFAULT false,
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API ENDPOINTS

```
POST /api/quiz/start
  Body: { fullName, email, companyName, role }
  Creates quiz_leads record
  Returns: { leadId }

POST /api/quiz/complete
  Body: { leadId, answers: [{questionId, sectionId, answerId, score}] }
  Calculates section scores, total score, tiers, weakest section
  Updates quiz_leads record
  Triggers email with results + book PDF
  Returns: { totalScore, creditControlScore, cashflowScore, financeScore, 
             overallTier, creditControlTier, cashflowTier, financeTier,
             weakestSection, recommendations }

GET /api/quiz/results/:leadId
  Returns results for email link / revisit
```

---

### WEBSITE INTEGRATION

**Navigation:** Don't add to main nav — it would crowd it. Instead:

**Home page — add a callout section** (between "Problems We Solve" / "You Stay in Charge" and the final CTA):
- Background: cool grey (#F1F5F9) or subtle teal tint
- Heading: "How Healthy Is Your Working Capital Cycle?"
- Subtext: "Take our free 2-minute health check. Get your score across credit control, cashflow, and finance — plus a free copy of The Cash Gap."
- Book cover thumbnail alongside the text
- CTA: "Take the Health Check →" → `/cashflow-health-check`

**Other pages:** Add a subtle inline CTA on Features and Why Qashivo pages linking to the quiz.

**Footer:** Add "Cashflow Health Check" link in the Product column of the footer.

---

### DESIGN NOTES

- The quiz should feel premium — same Manrope/Inter typography, navy/teal palette, surface layering as the rest of the website
- Answer cards should feel tactile: subtle background shift on hover, teal left border on selection, smooth 200ms transitions
- Section intro screens add breathing room and anticipation — don't skip them
- The mini-result after each section is a key engagement hook — animate the score counting up
- The results page should feel like receiving a professional diagnostic report, not a BuzzFeed quiz
- The book section should feel like a genuine gift, not a bait-and-switch — "Here's something valuable based on what we just learned about your business"

---

### DESIGN.md UPDATE

Add to Section 7:

```markdown
### Lead Generation — Cashflow Health Check
The quiz at `/cashflow-health-check` is the primary lead capture tool. It scores visitors across three sections of the working capital cycle (Credit Control, Cashflow, Finance) and delivers a personalised result plus a free copy of The Cash Gap. Design it as a premium branded experience — editorial typography, navy/teal palette, surface layering. The results page must feel like a professional diagnostic report. Answer cards use tactile interactions (hover shifts, teal selection border, smooth transitions). Section transitions show mini-results with animated score reveals.
```
