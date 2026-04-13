# CLAUDE CODE SESSION: Integrate Stitch Marketing Pages into Qashivo

## OBJECTIVE
Integrate 5 pre-designed marketing pages (exported from Google Stitch as HTML) into the existing Qashivo React/Vite monolith. The marketing pages become the public-facing website. The existing app pages remain unchanged behind authentication. Place DESIGN.md at the project root and keep it in sync with any design changes.

---

## STEP 0: PREPARATION

### 0.1 Read the source files
The Stitch exports are in `~/Documents/qashivo/stitch-export/`. Read all of these:
- `home_code.html` — Home page ("Get Paid Faster. Automatically.")
- `features_code.html` — Features page ("Elite Infrastructure for Cashflow Performance")
- `why_code.html` — Why Qashivo page ("Stop Losing Cash to Inefficiency")
- `pricing_code.html` — Pricing page ("Pricing that scales with your ambition")
- `contact_code.html` — Contact page ("Direct Access to Market-Leading Cashflow")
- `DESIGN.md` — Design system specification
- `home_screen.png`, `features_screen.png`, `why_screen.png`, `pricing_screen.png`, `contact_screen.png` — Visual reference screenshots

### 0.2 Place DESIGN.md at root
Copy `DESIGN.md` to the project root (`~/Documents/qashivo/DESIGN.md`). This file is the design system source of truth. Any time marketing page styles are changed, DESIGN.md must be updated to reflect the change.

### 0.3 Read project structure
Read CLAUDE.md and understand the existing router setup, layout components, and Tailwind configuration before making any changes.

---

## STEP 1: UNIFIED DESIGN TOKENS

**IMPORTANT:** Stitch generated slightly different Tailwind configs for each page. You MUST merge them into ONE unified config for the marketing pages. Use DESIGN.md as the authoritative source.

### Unified colour tokens (merge of all 5 pages):
```
primary:                  #0F172A    (deep navy — used across all pages)
primary-container:        #0F172A    (same as primary for dark sections)
on-primary:               #ffffff
on-primary-fixed:         #0F172A    (dark text on light backgrounds)
on-primary-container:     #334155
secondary:                #06B6D4    (electric teal — the brand accent)
secondary-container:      #06B6D4
secondary-fixed:          #22D3EE    (lighter teal)
secondary-fixed-dim:      #22D3EE
on-secondary:             #ffffff
tertiary:                 #D97706    (amber)
tertiary-fixed:           #FBBF24
tertiary-fixed-dim:       #F59E0B
surface:                  #F7F9FB    (page background — slight blue tint)
surface-container-lowest: #FFFFFF    (cards, focused content)
surface-container-low:    #F2F4F6    (alt sections)
surface-container:        #ECEEF0    (sidebars)
surface-container-high:   #E2E8F0    (wells, insets)
surface-container-highest:#CBD5E1
surface-bright:           #FFFFFF
surface-dim:              #E2E8F0
surface-variant:          #F1F5F9
on-surface:               #191C1E    (primary text — NOT pure black)
on-surface-variant:       #475569    (secondary text)
on-background:            #191C1E
outline:                  #64748B
outline-variant:          #CBD5E1
error:                    #EF4444
error-container:          #FEE2E2
inverse-surface:          #1E293B
inverse-on-surface:       #F8FAFC
teal-brand:               #06B6D4    (explicit teal alias — some pages use this)
amber-brand:              #F59E0B    (explicit amber alias)
```

### Unified typography:
```
Fonts: Manrope (headlines, display) + Inter (body, labels)
- Import BOTH from Google Fonts
- headline font-family: ["Manrope", "sans-serif"]
- body font-family: ["Inter", "sans-serif"]
- label font-family: ["Inter", "sans-serif"]
```
NOTE: The home page Stitch export only uses Inter — when converting it to React, apply the Manrope/Inter split to match the other 4 pages.

### Unified border radius:
```
DEFAULT: 0.5rem (8px)
lg: 0.5rem
xl: 0.75rem (12px)
full: 9999px
```

### Material Symbols Outlined
All pages use Google's Material Symbols Outlined icon font. Add the import:
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```
And the base style:
```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

---

## STEP 2: FILE STRUCTURE

Create the following structure. Do NOT modify any existing app files.

```
client/src/
├── layouts/
│   └── MarketingLayout.tsx              (NEW — shared nav + footer wrapper)
├── pages/
│   └── marketing/
│       ├── HomePage.tsx                 (NEW — from home_code.html)
│       ├── FeaturesPage.tsx             (NEW — from features_code.html)
│       ├── WhyQashivoPage.tsx           (NEW — from why_code.html)
│       ├── PricingPage.tsx              (NEW — from pricing_code.html)
│       └── ContactPage.tsx              (NEW — from contact_code.html)
├── components/
│   └── marketing/
│       ├── MarketingNav.tsx             (NEW — extracted from Stitch nav)
│       └── MarketingFooter.tsx          (NEW — extracted from Stitch footer)
└── styles/
    └── marketing.css                    (NEW — shared custom styles from Stitch)

Project root:
├── DESIGN.md                            (NEW — design system spec)
```

---

## STEP 3: CONVERSION RULES

When converting each Stitch HTML file to a React component, follow these rules exactly:

### 3.1 Preserve the HTML structure EXACTLY
The Stitch output is the approved design. Do NOT reorganise sections, change spacing, alter typography classes, or "improve" the layout. The screenshots are the visual target — the React output must match them pixel-for-pixel.

### 3.2 Extract shared elements
The nav bar and footer appear in every page with minor variations (active link differs). Extract them into `MarketingNav.tsx` and `MarketingFooter.tsx`. The nav should:
- Accept a `currentPage` prop to highlight the active link
- Use React Router `<Link to="...">` instead of `<a href="#">`
- Route mapping:
  - Home → `/`
  - Features → `/features`
  - Why Qashivo → `/why-qashivo`
  - Pricing → `/pricing`
  - Contact → `/contact`
  - "Book a Demo" / "Request Demo" button → `/contact`
  - Login (add this link if not present) → `/login` (existing app auth route)
- Include mobile hamburger menu (the Stitch exports only show desktop nav — add a responsive hamburger that shows on `md:hidden` with a slide-out menu)

### 3.3 Replace Tailwind CDN with project Tailwind
The Stitch exports load Tailwind from CDN (`<script src="https://cdn.tailwindcss.com">`). Remove this. The project already has Tailwind configured via Vite. Instead:
- Merge the unified colour tokens from Step 1 into the project's `tailwind.config.ts` under an `extend.colors` section. Use a namespace or prefix if needed to avoid conflicts with existing app tokens.
- Add the font families to `extend.fontFamily`
- Add the border radius values to `extend.borderRadius`

### 3.4 Collect custom CSS
Each Stitch page has custom `<style>` blocks with CSS for things like `.nav-link::after`, `.gradient-hero`, `.blueprint-grid`, `.dot-grid`, `.node-connection`, `.node`, `.node-line`, glassmorphism effects, and keyframe animations. Merge ALL of these into a single `marketing.css` file. Import this file in `MarketingLayout.tsx`.

### 3.5 Handle the external image
The Why Qashivo page has one external image from `lh3.googleusercontent.com` (London cityscape). Download this image and save it to `client/public/images/marketing/london-skyline.jpg`. Update the `src` to `/images/marketing/london-skyline.jpg`.

### 3.6 Handle inline SVGs
The Home and Features pages have inline SVGs (node network graphics). Preserve these exactly as JSX — convert HTML attributes to React syntax (e.g., `class` → `className`, `stroke-width` → `strokeWidth`, `fill-opacity` → `fillOpacity`, etc.).

### 3.7 Wire up all links and CTAs
Every button and link must go somewhere:
- "Book a Demo" / "Request Demo" / "Book Technical Demo" / "Book Operational Demo" → `/contact`
- "Request Professional Consultation" (contact form submit) → frontend-only for now (prevent default, show success message)
- "Start 14-Day Trial" / "Start Free Trial" → `/contact` (for now)
- "Contact Sales" → `/contact`
- "View Case Studies" / "Technical Overview" → `#` with `{/* TODO: wire up */}`
- "View Implementation Costs" / "Pricing Models" → `/pricing`
- "Technical Features" → `/features`
- Footer nav links → their respective marketing routes
- "Privacy Policy" / "Data Processing" / "GDPR" / "Terms" → `#` with `{/* TODO: create legal pages */}`
- "LinkedIn" → `https://www.linkedin.com/company/qashivo` (or placeholder `#`)
- "Documentation" links on home page pillar cards → `/features`
- "Claim This Capital" on pricing ROI calculator → `/contact`
- Any email addresses (solutions@qashivo.com, hello@qashivo.com) → `mailto:` links

### 3.8 Pricing page interactivity
The pricing page has two interactive elements that need React state:
1. **Monthly/Annual toggle** — switches prices between monthly and annual (annual = 20% discount). Use `useState` for the toggle. Monthly prices: Starter £99, Growth £199, Scale £399. Annual prices: Starter £79, Growth £159, Scale £319.
2. **ROI calculator** — two sliders (Total Outstanding Balance, Average Debtor Days DSO). Calculate and display the projected capital unlock. Use `useState` for slider values. Formula: `unlocked = (totalOutstanding / debtorDays) * 15` (approximation of 15-day DSO reduction impact).

### 3.9 Contact form
The contact form is frontend-only for now. On submit:
- Prevent default
- Validate required fields (Full Name, Work Email)
- Show a success message: "Thank you. We'll be in touch within 4 business hours."
- Use `useState` for form fields and submission state

### 3.10 FAQ accordion
The pricing page FAQ section needs expand/collapse behaviour. Use `useState` to track which FAQ is open. Only one open at a time (close others when one opens).

---

## STEP 4: ROUTER INTEGRATION

Add marketing routes to the existing React Router config. These routes must sit OUTSIDE the authenticated layout:

```
/              → MarketingLayout → HomePage
/features      → MarketingLayout → FeaturesPage
/why-qashivo   → MarketingLayout → WhyQashivoPage
/pricing       → MarketingLayout → PricingPage
/contact       → MarketingLayout → ContactPage
```

**CRITICAL:** 
- All existing app routes (/dashboard, /qollections/*, /qashflow/*, /settings/*, /login, /register, etc.) must continue to work exactly as before
- The `/` route currently may redirect to `/dashboard` for logged-in users — preserve this behaviour. The marketing home page should only show for unauthenticated visitors.
- If the current router uses `/` for login redirect, adjust carefully — the marketing pages are the NEW root, and the app login should be at its existing auth route

---

## STEP 5: SEO & META

Add appropriate `<head>` meta for each marketing page using React Helmet or the existing head management:

- **Home:** title "Qashivo — AI-Powered Credit Control for UK Businesses", description "Stop chasing invoices. Qashivo is your autonomous AI credit controller — chasing debtors, forecasting cashflow, and protecting your cash position. 24/7."
- **Features:** title "Features — Qashivo", description "AI credit control, cashflow forecasting, and working capital. Three integrated pillars for autonomous cashflow management."
- **Why Qashivo:** title "Why Qashivo — Stop Losing Cash to Late Payments", description "See why UK businesses choose Qashivo over manual chasing, debt collection agencies, and in-house credit controllers."
- **Pricing:** title "Pricing — Qashivo", description "Simple, transparent pricing. From £99/month. AI credit control for less than the cost of a junior clerk."
- **Contact:** title "Contact Qashivo — Book a Demo", description "Schedule a technical briefing or connect with our team. Expert support for UK-based finance teams."

---

## STEP 6: VERIFY

Run through this checklist before committing:

1. [ ] All 5 marketing pages render at their routes (/, /features, /why-qashivo, /pricing, /contact)
2. [ ] Nav links navigate between all marketing pages correctly
3. [ ] Active page is highlighted in the nav
4. [ ] "Book a Demo" / "Request Demo" buttons navigate to /contact
5. [ ] Mobile hamburger menu works (responsive nav)
6. [ ] Login link navigates to existing app auth route
7. [ ] Pricing monthly/annual toggle switches prices
8. [ ] Pricing ROI calculator sliders work and update the projected number
9. [ ] FAQ accordion expands/collapses
10. [ ] Contact form validates, submits (frontend only), shows success message
11. [ ] London skyline image loads on Why Qashivo page
12. [ ] All inline SVGs render correctly
13. [ ] All existing app routes (/dashboard, /qollections, etc.) still work
14. [ ] No build errors or console warnings
15. [ ] Pages look correct compared to the screenshot references
16. [ ] DESIGN.md is at project root
17. [ ] Fonts (Manrope + Inter + Material Symbols) load correctly
18. [ ] Footer links work across all pages

---

## STEP 7: DNS SETUP INSTRUCTIONS

After deployment, output the exact DNS records needed to point qashivo.com (registered at 123-Reg) to this Railway deployment:

1. Show how to add the custom domain in Railway project settings
2. Show the CNAME record value Railway provides
3. Show the exact DNS records to add in 123-Reg:
   - CNAME for `www` pointing to Railway
   - A record or ALIAS for root domain `qashivo.com`
   - Any required TXT records for verification
4. Note expected DNS propagation time

---

## CRITICAL RULES

1. **PRESERVE THE STITCH DESIGNS EXACTLY** — do not redesign, reorganise, or "improve" any section. The screenshots are the approved design. Match them.
2. **Do NOT touch existing app files** — no changes to existing layouts, components, routes, styles, or Tailwind config that would affect the app. Marketing additions only.
3. **DESIGN.md stays in sync** — if you change any marketing styles during integration, update DESIGN.md to reflect the change. Add a "Last Updated" timestamp and changelog section at the bottom.
4. **Tailwind token conflicts** — if any of the marketing colour tokens conflict with existing app Tailwind tokens, namespace them (e.g., `marketing-primary`) and use the namespaced versions in marketing components. Do NOT change existing app tokens.
5. **One step at a time** — build in this order, verify each compiles:
   1. DESIGN.md + marketing.css + Tailwind config updates
   2. MarketingNav + MarketingFooter
   3. MarketingLayout + router integration
   4. HomePage
   5. FeaturesPage
   6. WhyQashivoPage
   7. PricingPage (with toggle + calculator + FAQ interactivity)
   8. ContactPage (with form handling)
   9. SEO meta tags
   10. Final verification against screenshots
