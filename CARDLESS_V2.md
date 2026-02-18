# Cardless v2.0 — Desktop Design System

A data-dense, typography-driven design system for professional financial software. Inspired by **Edward Tufte** (maximize data-ink ratio, eliminate chartjunk) and **Stephen Few** (minimize cognitive load, use color purposefully).

**Scope:** This document covers the desktop (v2.0) variant. A separate mobile variant (Cardless v3.0) uses card-based layouts, larger touch targets, and generous spacing — see the Mobile Variants section at the end.

---

## Core Philosophy

1. **Data first.** Every pixel should earn its place. Remove anything that doesn't convey information.
2. **No decoration.** No gradients, no backdrop blur, no decorative shadows, no rounded icon containers.
3. **White canvas.** Pure `bg-white` backgrounds. Content creates hierarchy, not surface treatment.
4. **Quiet structure.** Hairline borders (`border-gray-100`) separate sections. White space does the rest.
5. **Typography is the interface.** Size, weight, and color create hierarchy — not boxes, cards, or color fills.

---

## Color Palette

### Neutrals (primary palette)

> **Note:** The codebase uses both `gray-*` and `slate-*` Tailwind tokens. They are visually near-identical. By convention, page titles and subtitles use `text-slate-900` / `text-slate-400`, while all other UI (labels, metadata, borders, backgrounds) uses `gray-*`. Either is acceptable — just be consistent within a component.

| Token | Value | Usage |
|---|---|---|
| `text-gray-900` / `text-slate-900` | `#111827` | Primary text, headings, data values |
| `text-gray-700` | `#374151` | Secondary text, body content |
| `text-gray-600` | `#4B5563` | Supporting text |
| `text-gray-500` | `#6B7280` | Tertiary labels, metadata |
| `text-gray-400` / `text-slate-400` | `#9CA3AF` | Placeholder, timestamps, subtle labels |
| `text-gray-300` | `#D1D5DB` | Disabled icons, divider emphasis |
| `border-gray-100` | `#F3F4F6` | All borders, dividers, separators |
| `bg-gray-50` | `#F9FAFB` | Hover states, inset panels |
| `bg-white` | `#FFFFFF` | Page background, all surfaces |

### Semantic Colors (used sparingly, only to convey meaning)
| Token | Hex | Meaning |
|---|---|---|
| `#17B6C3` (Teal) | — | Brand accent, active states, primary actions |
| `#1396A1` | — | Teal hover state |
| `#4FAD80` (Green) | — | Positive values (collected, paid, success) |
| `#E8A23B` (Amber) | — | Warning, medium confidence |
| `#C75C5C` (Red) | — | Negative values (overdue, dispute, low confidence) |

### Status Badges
Badges use tinted backgrounds with matched text — no borders:
```
green:  bg-green-50 text-green-700
red:    bg-red-50 text-red-700
blue:   bg-blue-50 text-blue-700
amber:  bg-amber-50 text-amber-700
purple: bg-purple-50 text-purple-700
gray:   bg-gray-100 text-gray-600
```

---

## Typography Scale

A compact, intentional type scale. No arbitrary sizes.

| Size | Class | Weight | Usage |
|---|---|---|---|
| 24px | `text-[24px]` | `font-bold` | Logo / brand name only |
| 17px | `text-[17px]` | `font-semibold` | Page titles (`tracking-tight`) |
| 15px | `text-[15px]` | `font-semibold` | Detail panel headings |
| 14px | `text-[14px]` | `font-medium` | Sidebar navigation items |
| 13px | `text-[13px]` | `font-medium` | List item primary text, body text, form inputs, tab labels, subtitles |
| 12px | `text-[12px]` | normal | Secondary text, metadata, form labels |
| 11px | `text-[11px]` | `font-medium` | Badges, timestamps, section headers (`uppercase tracking-wider`), counters |

### Key Rules
- Page titles: `text-[17px] font-semibold text-slate-900 tracking-tight`
- Page subtitles: `text-[13px] text-slate-400 mt-0.5`
- Section headers: `text-[11px] font-medium text-gray-400 uppercase tracking-wider`
- Numbers: Always use `tabular-nums` for alignment
- Sidebar group labels: `text-[11px] uppercase tracking-wider text-gray-400 font-medium`

---

## Spacing System

Compact spacing that prioritizes density.

| Context | Value | Usage |
|---|---|---|
| Page padding | `px-6 lg:px-8` | Horizontal page margins |
| Header padding | `py-5` | Vertical padding in sticky header |
| List item padding | `px-6 py-3` | Standard row padding |
| Detail panel padding | `px-6 lg:px-8 py-6` | Right-side content areas |
| Inset panel padding | `px-4 py-3` | Content blocks within panels |
| Between sections | `space-y-5` | Vertical rhythm in detail views |
| Form gap | `gap-3` | Grid gap for form fields |
| Small gap | `gap-1.5` or `gap-2` | Icon-to-text, button content |

### Key Rules
- No padding larger than `py-6` in content areas
- Empty states use `py-10` — no more
- Margins between label and value: `mt-0.5` or `mt-1`
- Loading skeletons match the exact dimensions of real content

---

## Layout Patterns

### Page Structure
Every page follows the same shell:
```
<div className="flex h-screen bg-white">
  <Sidebar />            {/* Hidden on mobile */}
  <main className="flex-1 flex flex-col min-h-0">
    <StickyHeader />      {/* Title + subtitle + actions */}
    <TabBar />            {/* Optional, inline underline tabs */}
    <Content />           {/* Scrollable content area */}
  </main>
  <BottomNav />           {/* Mobile only */}
</div>
```

### Sticky Header
```
<div className="sticky top-0 z-40 bg-white">
  <div className="px-6 lg:px-8 py-5 border-b border-gray-100">
    <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Page Title</h2>
    <p className="text-[13px] text-slate-400 mt-0.5">Brief description</p>
  </div>
</div>
```

### Tab Bar (inline, underline style)
Tabs sit directly below the header, separated by `border-b border-gray-100`. No background, no pill shapes.
```
<button className="px-3 py-2.5 text-[13px] font-medium border-b-2
  text-slate-900 border-[#17B6C3]">        {/* Active */}
<button className="px-3 py-2.5 text-[13px] font-medium border-b-2
  text-gray-400 border-transparent">        {/* Inactive */}
```
Tab counts use `text-[11px] tabular-nums text-gray-400` inline after the label.

### Split-Pane Layout (list + detail)
For pages like Inbox:
```
<div className="flex flex-col lg:flex-row h-full">
  <div className="lg:w-[340px] lg:border-r border-gray-100">  {/* List */}
  <div className="flex-1">                                      {/* Detail */}
</div>
```

### Data Tables
- No card wrapper — table sits directly in the page flow
- `divide-y divide-gray-100` between rows
- Header row: `text-[11px] font-medium text-gray-400 uppercase tracking-wider`
- Data cells: `text-[13px] text-gray-900` for primary, `text-gray-500` for secondary
- Row hover: `hover:bg-gray-50`
- Sortable columns indicated by subtle caret icons

---

## Component Conventions

### Buttons

**Primary action:**
```
<button className="h-8 px-4 text-[13px] font-medium bg-[#17B6C3] hover:bg-[#1396A1]
  text-white rounded transition-colors">
```

**Secondary / ghost:**
```
<button className="h-7 px-2.5 text-[12px] text-gray-500 hover:text-gray-700
  hover:bg-gray-50 rounded transition-colors">
```

**Text link button:**
```
<button className="h-7 px-2.5 text-[12px] font-medium text-[#17B6C3]
  hover:bg-[#17B6C3]/5 rounded transition-colors">
```

### Badges / Tags
Small, no border, tinted background:
```
<span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">
```

### Form Controls
- Height: `h-8`
- Font: `text-[13px]`
- Labels: `text-[12px] text-gray-500` above the field
- Label-to-field spacing: `space-y-1`
- Textareas: `resize-none`, 2-3 rows

### Active Selection Indicator
A thin vertical accent bar on the left edge of the selected item:
```
<span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#17B6C3] rounded-full" />
```

### Dialogs
- `sm:max-w-md` for assignment/simple forms
- Title: `text-[15px]`
- Clean white background, no inner cards
- Inset context block: `bg-gray-50 rounded px-3 py-2`

---

## Empty States

Minimal. No large icons, no decorative illustrations, no gradient backgrounds.

```
<div className="px-6 py-10 text-center">
  <Icon className="h-5 w-5 text-gray-300 mx-auto mb-2" />
  <p className="text-[13px] text-gray-500">Primary message</p>
  <p className="text-[11px] text-gray-400 mt-0.5">Supporting detail</p>
</div>
```

- Icon: 20px (`h-5 w-5`), `text-gray-300`
- No background circle or container around the icon
- Maximum `py-10` vertical padding
- Two lines of text maximum

---

## Loading States

Skeleton loaders that match content dimensions exactly. No spinner wheels.

```
<div className="px-6 py-3">
  <div className="h-3 bg-gray-100 rounded w-3/4 mb-2 animate-pulse" />
  <div className="h-2.5 bg-gray-50 rounded w-1/2 animate-pulse" />
</div>
```

- Use `bg-gray-100` for primary skeleton bars
- Use `bg-gray-50` for secondary skeleton bars
- `animate-pulse` for subtle animation
- Match the padding and spacing of real content rows

---

## What to Avoid

| Don't | Do Instead |
|---|---|
| `bg-gradient-to-*` | `bg-white` |
| `backdrop-blur-*` | Plain `bg-white` |
| `shadow-lg`, `shadow-xl` | No shadow, or `border-gray-100` only |
| `bg-white/80` (translucent) | `bg-white` (opaque) |
| Rounded icon containers (`p-3 bg-teal/10 rounded-lg`) | Bare icon with color |
| `Card` / `CardHeader` / `CardContent` wrappers | Direct layout with borders |
| Large empty state icons (`h-8`, `h-10`) | Small icon `h-5 w-5` |
| Decorative dividers or rules | `border-gray-100` hairlines |
| Color for decoration | Color only for meaning |
| Multiple font sizes close together | Stick to the type scale |

---

## Sidebar

- Background: `bg-white`, right border `border-r border-gray-100`
- Nav items: `text-[14px]`, active = `text-gray-900 font-medium`, inactive = `text-gray-500`
- Active indicator: teal bar on left edge (`w-0.5 bg-[#17B6C3]`)
- Active icon: `text-[#17B6C3]`, inactive icon: `text-gray-400`
- Group labels: `text-[11px] uppercase tracking-wider text-gray-400 font-medium px-3 mb-2`
- Collapsible with smooth `transition-all duration-300`

---

## Data Visualization (Charts)

Follow Tufte and Few principles:

- Remove unnecessary gridlines (especially vertical)
- Sparse tick marks on axes
- No 3D effects, no gradients on bars/lines
- Color only to distinguish data series or convey meaning
- Use `tabular-nums` for all numeric labels
- Prefer small multiples over complex multi-series charts
- Synchronized scales when comparing across charts
- Tooltips: minimal, `text-[12px]`, white background with `border-gray-100`

---

## Exceptions and Allowed Patterns

Some components intentionally deviate from strict "no surface treatment" rules:

### Metric Tiles (Overview page)
Dashboard KPI tiles use `bg-gray-50 rounded-xl p-4` as inset panels to group related numbers. This is acceptable because:
- They serve a structural purpose (grouping metric + label)
- They use the neutral `gray-50`, not decorative color
- No shadows, no borders — just a subtle fill

### Typography Outside the Scale
The Overview page uses `text-lg` and `text-xs` (standard Tailwind sizes) for metric values and labels respectively. These are allowed for dashboard data where visual hierarchy demands it. The fixed pixel scale (`text-[11px]` through `text-[17px]`) applies to list-based, tabular, and form-based interfaces.

---

## Mobile Variant (Cardless v3.0)

The mobile experience uses a different design philosophy documented separately. Key differences:

| Aspect | v2.0 Desktop | v3.0 Mobile |
|---|---|---|
| Layout | Split panes, data tables | Single column, cards |
| Spacing | Compact (`px-6 py-3`) | Generous (`px-4 py-4`) |
| Touch targets | Standard | 44pt minimum |
| Headers | Title + subtitle | Title only (subtitle hidden) |
| Navigation | Left sidebar | Bottom tab bar (`BottomNav`) |
| Disclosure | All data visible | Progressive disclosure |
| Typography | Smaller scale (11-17px) | Larger scale for readability |

Mobile pages use `lg:hidden` / `hidden lg:block` breakpoints to switch between variants. The sidebar is hidden on mobile; `BottomNav` provides primary navigation.
