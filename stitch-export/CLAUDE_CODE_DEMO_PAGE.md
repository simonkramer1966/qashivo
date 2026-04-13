# CLAUDE CODE SESSION: Add Demo Page to Qashivo Website

## OBJECTIVE

Add an interactive voice demo page at `/demo` to the Qashivo marketing website. The page lets prospects experience a live credit control voice call from Qashivo. The design comes from a Stitch HTML export. Wire up the form to trigger a Retell AI voice call, and display real-time intelligence extraction after the call completes.

---

## STEP 1: READ THE SOURCE FILES

Read these files:
- `~/Documents/qashivo/stitch-export/demo_code.html` — the Stitch HTML export for the demo page
- `~/Documents/qashivo/stitch-export/demo_screen.png` — visual reference screenshot
- The existing marketing pages for design consistency reference

**NOTE:** The file may be named `1774951630172_code.html` — rename it to `demo_code.html` in stitch-export/ or read whatever filename is there.

---

## STEP 2: WHAT TO KEEP AND WHAT TO REMOVE FROM THE STITCH EXPORT

### REMOVE — the top two cards section:
The Stitch export has two cards at the very top of the page (above the "INTERACTIVE DEMO" hero text):
- Left card: "Live Intelligence / AX-902 Connection" with Intent Score, Speaker Emotion, and Quick Respond Link
- Right card: Dark navy visualiser with "Intelligence Report Generated" checkmark

**DELETE this entire section.** The page should start with the "INTERACTIVE DEMO" hero text.

### KEEP — everything else:
- Hero: "INTERACTIVE DEMO" label + "The future of automated recovery." headline + subtitle
- Two-column form + visualiser section (Experience Qashivo form left, Credit Control Insights right)
- Call Intelligence Report section with four metric cards
- Intelligence Transcript + Intelligence Actions two-column section
- Bottom CTA section

### CHANGE — bottom CTA text:
Replace:
- "Stop chasing, start forecasting." → "Imagine This Working on Every Overdue Invoice. Automatically."
- "Join hundreds of CFOs using Qashivo to recover 40% more cash with autonomous, empathetic intelligence." → "Qashivo handles credit control calls, extracts intelligence, and updates your cashflow forecast. All without you picking up the phone."
- "Book Professional Demo" button → "Book a Demo" → links to /contact
- "Financial Health Check" button → "Take the Health Check" → links to /cashflow-health-check

---

## STEP 3: CREATE THE PAGE

Create `client/src/pages/marketing/DemoPage.tsx`

Convert the Stitch HTML to a React component following the same patterns as the other marketing pages:
- Use MarketingLayout wrapper
- Use the project's Tailwind config (not CDN)
- Convert HTML attributes to React (class → className, etc.)
- Extract custom CSS into marketing.css
- Wire up all links with React Router Link components
- Preserve all animations (waveform, glow pulses, stagger loads, fade-ins)

### Design consistency:
- Use the same MarketingNav and MarketingFooter as other pages
- Ensure typography, spacing, and colour tokens match the rest of the website
- The page should feel premium and world-class — this is the most impressive page on the site

---

## STEP 4: ADD TO NAVIGATION AND ROUTING

### Router:
Add `/demo` → MarketingLayout → DemoPage

### Navigation:
Add "Demo" to the marketing nav between "Why Qashivo" and "Pricing". It should be visually highlighted — either a different colour or a small badge to draw attention:
- Option A: Teal text instead of the standard grey
- Option B: Small "NEW" or "LIVE" badge next to the link
- Choose whichever looks better with the existing nav design

### SEO meta:
```
title: "Live Demo — Experience Qashivo's Credit Controller"
description: "Receive a live credit control call from Qashivo. Play the debtor, respond naturally, and watch real-time intelligence being extracted — intent, sentiment, commitment, and cashflow impact."
canonical: "https://qashivo.com/demo"
```

---

## STEP 5: WIRE UP THE VOICE CALL FORM

### Form behaviour:
The left card has a form with Name and Phone Number. On clicking "Call Me Now":

1. Validate: name is required, phone number is required and valid
2. Show loading state on the button ("Calling..." with spinner)
3. POST to a new endpoint: `POST /api/demo/start-call`
4. The endpoint triggers a Retell AI call to the prospect's phone number
5. While the call is active, the right panel visualiser activates (waveform animation)
6. When the call ends, display the results

### Backend endpoint:

Create `server/routes/demoRoutes.ts`:

```
POST /api/demo/start-call
  Body: { name: string, phoneNumber: string }
  
  Actions:
  1. Validate inputs
  2. Format phone number (ensure +44 prefix for UK numbers)
  3. Call Retell AI API to initiate an outbound call:
     - Use the existing Retell AI integration patterns in the codebase
     - The AI agent persona should be a credit controller calling about an overdue invoice
     - Pass the prospect's name to personalise the call
  4. Store the demo session in a new demo_calls table
  5. Return: { callId, status: 'initiated' }

GET /api/demo/call-status/:callId
  Returns the current call status (ringing, active, completed, failed)
  
GET /api/demo/call-results/:callId  
  After call completion, returns:
  - transcript (array of messages with speaker, text, timestamp)
  - intentScore (0-100)
  - sentiment (hostile/resistant/neutral/constructive/cooperative)
  - commitmentLevel (none/low/medium/medium-high/high)
  - cashflowImpact: { amount, expectedDate, confidence }
  - recommendedActions: array of action objects
  - riskInsights: array of insight objects
```

### Database schema:

```sql
CREATE TABLE demo_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  retell_call_id TEXT,
  status TEXT DEFAULT 'initiated', -- initiated, ringing, active, completed, failed
  transcript JSONB,
  intent_score INTEGER,
  sentiment TEXT,
  commitment_level TEXT,
  cashflow_impact JSONB,
  recommended_actions JSONB,
  risk_insights JSONB,
  call_duration_seconds INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Rate limiting:
- Maximum 3 demo calls per phone number per 24 hours
- Maximum 10 demo calls per IP per 24 hours
- Calls are limited to 3 minutes duration

---

## STEP 6: FRONTEND INTERACTIVITY

### Pre-call state:
- Visualiser shows dormant waveform (gentle breathing animation)
- Four metric tiles show "Pending Connection", "Waiting...", "—", "00:00"
- Form is active and editable

### During-call state (poll GET /api/demo/call-status/:callId every 2 seconds):
- "Call Me Now" button changes to "Call in Progress..." (disabled)
- Waveform animation becomes active and dynamic
- Call Duration timer counts up
- If the Retell API provides real-time events (via webhook), update the intent/sentiment/commitment tiles live as they're detected
- If real-time updates aren't available from Retell, show animated "Analyzing..." states on the tiles

### Post-call state (when status = completed):
- Fetch results from GET /api/demo/call-results/:callId
- Waveform settles, green checkmark appears
- Smooth scroll down to reveal the Call Intelligence Report section
- Populate the four metric cards with real data from the call
- Populate the transcript section with the real transcript
- Populate the Intelligence Actions with generated recommendations
- The "CASHFLOW UPDATE" / "TREASURY FORECAST" card should highlight with a teal glow animation
- The Risk Insight card should populate with any patterns detected

### Fallback (if Retell API is unavailable or call fails):
- Show the pre-populated sample data from the Stitch export as a "sample report"
- Display message: "We couldn't connect the call right now. Here's a sample intelligence report from a recent Qashivo call."
- The form should offer retry: "Try Again" button

---

## STEP 7: RETELL AI INTEGRATION

Check the existing Retell AI integration in the codebase (it's already used for the app's voice calling). The demo page should use the same Retell API client but with a specific demo agent configuration.

### Demo agent prompt (for Retell AI):
The voice agent should behave as a professional credit controller calling about an overdue invoice. Key behaviours:
- Introduce themselves: "Good afternoon, this is [agent name] calling on behalf of [company name] regarding invoice [number] for [amount]"
- Ask about payment timing
- Handle objections professionally (ERP delays, cashflow issues, disputes)
- Offer solutions (payment links, payment plans, partial payments)
- Confirm any commitments made
- Be professional, calm, and empathetic — never aggressive
- Keep the call under 3 minutes

### Environment variables needed:
```
RETELL_API_KEY — already exists in Railway
RETELL_DEMO_AGENT_ID — the agent ID for the demo persona (Simon to configure in Retell dashboard)
```

If RETELL_DEMO_AGENT_ID doesn't exist yet, add a placeholder and log a clear message: "RETELL_DEMO_AGENT_ID not configured — demo calls will use sample data fallback"

---

## STEP 8: VERIFY

1. [ ] Demo page renders at /demo
2. [ ] "Demo" appears in navigation between "Why Qashivo" and "Pricing"
3. [ ] Top two cards from Stitch export are removed — page starts with hero
4. [ ] Bottom CTA text reads "Imagine This Working on Every Overdue Invoice. Automatically."
5. [ ] Form validates name and phone number
6. [ ] "Call Me Now" triggers POST /api/demo/start-call
7. [ ] Waveform animation works (dormant, active, and completion states)
8. [ ] Call Intelligence Report section displays with four metric cards
9. [ ] Transcript section displays with speaker labels and intent badges
10. [ ] Intelligence Actions display with the three action cards + Risk Insight
11. [ ] Fallback sample data displays if Retell API is unavailable
12. [ ] Page is mobile responsive
13. [ ] Design is consistent with the rest of the marketing website
14. [ ] CTA buttons link correctly (/contact and /cashflow-health-check)
15. [ ] ScrollToTop works when navigating to /demo
16. [ ] demo_calls table migration pushed
17. [ ] Rate limiting on demo calls works
18. [ ] No build errors or console warnings

---

## CRITICAL RULES

1. **Remove the top two cards** — the page starts with the "INTERACTIVE DEMO" hero, NOT the Live Intelligence / AX-902 cards
2. **Preserve the Stitch design exactly** for everything else — the visual design is approved
3. **Use existing patterns** — follow the same component, routing, and API patterns used in the rest of the marketing pages and quiz
4. **Use enforceCommunicationMode** — if any emails or SMS are triggered from the demo, use the existing communication wrapper
5. **Fallback gracefully** — if Retell isn't configured, show sample data. Never show a broken page.
6. **Design consistency** — this page must feel like part of the same website. Same nav, footer, typography, spacing, colour tokens.
7. **This page should be world-class** — it's the most impressive page on the site. The waveform visualiser, the live intelligence extraction, the transcript with inline badges, the Risk Insight card — all of these should feel premium and polished.
