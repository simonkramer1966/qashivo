# Design System Specification: The Editorial Fintech Experience

## 1. Overview & Creative North Star: "The Digital Curator"

This design system moves away from the cluttered, "dashboard-heavy" aesthetic typical of fintech. Instead, it adopts the **Digital Curator** persona—a high-end, editorial-inspired interface that prioritizes clarity, financial authority, and calm. 

We break the "SaaS template" look through **intentional asymmetry** and **tonal depth**. By utilizing extreme typographic scale (pairing massive display type with surgical micro-copy) and replacing rigid borders with layered surfaces, we create a workspace that feels like a premium physical office. The goal is to make the UK SME owner feel in total command of their cashflow, guided by an AI that is sophisticated, not "robotic."

---

## 2. Colors & Surface Philosophy

Our palette is anchored in professional stability (Deep Navy) and energized by technological precision (Electric Teal).

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning or layout containment. 
Boundaries must be defined solely through background color shifts. Use `surface-container-low` sections sitting on a `surface` background to define modular areas. High-contrast lines create visual "noise"; tonal shifts create "flow."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—stacked sheets of fine paper or frosted glass.
- **Lowest Tier (`surface_container_lowest` / #ffffff):** Use for primary interactive cards or focused content blocks.
- **Base Tier (`surface` / #f7f9fb):** The default canvas for the application.
- **Mid Tier (`surface_container` / #eceef0):** Use for sidebars or secondary navigation wrappers.
- **High Tier (`surface_container_high` / #e6e8ea):** Use for inset "well" areas like code snippets or data logs.

### The "Glass & Gradient" Rule
To elevate the "AI" feel, main CTAs and hero backgrounds should utilize a subtle linear gradient transitioning from `primary` (#000000) to `primary_container` (#131b2e) at a 135-degree angle. For floating elements (like AI-insight modals), use **Glassmorphism**: apply `surface_container_low` at 70% opacity with a `24px` backdrop-blur to allow the background data to bleed through softly.

---

## 3. Typography: The Editorial Scale

We use a dual-font system to balance "Direct Professionalism" with "Modern Tech."

*   **Display & Headlines (Manrope):** Chosen for its geometric confidence. These should be set with tight letter-spacing (-0.02em) to feel "heavy" and authoritative.
    *   `display-lg` (3.5rem): Reserved for big-picture financial totals or welcome moments.
    *   `headline-md` (1.75rem): Used for section titles.
*   **Body & Labels (Inter):** The workhorse font. High legibility for complex data.
    *   `body-lg` (1rem): The standard for AI-generated insights. Always use a 1.6 line-height for maximum breathability.
    *   `label-md` (0.75rem): Used for table headers and metadata, often in All-Caps with +0.05em tracking for a premium "ticker" feel.

---

## 4. Elevation & Depth

We convey hierarchy through **Tonal Layering** rather than structural shadows.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface_container_lowest` (#ffffff) card placed on a `surface_container_low` (#f2f4f6) section creates a soft, natural lift without a single pixel of shadow.
*   **Ambient Shadows:** If an element must "float" (e.g., a dropdown or a critical AI notification), use an extra-diffused shadow: `0px 20px 40px rgba(15, 23, 42, 0.06)`. This mimics natural ambient light rather than a synthetic "drop shadow."
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use a "Ghost Border": the `outline_variant` token at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
*   **Primary:** `primary_container` background with `on_primary_fixed` text. Roundedness: `md` (0.75rem). No border.
*   **Secondary:** `surface_container_highest` background. Soft, tactile, and understated.
*   **Tertiary/Ghost:** No background. Use `on_surface` text with a `3.5` spacing unit padding.

### Input Fields
*   **Style:** Background `surface_container_low`. No border. On focus, transition background to `surface_container_lowest` and apply a 1px "Ghost Border" of `secondary` (#00687a).
*   **Labels:** Use `label-md` in `on_surface_variant`. Always positioned above the field, never as a placeholder.

### Cards & Data Lists
*   **The Separation Rule:** Forbid the use of divider lines. Separate list items using vertical white space (use `spacing.4` or `1.4rem`).
*   **Nesting:** AI-generated cashflow predictions should be housed in cards using the `secondary_fixed` (#acedff) tint at 10% opacity to subtly highlight "AI-touched" data.

### Progress & Flow Nodes (Contextual)
*   As a cashflow platform, use "Node" components to show money movement. These are small circles (`rounded-full`) connected by soft, curved paths (`outline_variant` at 20% opacity). Use `secondary` for incoming and `tertiary_fixed_dim` for outgoing.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetric Padding:** On large desktop screens, give the left-hand content more breathing room (use `spacing.24`) than the right to create an editorial layout feel.
*   **Embrace "Empty" Space:** If a section has no data, don't fill it with a grey box. Leave it open, using a `display-sm` typographic "placeholder" that explains why.
*   **Tint Your Greys:** Ensure all cool greys in the `surface` tokens have a slight blue/navy undertone to maintain the "Deep Navy" brand essence.

### Don't:
*   **Don't use 100% Black:** Even for text. Use `on_background` (#191c1e) to keep the contrast high but the feel sophisticated.
*   **Don't use "Hard" Corners:** Avoid the `none` roundedness scale. Everything in the system should feel approachable, using the `md` (12px) or `lg` (16px) corners.
*   **Don't over-animate:** AI shouldn't "flash." Use slow, 400ms "ease-out" transitions for surface color shifts to mimic the calm of a professional advisor.

---

## 7. Brand Voice & Positioning

Qashivo targets UK SMEs and mid-market businesses (£500k–£20m turnover). The buyer is a business owner, managing director, or finance director.

**Tone:** Confident, direct, professional, human. Like a sharp finance professional explaining something clearly — not a corporate bank being stiff, and not a startup trying to be clever.

**Do:**
- Speak to the business owner's pain ("you're owed thousands but your bank says £12k")
- Use plain English ("debtor days" not "settlement velocity", "cashflow" not "liquidity")
- Reference real outcomes ("15-day DSO reduction", "89% of emails need zero editing")
- Keep it UK-focused — Qashivo is built for UK businesses with UK compliance
- Emphasise the multi-channel capability (email + SMS + AI voice) — this is a key differentiator vs competitors who only send emails

**Don't:**
- Use enterprise jargon ("deploy", "infrastructure", "tactical intelligence", "ledger synchronisation")
- Sound bigger than we are — we're a focused, sharp product, not an enterprise platform
- Over-formalise — "Book a Demo" not "Request Professional Consultation"
- Use military/ops language ("deploy", "execute", "tactical", "operational")
- Don't reference WhatsApp or any channels not yet built
- Don't say "phone calls" without clarifying these are AI-powered — we're not suggesting humans are making calls