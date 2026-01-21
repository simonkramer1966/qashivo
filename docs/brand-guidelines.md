# Qashivo Brand Guidelines (Cardless v1.0)

## Design System Overview

Qashivo uses a clean, minimal, fintech-grade aesthetic built for trust and clarity. The interface is cardless by default: content sits on the page using typography, spacing, and dividers for structure. "Boxes everywhere" is avoided to keep the product calm and premium.

**Core feel**: accountant-calm, modern, outcome-led, high whitespace.

---

## Visual Principles

### Cardless by default
Structure comes from typography + spacing + subtle dividers, not boxed containers.

### Whitespace is a feature
Pages should breathe. Reduce density before adding UI chrome.

### Hierarchy over decoration
Headings, subheadings, and muted body text do the heavy lifting.

### Surface hints only when essential
Use soft backgrounds or light borders sparingly to group controls or highlight exceptions.

### Trust through restraint
No heavy shadows, no loud colors, no aggressive patterns. Confidence is communicated clearly and calmly.

---

## Color Palette

### Primary Brand Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Qashivo Teal** | `#17B6C3` | `188 74% 42%` | Primary buttons, links, focus ring, key accents |
| **Teal Hover** | `#1396A1` | - | Hover state for primary buttons |

### Status Colors (Desaturated Fintech Palette)

| Status | Hex | RGB | Usage |
|--------|-----|-----|-------|
| **Success** | `#4FAD80` | `79, 173, 128` | Paid, resolved, positive outcomes |
| **Warning** | `#E8A23B` | `232, 162, 59` | Needs attention, upcoming due dates, medium confidence |
| **Error/Critical** | `#C75C5C` | `199, 92, 92` | Disputes, overdue risk, low confidence, critical alerts |

### Neutral Colors

| Name | Hex/Value | Usage |
|------|-----------|-------|
| **Background** | `#FFFFFF` | Default page background |
| **Text Primary** | `gray-900` | Headlines, key values |
| **Text Secondary** | `gray-600` | Body copy, descriptions |
| **Text Muted** | `gray-500` | Labels, hints |
| **Text Light** | `gray-400` | Placeholders |
| **Divider / Border** | `gray-100–gray-200` | Section dividers, table separators |

**Rule**: neutrals dominate. Teal is used for actions, not decoration.

---

## Typography

### Font Families

- **Headings**: `Archivo` (professional, confident)
- **Body/UI**: `DM Sans` (clean, readable, modern)

### Font Import
```css
@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap");
```

### Tailwind Config
```js
fontFamily: {
  sans: ["DM Sans", "sans-serif"],
  heading: ["Archivo", "sans-serif"],
  display: ["Archivo", "sans-serif"],
}
```

### Type Scale

| Element | Desktop | Mobile | Weight | Font |
|---------|---------|--------|--------|------|
| **H1** | 48px | 36px | 700 | Archivo |
| **H2** | 36px | 30px | 700 | Archivo |
| **H3** | 24px | 20px | 600 | Archivo |
| **H4** | 18px | 16px | 600 | Archivo |
| **Body** | 18px | 16px | 400 | DM Sans |
| **Small** | 14px | 14px | 400 | DM Sans |

### Alignment Rules

- **Marketing**: hero + top sections can be centered.
- **Product UI**: default left-aligned for dashboards, lists, tables, forms.
- **Exceptions**: empty states and confirmation screens may be centered.

---

## Layout, Spacing & Structure (Cardless System)

### Page structure

- White page background (`bg-white`)
- Strong page headers
- Sections separated by spacing + dividers, not cards

### Container
```css
max-w-5xl mx-auto px-6
```

### Section pattern (default)
```css
py-16 md:py-24 border-b border-gray-100
space-y-6
```

### Vertical rhythm

- Section padding: `py-16 md:py-24` (marketing), `py-6 md:py-10` (product)
- Between elements: `space-y-6` or `space-y-8`

### Touch targets

All interactive elements must be at least 44px x 44px:
```css
min-h-[44px] min-w-[44px]
```

---

## Surfaces (Surface Hints)

Qashivo avoids cards, but uses subtle surface hints when grouping is essential.

### Surface Hint A — Divider-only (default)

Use dividers to create calm structure:
```css
border-b border-gray-100
```

### Surface Hint B — Soft panel (for grouped controls)

Use sparingly (filters, approval controls, "today's plan" tools):
```css
bg-gray-50/60 rounded-lg px-4 py-3
```

### Surface Hint C — Exception callout (rare, high signal)

For disputes / low confidence / blocked flows:
```css
bg-red-50 text-red-900 border border-red-100 rounded-lg px-4 py-3
```

(Use teal only for actions. Use semantic colors for states.)

### Shadows

Shadows are not a default layout tool.

- **Allowed**: only for marketing screenshots/previews, or rare "floating" UI (dropdowns, modals).
- **Avoid**: shadow-based card grids.

---

## Components (Cardless-first)

### Buttons

#### Primary CTA
```css
bg-[#17B6C3] hover:bg-[#1396A1] text-white font-medium
rounded-full inline-flex items-center gap-2
transition-colors duration-200
```

#### Sizes

- **lg** (hero): `px-8 py-6 text-lg`
- **md** (default): `px-6 py-3 text-base`
- **sm** (inline): `px-4 py-2 text-sm`

#### Disabled
```css
disabled:opacity-50 disabled:cursor-not-allowed
```

#### Secondary (Text link)
```css
text-gray-900 font-medium underline-offset-4 hover:underline
```

#### Ghost
```css
text-gray-600 font-medium hover:text-gray-900 transition-colors duration-200
```

### Forms / Inputs
```css
w-full bg-white border border-gray-200 rounded-lg
px-4 py-3 text-base
focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]
placeholder:text-gray-400
```

### Lists & Tables (Preferred over cards)

#### Tables

- Use separators, not boxed cells
- Right-align numeric columns
- Add subtle row hover

```css
border-b border-gray-100
hover:bg-gray-50
```

#### List rows (Action Centre / Customers)

- Use a single row container with hover
- Status shown via badge + dot

### Badges (Status & Confidence)
```css
/* Success */
bg-[#4FAD80]/10 text-[#4FAD80] px-2.5 py-1 rounded-full text-sm font-medium

/* Warning */
bg-[#E8A23B]/10 text-[#E8A23B] px-2.5 py-1 rounded-full text-sm font-medium

/* Error */
bg-[#C75C5C]/10 text-[#C75C5C] px-2.5 py-1 rounded-full text-sm font-medium
```

### Status Dots
```css
w-2 h-2 rounded-full
```

- Success: `bg-[#4FAD80]`
- Warning: `bg-[#E8A23B]`
- Error: `bg-[#C75C5C]`

---

## Confidence UX (Qashivo-specific)

Confidence must be communicated with more than color.

**Always show:**

1. Confidence label: High / Medium / Low
2. Reason (short): "Promise date received", "No reply in 14 days", "Dispute detected"
3. Next step: "Paused", "Chase scheduled", "Review needed"

**Mapping:**

- High confidence → Success color
- Medium confidence → Warning color
- Low confidence → Error color

**Rule**: Low confidence should always surface a review path (no silent automation).

---

## Marketing Page Patterns (Cardless)

### Hero Section
```css
bg-white py-16 md:py-24 px-6 border-b border-gray-100
text-center
```

**Headline:**
```css
text-4xl md:text-6xl font-bold text-gray-900 leading-tight font-heading
```

**Body:**
```css
text-lg md:text-xl text-gray-600 leading-relaxed max-w-4xl mx-auto
```

**CTA:**
```css
bg-[#17B6C3] hover:bg-[#1396A1] text-white px-8 py-6 rounded-full inline-flex items-center gap-2
```

### Section Structure (marketing)

1. Bold headline (centered)
2. Supporting paragraph (gray-600)
3. Primary CTA with arrow (→)
4. Optional text link below
5. Screenshot (allowed to have shadow)

### Navigation Header
```css
bg-white border-b border-gray-100
```

**Nav links:**
```css
text-gray-600 hover:text-gray-900
```

**Logo:**
```css
h-8 w-auto
```

---

## Animations

Keep motion minimal and functional.

```css
transition-colors duration-200
transition-shadow duration-200
```

### Hover rules

- Buttons: color change only (no scaling)
- Rows: subtle background highlight
- Links: underline or color shift

---

## Accessibility

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### Focus States
```css
focus:outline-none 
focus-visible:ring-2 
focus-visible:ring-[#17B6C3] 
focus-visible:ring-offset-2
```

**Rule**: Never rely on color alone for status—use label/icon + color.

---

## Dark Mode

Dark mode preserves minimalism and teal brand consistency.

```css
.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --card: 217 33% 17%;
  --primary: 188 74% 42%;
  --border: 217 25% 22%;
}
```

---

## Quick Reference

### Cardless section pattern
```css
max-w-5xl mx-auto px-6
py-16 md:py-24 border-b border-gray-100
```

### Soft panel (group controls)
```css
bg-gray-50/60 rounded-lg px-4 py-3
```

### Primary button
```css
bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full inline-flex items-center gap-2
```

---

## Design Principles (final)

1. **Cardless by default** — text on the page with dividers and spacing
2. **Whitespace is your friend** — reduce density before adding UI chrome
3. **Less is more** — minimal shadows, no heavy borders
4. **Clear hierarchy** — headings + muted body text
5. **Teal signals action** — not decoration
6. **Confidence is explicit** — label + reason + next step, not color alone
7. **Arrow CTAs** — use → for primary marketing actions
