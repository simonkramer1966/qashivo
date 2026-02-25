---
name: cardless-v2
description: Cardless v2.0 design system for Qashivo. Use whenever building, editing, or reviewing any UI component or page in this project to ensure visual consistency. Covers color palette, typography, spacing, component patterns, and the distinction between the App variant (internal product) and Marketing variant (public-facing pages).
---

# Cardless v2.0 — Qashivo Design System

Cardless v2.0 is Qashivo's design system for both the internal product (app) and public-facing marketing/investor pages. It is data-dense, typography-driven, and built on Edward Tufte and Stephen Few principles: maximize data-ink ratio, use colour only to convey meaning, minimize decorative elements.

## Two Variants

| Variant | Used for | Character |
|---|---|---|
| **App** | Internal product (action-centre, settings, contacts, invoices, etc.) | Ultra-compact, high density, 13px body text |
| **Marketing** | Public pages (Home, Partners, Pricing, investor pages) | Generous spacing, large headings, readable at a glance |

Always identify which variant applies before building a new page or component.

---

## Core Philosophy

- **White canvas**: Pure `bg-white` backgrounds. No grey page backgrounds.
- **Hairline structure**: `border-gray-100` dividers instead of card shadows or coloured blocks.
- **Typography as hierarchy**: Size and weight create structure. Avoid boxes and backgrounds for grouping.
- **No chartjunk**: No gradients, no backdrop blurs, no decorative shadows on content.
- **Colour = meaning**: Teal for brand/actions, green for positive/paid, red for overdue/negative, amber for warning. Never use colour decoratively.

---

## Colour Palette

### Brand / Action
| Token | Tailwind | Hex |
|---|---|---|
| Brand teal (primary) | `bg-[#17B6C3]` / `text-[#17B6C3]` | `#17B6C3` |
| Brand teal hover | `hover:bg-[#139CA8]` | `#139CA8` |
| Marketing teal (slightly lighter) | `bg-[#12B8C4]` | `#12B8C4` |
| Marketing teal hover | `hover:bg-[#0fa3ae]` | `#0fa3ae` |

### Neutrals
| Role | Tailwind | Hex |
|---|---|---|
| Primary text | `text-gray-900` | `#111827` |
| Dark headings (marketing) | `text-[#0B0F17]` | `#0B0F17` |
| Body / secondary text | `text-gray-600` | `#4B5563` |
| Marketing body text | `text-[#556070]` | `#556070` |
| Borders / dividers | `border-gray-100` | `#F3F4F6` |
| Marketing borders | `border-[#E6E8EC]` | `#E6E8EC` |
| Hover background | `bg-gray-50` | `#F9FAFB` |
| Pure white | `bg-white` | `#FFFFFF` |

### Semantic
| Meaning | Background | Text |
|---|---|---|
| Positive / paid / success | `bg-green-50` | `text-green-700` `#4FAD80` |
| Negative / overdue / error | `bg-red-50` | `text-red-700` `#C75C5C` |
| Warning / medium risk | `bg-amber-50` | `text-amber-700` `#E8A23B` |
| Neutral / pending | `bg-gray-100` | `text-gray-600` |

---

## Typography — App Variant

Always use pixel-based font sizes for density. Do **not** use Tailwind's named scale (text-sm, text-base etc.) in app UI.

| Role | Class | Notes |
|---|---|---|
| Page title | `text-[17px] font-semibold text-gray-900` | Sticky header |
| Section heading | `text-[15px] font-semibold text-gray-900` | Detail panel headings |
| Primary body / list items | `text-[13px] text-gray-700` | Default for all body content |
| Form labels | `text-[12px] font-medium text-gray-700` | |
| Metadata / timestamps | `text-[11px] text-gray-500` | Uppercase for section labels: `uppercase tracking-wide` |
| Badge text | `text-[11px] font-medium` | |
| Financial numbers | Always add `tabular-nums` | Ensures column alignment |

---

## Typography — Marketing Variant

| Role | Class |
|---|---|
| Hero heading | `text-[48px] md:text-[64px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em]` |
| Section heading | `text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15]` |
| Sub-heading | `text-[22px] md:text-[26px] font-semibold text-[#0B0F17]` |
| Hero sub-copy | `text-[18px] md:text-[20px] text-[#556070] leading-[1.55]` |
| Body copy | `text-[16px] text-[#556070] leading-[1.55]` |
| Small / caption | `text-[14px] text-[#556070]` |
| Label / tag | `text-[13px] font-medium` |

---

## Spacing and Layout

### App Variant
- Page outer padding: `px-6 lg:px-8`
- Sticky header: `px-6 py-5 border-b border-gray-100`
- List item row: `px-6 py-3`
- Split-pane sidebar: fixed `w-[340px]`, content fills remaining space
- Table rows: `divide-y divide-gray-100`, no card wrapper
- Section separator: `border-b border-gray-100 py-6`

### Marketing Variant
- Max content width: `max-w-[1200px] mx-auto px-6`
- Section vertical padding: `py-20 md:py-28`
- Hero section: `py-24 md:py-32`
- Grid gap: `gap-12 lg:gap-16` for 2-column, `gap-8 md:gap-12` for 3–4 column
- Centred content max-width: `max-w-[700px] mx-auto`

---

## Component Patterns

### Buttons — App Variant
```tsx
// Primary action
<Button className="h-8 bg-[#17B6C3] hover:bg-[#139CA8] text-white text-[13px] px-3 rounded-lg">
  Action
</Button>

// Secondary / ghost
<Button variant="outline" className="h-7 text-[12px] text-gray-500 border-gray-200 rounded-lg">
  Action
</Button>
```

### Buttons — Marketing Variant
```tsx
// Primary CTA
<Button className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-full text-[16px] font-medium">
  Get started
  <ArrowRight className="ml-2 h-4 w-4" />
</Button>

// Secondary outline CTA
<Button variant="outline" className="h-12 px-7 rounded-full text-[16px] font-medium border-[#E6E8EC]">
  Learn more
</Button>
```

### Tabs — App Variant
```tsx
// Underline tabs, no background
<TabsTrigger
  value="tab"
  className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent
    data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent
    data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
>
  Tab Label
</TabsTrigger>
```

### Status Badges
```tsx
// Positive
<span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700">Paid</span>

// Negative
<span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700">Overdue</span>

// Warning
<span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">At risk</span>

// Neutral
<span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">Pending</span>

// Brand
<span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#17B6C3]/10 text-[#17B6C3]">Active</span>
```

### Active Selection Indicator (sidebar / list)
```tsx
// 2px teal left bar on active item
<div className={cn(
  "flex items-center px-3 py-2 rounded-lg text-[13px]",
  isActive
    ? "bg-gray-50 text-gray-900 font-medium border-l-2 border-[#17B6C3]"
    : "text-gray-600 hover:bg-gray-50"
)}>
```

### Data Tables — App Variant
```tsx
// No card wrapper. Rows divide on y-axis only.
<div className="divide-y divide-gray-100">
  <div className="flex items-center px-6 py-3 hover:bg-gray-50">
    <span className="text-[13px] text-gray-700 tabular-nums">£12,450.00</span>
  </div>
</div>
```

### Empty States — App Variant
```tsx
// Minimal. Small icon, short message.
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Icon className="h-5 w-5 text-gray-300 mb-3" />
  <p className="text-[13px] text-gray-500">No items yet</p>
</div>
```

### Marketing Section — 2-Column Layout
```tsx
// Text left, image right
<section className="py-20 md:py-28">
  <div className="max-w-[1200px] mx-auto px-6">
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div>
        <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-8">
          Heading
        </h2>
        {/* content */}
      </div>
      <div className="rounded-2xl overflow-hidden">
        <img src={img} className="w-full h-auto object-cover" />
      </div>
    </div>
  </div>
</section>
```

### Marketing Feature Pills / Tags
```tsx
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12B8C4]/10 text-[#12B8C4] text-[13px] font-medium">
  Tag text
</span>
```

### Marketing Checklist
```tsx
<ul className="space-y-4">
  <li className="flex items-start gap-3">
    <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
    <span className="text-[16px] text-[#556070]">Feature description</span>
  </li>
</ul>
```

---

## Navigation — Marketing Pages

Marketing pages use a shared top nav pattern:
- Logo left, nav links centre, CTA button right
- Nav links: `text-[15px] text-[#556070] hover:text-[#0B0F17]`
- Active link: `text-[#0B0F17] font-medium`
- Primary CTA: teal rounded-full button
- Footer: 5-column grid (brand + 4 link groups), `border-t border-[#E6E8EC]`

---

## Hero Animation Pattern

Both Home and Investor home use a square-video hero layout:
```tsx
<section className="overflow-hidden">
  <div className="max-w-[1200px] mx-auto"> {/* NO px-6 on container */}
    <div className="grid lg:grid-cols-2 gap-0 items-center">
      {/* Left: text with its own padding */}
      <div className="px-6 pr-8 lg:pr-12">
        {/* heading, body, CTA buttons */}
      </div>
      {/* Right: square video, flush to edge */}
      <div className="aspect-square overflow-hidden">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover" />
      </div>
    </div>
  </div>
</section>
```

---

## Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Use `border-gray-100` / `border-[#E6E8EC]` for dividers | Use heavy card shadows (`shadow-lg`, `shadow-md`) on content |
| Use pixel font sizes in the app (`text-[13px]`) | Use Tailwind named scale (`text-sm`, `text-base`) in app UI |
| Use `tabular-nums` for all financial figures | Align financial data without `tabular-nums` |
| Use colour only to signal meaning (paid, overdue, risk) | Use teal/green/red/amber decoratively |
| Keep empty states minimal (small icon + one-line message) | Use large illustrations or multi-paragraph empty states |
| Use `rounded-full` for marketing CTAs | Use `rounded-full` buttons inside the product UI |
| Use `rounded-lg` or `rounded-xl` for cards/images in marketing | Use `rounded-full` on images |
| Alternate text-left/image-right and image-left/text-right in multi-section marketing pages | Stack all sections with the same layout direction |

---

## Key Files for Reference

| File | What it demonstrates |
|---|---|
| `client/src/pages/action-centre.tsx` | App variant: sticky header, tabs, list rows, density |
| `client/src/pages/settings.tsx` | App variant: tabbed settings, form inputs, section separators |
| `client/src/pages/Home.tsx` | Marketing variant: hero animation, sections, nav, footer |
| `client/src/pages/Partners.tsx` | Marketing variant: 2-column sections with images |
| `client/src/pages/investors/index.tsx` | Investor marketing variant: hero, section layout |
| `client/src/pages/investors/financials.tsx` | Data-dense tables, SEIS calculator, investor design |
| `client/src/components/layout/new-sidebar.tsx` | App sidebar: nav items, active state, user menu |
| `client/src/components/investors/InvestorNav.tsx` | Investor nav bar pattern |
| `client/src/components/investors/InvestorFooter.tsx` | Investor footer pattern |
