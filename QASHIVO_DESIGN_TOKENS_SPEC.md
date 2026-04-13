# QASHIVO — DESIGN TOKEN SPECIFICATION

**Version:** 1.0 — 12 April 2026
**Purpose:** Defines the visual DNA for Qashivo's UI refresh. Every colour, size, spacing, and component treatment across all three pillars.
**Aesthetic direction:** Warm premium fintech — Mercury's calm confidence meets Stripe's data craftsmanship
**Implementation:** Tailwind config + CSS custom properties + shared component styles
**Reference:** Inspired by Mercury, Stripe, Ramp, Wise, Linear

---

## 1. COLOUR SYSTEM

### 1.1 Neutrals (warm gray family)

Qashivo uses warm grays, not cool blue-grays. This gives the app a grounded, trustworthy feel — like Mercury's warm paper tones rather than a clinical tech product.

| Token | Light mode | Dark mode | Usage |
|-------|-----------|-----------|-------|
| `--q-bg-page` | `#F8F7F5` | `#141413` | Page background (not pure white) |
| `--q-bg-surface` | `#FFFFFF` | `#1E1E1C` | Cards, modals, dropdowns |
| `--q-bg-surface-hover` | `#F4F3F0` | `#2A2A27` | Card/row hover state |
| `--q-bg-surface-alt` | `#F1F0EC` | `#252523` | Alternating table rows, secondary surfaces |
| `--q-bg-input` | `#FFFFFF` | `#1E1E1C` | Input fields |
| `--q-bg-sidebar` | `#FFFFFF` | `#1A1A18` | Sidebar background |
| `--q-text-primary` | `#1A1918` | `#EDECEA` | Headlines, hero numbers, primary content |
| `--q-text-secondary` | `#6B6A66` | `#9C9B97` | Body text, descriptions |
| `--q-text-tertiary` | `#9C9B97` | `#6B6A66` | Captions, timestamps, column headers |
| `--q-text-muted` | `#C4C3BF` | `#44443F` | Placeholder text, disabled states |
| `--q-border-default` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Default borders (cards, dividers) |
| `--q-border-hover` | `rgba(0,0,0,0.15)` | `rgba(255,255,255,0.15)` | Hover borders |
| `--q-border-strong` | `rgba(0,0,0,0.25)` | `rgba(255,255,255,0.25)` | Input focus, emphasized borders |

### 1.2 Semantic colours

Colour earns its place. These are the ONLY colours that appear in the app. Each one has a specific meaning — they are never used decoratively.

**Money in (green):**
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--q-money-in-bg` | `#ECFAEF` | `#0C2912` | Positive cashflow backgrounds |
| `--q-money-in-text` | `#15803D` | `#4ADE80` | Positive amounts, trend arrows ▲ |
| `--q-money-in-border` | `#BBF7D0` | `#166534` | Borders on money-in elements |

**Risk / money out (red):**
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--q-risk-bg` | `#FEF2F2` | `#2D0F0F` | Overdue highlights, risk alerts |
| `--q-risk-text` | `#DC2626` | `#FCA5A5` | Overdue amounts, trend arrows ▼, red zone on charts |
| `--q-risk-border` | `#FECACA` | `#7F1D1D` | Borders on risk elements |

**Attention / warning (amber):**
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--q-attention-bg` | `#FFFBEB` | `#2D2006` | Generic email, needs-phone, medium risk |
| `--q-attention-text` | `#B45309` | `#FCD34D` | Warning text, amber badges |
| `--q-attention-border` | `#FDE68A` | `#78350F` | Borders on attention elements |

**Information (blue):**
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--q-info-bg` | `#EFF6FF` | `#0C1929` | Information banners, sync progress |
| `--q-info-text` | `#1D4ED8` | `#93C5FD` | Links, interactive text, info badges |
| `--q-info-border` | `#BFDBFE` | `#1E3A5F` | Borders on info elements |

**Qashivo brand accent (deep teal):**
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--q-accent` | `#0F766E` | `#2DD4BF` | Primary buttons, active nav, brand moments |
| `--q-accent-hover` | `#0D6D66` | `#5EEAD4` | Button hover |
| `--q-accent-bg` | `#F0FDFA` | `#0D2D2A` | Accent backgrounds (very rare) |

**VIP (purple):**
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--q-vip-bg` | `#F5F3FF` | `#1E1833` | VIP badge background |
| `--q-vip-text` | `#6D28D9` | `#C4B5FD` | VIP text |

**Neutral status (gray) — for on-hold, inactive, no-outstanding:**
Uses `--q-text-tertiary` on `--q-bg-surface-alt`.

### 1.3 Chart colours

A restrained palette for Recharts. Maximum 4 colours per chart.

| Token | Value | Usage |
|-------|-------|-------|
| `--q-chart-primary` | `#0F766E` | Expected line, primary bars |
| `--q-chart-secondary` | `#6B6A66` | Secondary series |
| `--q-chart-positive` | `#15803D` | Money in, positive variance |
| `--q-chart-negative` | `#DC2626` | Red zone, negative variance |
| `--q-chart-band` | `rgba(15,118,110,0.08)` | Confidence band fill (light) |
| `--q-chart-band-dark` | `rgba(45,212,191,0.08)` | Confidence band fill (dark) |
| `--q-chart-grid` | `rgba(0,0,0,0.05)` | Gridlines (barely visible) |
| `--q-chart-tooltip-bg` | `#1A1918` | Tooltip background (always dark) |
| `--q-chart-tooltip-text` | `#FFFFFF` | Tooltip text (always white) |

---

## 2. TYPOGRAPHY

### 2.1 Font stack

```
--q-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--q-font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
```

Inter is the exception to the "avoid Inter" rule because Qashivo is a data-dense financial product where readability at small sizes and tabular number support are non-negotiable. Inter's tabular figures (`font-variant-numeric: tabular-nums`) make columns of numbers align perfectly — this matters more than typographic distinctiveness for a product people use daily.

### 2.2 Type scale

| Token | Size | Weight | Line height | Usage |
|-------|------|--------|-------------|-------|
| `--q-text-hero` | 32px | 600 | 1.1 | Dashboard hero number (total outstanding) |
| `--q-text-metric` | 24px | 600 | 1.2 | Metric card values |
| `--q-text-page-title` | 20px | 600 | 1.3 | Page titles |
| `--q-text-section` | 16px | 600 | 1.4 | Section headers |
| `--q-text-body` | 14px | 400 | 1.6 | Body text, table cells |
| `--q-text-body-medium` | 14px | 500 | 1.6 | Debtor names, emphasized body |
| `--q-text-small` | 13px | 400 | 1.5 | Secondary info, timestamps |
| `--q-text-caption` | 11px | 500 | 1.4 | Column headers, section labels, badge text |

### 2.3 Number formatting rules

All monetary values use:
```css
font-variant-numeric: tabular-nums;
font-family: var(--q-font-mono);
```

| Context | Format | Example |
|---------|--------|---------|
| Dashboard hero | Rounded, no decimals, comma-separated | £185,491 |
| Metric cards | Rounded, no decimals | £42,000 |
| Table cells | 2 decimals, comma-separated | £1,479.68 |
| Invoices | 2 decimals always | £266.76 |
| Percentages | 1 decimal | 94.2% |
| Days | Integer + muted suffix | 42 days |
| Trends | Arrow + value + direction | ▲ 5 days |

### 2.4 Column header style

All table column headers:
```css
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.5px;
color: var(--q-text-tertiary);
```

---

## 3. SPACING SYSTEM

Based on a 4px grid. Use `rem` for section spacing, `px` for component internals.

| Token | Value | Usage |
|-------|-------|-------|
| `--q-space-xs` | 4px | Icon-to-text gap, badge internal padding vertical |
| `--q-space-sm` | 8px | Badge internal padding horizontal, tight gaps |
| `--q-space-md` | 12px | Card grid gaps, table cell padding horizontal |
| `--q-space-lg` | 16px | Card internal padding, section gaps within a card |
| `--q-space-xl` | 24px | Section gaps between cards/groups |
| `--q-space-2xl` | 32px | Page section gaps |
| `--q-space-3xl` | 48px | Major page sections |

### 3.1 Page layout

```
Sidebar width:        240px (collapsed: 64px)
Content max-width:    1200px
Content padding:      32px horizontal, 24px top
Card padding:         20px (16px on mobile)
Card gap:             12px (grid of cards)
Section gap:          32px (between major page sections)
```

---

## 4. BORDERS AND RADIUS

| Token | Value | Usage |
|-------|-------|-------|
| `--q-radius-sm` | 4px | Badges, pills, small elements |
| `--q-radius-md` | 8px | Inputs, buttons, table cells |
| `--q-radius-lg` | 12px | Cards, modals, dropdowns |
| `--q-radius-xl` | 16px | Large cards, chart containers |
| `--q-border-width` | 0.5px | All borders (never 1px or 2px) |

Exception: featured/recommended items get `2px solid var(--q-accent)` border.

### 4.1 Card spec

```css
.q-card {
  background: var(--q-bg-surface);
  border: 0.5px solid var(--q-border-default);
  border-radius: var(--q-radius-lg);
  padding: 20px;
  transition: border-color 0.15s ease;
}
.q-card:hover {
  border-color: var(--q-border-hover);
}
```

### 4.2 Metric card spec

```css
.q-metric-card {
  background: var(--q-bg-surface-alt);
  border: none;
  border-radius: var(--q-radius-md);
  padding: 16px;
}
.q-metric-card__label {
  font-size: 13px;
  font-weight: 400;
  color: var(--q-text-tertiary);
  margin-bottom: 4px;
}
.q-metric-card__value {
  font-size: 24px;
  font-weight: 600;
  color: var(--q-text-primary);
  font-variant-numeric: tabular-nums;
  font-family: var(--q-font-mono);
}
.q-metric-card__trend {
  font-size: 13px;
  margin-top: 4px;
}
```

---

## 5. STATUS BADGE SYSTEM

One unified badge component used across all three pillars.

### 5.1 Badge spec

```css
.q-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--q-radius-sm);
  line-height: 1.4;
  white-space: nowrap;
}
```

### 5.2 Badge variants

| Badge | Background | Text | Dot colour | Usage |
|-------|-----------|------|-----------|-------|
| Ready | `--q-money-in-bg` | `--q-money-in-text` | green | Debtor ready, invoice paid |
| Needs attention | `--q-risk-bg` | `--q-risk-text` | red | Needs email, overdue, high risk |
| Warning | `--q-attention-bg` | `--q-attention-text` | amber | Generic email, medium risk, needs phone |
| Info | `--q-info-bg` | `--q-info-text` | blue | Syncing, processing, new |
| VIP | `--q-vip-bg` | `--q-vip-text` | purple | VIP debtor |
| Neutral | `--q-bg-surface-alt` | `--q-text-tertiary` | gray | On hold, no outstanding, inactive |

### 5.3 Dot indicator (optional prefix)

Small 6px circle before badge text for extra scanability:
```css
.q-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
```

### 5.4 Badge mapping across pages

| Page | Element | Badge |
|------|---------|-------|
| Debtors list | Risk column | Ready / Warning / Needs attention |
| Debtors list | Status column | Active (neutral) / On hold (neutral) / VIP (purple) |
| Data Health | Readiness | Ready / Needs email (red) / Generic email (amber) / Needs phone (amber) / Needs attention (red) |
| Agent Activity | Action type | Email sent (info) / Response (green) / Promise (info) / Escalation (amber) / Bounced (red) |
| Qashflow | Confidence | High (green) / Medium (amber) / Low (red) |
| Qapital | Approval status | Approved (green) / Pending (amber) / Rejected (red) |
| Dashboard | Actionable items | Pending (amber) / Urgent (red) |

---

## 6. TABLE DESIGN

### 6.1 Base table spec

```css
.q-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.q-table th {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--q-text-tertiary);
  text-align: left;
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--q-border-default);
  position: sticky;
  top: 0;
  background: var(--q-bg-surface);
  z-index: 1;
}

.q-table td {
  font-size: 14px;
  padding: 12px;
  border-bottom: 0.5px solid var(--q-border-default);
  color: var(--q-text-secondary);
  vertical-align: middle;
}

.q-table tr {
  height: 48px;
  transition: background-color 0.1s ease;
}

.q-table tr:hover {
  background: var(--q-bg-surface-hover);
}

/* Clickable rows */
.q-table tr[data-clickable] {
  cursor: pointer;
}
```

### 6.2 Column alignment rules

| Column type | Alignment | Font | Weight |
|-------------|-----------|------|--------|
| Name / text | Left | Sans | 500 for primary entity, 400 for others |
| Email / contact | Left | Sans | 400 |
| Monetary amount | Right | Mono, tabular-nums | 400 (500 for the primary amount column) |
| Percentage | Right | Mono | 400 |
| Days / count | Right | Sans | 400 |
| Status badge | Left | — | — |
| Date | Left | Sans | 400 |
| Actions (three-dot) | Centre | — | — |

### 6.3 Overdue amount treatment

```css
.q-amount--overdue {
  color: var(--q-risk-text);
}
.q-amount--positive {
  color: var(--q-money-in-text);
}
/* Default amounts are --q-text-primary, NOT green */
```

---

## 7. BUTTON STYLES

### 7.1 Primary button

```css
.q-btn-primary {
  background: var(--q-accent);
  color: #FFFFFF;
  border: none;
  border-radius: var(--q-radius-md);
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}
.q-btn-primary:hover {
  background: var(--q-accent-hover);
}
.q-btn-primary:active {
  transform: scale(0.98);
}
```

### 7.2 Secondary button

```css
.q-btn-secondary {
  background: transparent;
  color: var(--q-text-primary);
  border: 0.5px solid var(--q-border-strong);
  border-radius: var(--q-radius-md);
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.q-btn-secondary:hover {
  background: var(--q-bg-surface-alt);
}
```

### 7.3 Ghost button (text-only)

```css
.q-btn-ghost {
  background: transparent;
  color: var(--q-info-text);
  border: none;
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}
.q-btn-ghost:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

---

## 8. SIDEBAR NAVIGATION

### 8.1 Structure

```
┌─────────────────────────┐
│ [Logo] Qashivo           │
│ Datum Creative Media Ltd  │  ← tenant name, 12px, tertiary
├─────────────────────────┤
│ Dashboard                 │  ← cross-pillar, always first
├─────────────────────────┤
│ QOLLECTIONS               │  ← section label, 10px uppercase
│   Debtors                 │
│   Agent Activity          │
│   Approvals               │
├─────────────────────────┤
│ QASHFLOW                  │  ← section label
│   13-Week Forecast        │
│   Weekly Review           │
├─────────────────────────┤
│ QAPITAL                   │  ← section label
│   Bridge                  │
│   Facility                │
├─────────────────────────┤
│                           │  ← flexible space
├─────────────────────────┤
│ Settings                  │
│ [Riley avatar]            │  ← optional bottom placement
└─────────────────────────┘
```

### 8.2 Nav item spec

```css
.q-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: var(--q-radius-md);
  font-size: 14px;
  font-weight: 400;
  color: var(--q-text-secondary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  margin: 1px 8px;
}

.q-nav-item:hover {
  background: var(--q-bg-surface-hover);
  color: var(--q-text-primary);
}

.q-nav-item--active {
  background: var(--q-bg-surface-alt);
  color: var(--q-text-primary);
  font-weight: 500;
}

.q-nav-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--q-text-tertiary);
  padding: 20px 16px 6px 16px;
  margin: 0 8px;
}
```

### 8.3 Nav icons

16px monoline icons. Use Lucide React (already available in the stack). Icons match text colour — never independently coloured. Active state icon matches active text weight.

---

## 9. CHART STYLING (RECHARTS)

### 9.1 Global chart config

```javascript
const CHART_THEME = {
  // Axes
  axisTickFontSize: 11,
  axisTickColor: 'var(--q-text-tertiary)',
  axisLineColor: 'var(--q-border-default)',

  // Grid
  gridStrokeColor: 'var(--q-chart-grid)',
  gridStrokeDasharray: '3 3',

  // Tooltip
  tooltipBg: 'var(--q-chart-tooltip-bg)',
  tooltipText: 'var(--q-chart-tooltip-text)',
  tooltipBorderRadius: 8,
  tooltipPadding: 12,

  // Lines
  lineStrokeWidth: 2,
  lineActiveDotRadius: 5,
  lineDotRadius: 0, // no dots by default, dots appear on hover

  // Bars
  barRadius: [4, 4, 0, 0], // rounded top corners
  barMaxWidth: 40,

  // Area (confidence band)
  areaOpacity: 0.08,
};
```

### 9.2 Running balance chart specific

```
Expected line:     solid, 2px, var(--q-chart-primary)
Optimistic line:   dashed (4 4), 1px, var(--q-chart-primary), 50% opacity
Pessimistic line:  dashed (4 4), 1px, var(--q-chart-primary), 50% opacity
Confidence band:   filled area between opt/pess, var(--q-chart-band)
Safety threshold:  dashed (6 2), 1px, var(--q-risk-text), 40% opacity
Red zone:          filled area below threshold, var(--q-risk-bg)
Opening balance:   dashed horizontal, 1px, var(--q-text-tertiary), 30% opacity
Actual points:     solid circles, 5px, var(--q-chart-primary)
Hover crosshair:   vertical line, 0.5px, var(--q-text-tertiary)
```

### 9.3 Collections bar chart specific

```
Forecast bars:     var(--q-chart-primary), radius [4,4,0,0]
Actual bars:       var(--q-chart-primary), full opacity (vs 60% for forecast)
Error bars:        thin lines (1px) showing optimistic/pessimistic range
Recurring overlay: dashed border at base of bar, var(--q-money-in-text)
```

---

## 10. LOADING AND EMPTY STATES

### 10.1 Skeleton loading

Every component has a skeleton variant. Skeletons match the shape of real content.

```css
.q-skeleton {
  background: var(--q-bg-surface-alt);
  border-radius: var(--q-radius-md);
  animation: q-pulse 1.5s ease-in-out infinite;
}

@keyframes q-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

Skeleton sizes match real content:
- Metric card number: 120px × 28px rectangle
- Table row: full-width 48px row with 3-4 placeholder bars
- Chart: full-width × 240px rectangle
- Badge: 60px × 20px pill

### 10.2 Empty states

Every list/table page has a purposeful empty state:

```
┌─────────────────────────────────┐
│                                 │
│     [Subtle illustration]       │  ← optional, very minimal
│                                 │
│   No debtors yet                │  ← 16px, 600 weight
│   Connect Xero to import your   │  ← 14px, secondary
│   customers and start chasing.  │
│                                 │
│   [Connect Xero →]              │  ← primary button
│                                 │
└─────────────────────────────────┘
```

---

## 11. TRANSITIONS AND MICRO-INTERACTIONS

### 11.1 Standard transitions

```css
--q-transition-fast: 0.1s ease;      /* hover states, active states */
--q-transition-default: 0.15s ease;  /* border changes, colour changes */
--q-transition-slow: 0.3s ease;      /* expand/collapse, page transitions */
```

### 11.2 Interaction patterns

| Element | Hover | Active | Focus |
|---------|-------|--------|-------|
| Card | border → `--q-border-hover` | — | — |
| Table row | bg → `--q-bg-surface-hover` | — | — |
| Button (primary) | bg darkens | scale(0.98) | ring 2px `--q-accent` |
| Button (secondary) | bg → `--q-bg-surface-alt` | scale(0.98) | ring 2px `--q-border-strong` |
| Nav item | bg → `--q-bg-surface-hover` | — | — |
| Input | — | — | border → `--q-accent`, ring 2px `--q-accent-bg` |
| Badge | — | — | — |
| Three-dot menu | bg → `--q-bg-surface-alt` | — | — |

### 11.3 Page transitions

No full-page transitions. Content fades in with `opacity 0 → 1` over 0.2s on route change. Skeleton loaders appear instantly, real content replaces them with a subtle fade.

---

## 12. RESPONSIVE BREAKPOINTS

```css
--q-breakpoint-sm: 640px;   /* mobile */
--q-breakpoint-md: 768px;   /* tablet */
--q-breakpoint-lg: 1024px;  /* desktop, sidebar collapses below this */
--q-breakpoint-xl: 1280px;  /* wide desktop */
```

Below 1024px: sidebar collapses to 64px icon-only mode. Below 768px: metric cards stack to 2-column. Below 640px: single column, tables scroll horizontally.

---

## 13. TAILWIND CONFIG MAPPING

These tokens translate to Tailwind as:

```javascript
// tailwind.config.ts (extend section)
{
  colors: {
    'q-bg': {
      page: 'var(--q-bg-page)',
      surface: 'var(--q-bg-surface)',
      'surface-hover': 'var(--q-bg-surface-hover)',
      'surface-alt': 'var(--q-bg-surface-alt)',
    },
    'q-text': {
      primary: 'var(--q-text-primary)',
      secondary: 'var(--q-text-secondary)',
      tertiary: 'var(--q-text-tertiary)',
      muted: 'var(--q-text-muted)',
    },
    'q-money-in': 'var(--q-money-in-text)',
    'q-risk': 'var(--q-risk-text)',
    'q-attention': 'var(--q-attention-text)',
    'q-info': 'var(--q-info-text)',
    'q-accent': 'var(--q-accent)',
    'q-vip': 'var(--q-vip-text)',
  },
  fontFamily: {
    sans: ['Inter', ...defaultTheme.fontFamily.sans],
    mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
  },
  borderRadius: {
    'q-sm': '4px',
    'q-md': '8px',
    'q-lg': '12px',
    'q-xl': '16px',
  },
}
```

---

## 14. IMPLEMENTATION APPROACH

### Phase 1: Token installation (single Claude Code session)

1. Add CSS custom properties file: `client/src/styles/tokens.css`
2. Update `tailwind.config.ts` with the extended theme
3. Import tokens CSS in the app entry point
4. Add dark mode media query with dark values
5. Add Inter (from Google Fonts or local) and JetBrains Mono (from Google Fonts)
6. Update the base `body` and root styles

### Phase 2: Shared components (single Claude Code session)

1. Create `QMetricCard` component
2. Create `QBadge` component with all variants
3. Create `QTable` wrapper with the standardised styling
4. Create `QSkeleton` component
5. Update sidebar navigation styles

### Phase 3: Page-by-page application (one session per page)

Apply tokens and shared components to each page in demo order:
Dashboard → Debtors → Debtor Detail → Agent Activity → Qashflow → Qapital

---

*Specification version: 1.0 — 12 April 2026*
*Author: Simon Kramer / Claude*
*Status: Awaiting approval before implementation*
