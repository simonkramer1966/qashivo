# Qashivo Brand Guidelines

## Design System Overview

Qashivo uses a clean, minimal design aesthetic. The visual language is professional, trustworthy, and fintech-focused with an emphasis on clarity and whitespace.

---

## Color Palette

### Primary Brand Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Qashivo Teal** | `#17B6C3` | `188 74% 42%` | Primary buttons, links, accents, brand identity |
| **Teal Hover** | `#1396A1` | - | Button hover states |

### Status Colors (Desaturated Fintech Palette)

| Status | Hex | RGB | Usage |
|--------|-----|-----|-------|
| **Success** | `#4FAD80` | `79, 173, 128` | Completed actions, positive outcomes, payments received |
| **Warning** | `#E8A23B` | `232, 162, 59` | Pending items, attention needed, approaching due dates |
| **Error/Critical** | `#C75C5C` | `199, 92, 92` | Errors, overdue invoices, critical alerts |

### Neutral Colors

| Name | Hex/Value | Usage |
|------|-----------|-------|
| **Background** | `#FFFFFF` (pure white) | Page backgrounds |
| **Card Background** | `#FFFFFF` | Card surfaces |
| **Text Primary** | `gray-900` / near-black | Headlines, important text |
| **Text Secondary** | `gray-600` | Body text, descriptions |
| **Text Muted** | `gray-500` | Subtitles, hints |
| **Text Light** | `gray-400` | Placeholders |
| **Border** | `gray-200` | Card and input borders |

---

## Typography

### Font Families

- **Headings**: `Archivo` - Bold, confident, professional
- **Body Text**: `DM Sans` - Clean, readable, modern

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

| Element | Desktop Size | Mobile Size | Weight | Font |
|---------|--------------|-------------|--------|------|
| **H1** | `text-5xl` (48px) | `text-4xl` (36px) | Bold (700) | Archivo |
| **H2** | `text-4xl` (36px) | `text-3xl` (30px) | Bold (700) | Archivo |
| **H3** | `text-2xl` (24px) | `text-xl` (20px) | Semibold (600) | Archivo |
| **H4** | `text-lg` (18px) | `text-base` (16px) | Semibold (600) | Archivo |
| **Body** | `text-lg` (18px) | `text-base` (16px) | Regular (400) | DM Sans |
| **Small** | `text-sm` (14px) | `text-sm` (14px) | Regular (400) | DM Sans |

### Text Alignment
- Marketing pages: `text-center` for hero sections
- Body copy: Centered with generous line height (`leading-relaxed`)

---

## Backgrounds

### Page Background
```css
bg-white
```
Pure white background for all marketing pages. No gradients, no blur effects.

### Header Background
```css
bg-white border-b border-gray-100
```
Clean white header with subtle bottom border.

---

## Component Styles

### Buttons

#### Primary Button (CTA)
```css
bg-[#17B6C3] hover:bg-[#1396A1] text-white font-medium
px-8 py-4 rounded-full
inline-flex items-center gap-2
transition-colors duration-200
```
Use with arrow icon (`→`) for CTAs like "Book a demo".

#### Secondary Button / Text Link
```css
text-gray-900 font-medium
underline-offset-4 hover:underline
```
Simple text link, no background.

#### Ghost Button
```css
text-gray-600 font-medium
hover:text-gray-900
transition-colors duration-200
```

### Cards

#### Standard Card
```css
bg-white rounded-xl shadow-sm border border-gray-100
```

#### Card with Hover
```css
bg-white rounded-xl shadow-sm border border-gray-100
hover:shadow-md transition-shadow duration-200
```

#### Featured Card (Dashboard Preview)
```css
bg-white rounded-xl shadow-lg border border-gray-200
```

### Input Fields

```css
w-full bg-white border border-gray-200 rounded-lg
px-4 py-3 text-base
focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]
placeholder:text-gray-400
```

### Badges

#### Status Badges
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
/* Success */
w-2 h-2 rounded-full bg-[#4FAD80]

/* Warning */
w-2 h-2 rounded-full bg-[#E8A23B]

/* Error */
w-2 h-2 rounded-full bg-[#C75C5C]
```

---

## Spacing & Layout

### Border Radius

| Size | Value | Usage |
|------|-------|-------|
| **Pill** | `rounded-full` | Primary buttons, badges |
| **Large** | `rounded-xl` (12px) | Cards |
| **Medium** | `rounded-lg` (8px) | Inputs, smaller elements |

### Shadows

```css
/* Subtle - for cards */
shadow-sm
/* box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); */

/* Standard - for featured cards */
shadow-md
/* box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); */

/* Prominent - for dashboard previews */
shadow-lg
/* box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); */
```

### Container

```css
/* Marketing page container */
max-w-4xl mx-auto px-6
text-center
```

### Vertical Spacing

```css
/* Section padding */
py-16 md:py-24

/* Between elements */
space-y-6 or space-y-8
```

### Touch Targets

All interactive elements must have a minimum size of `44px x 44px`:
```css
min-h-[44px] min-w-[44px]
```

---

## Marketing Page Patterns

### Hero Section
```css
/* Container */
bg-white py-16 md:py-24 px-6

/* Headline */
text-4xl md:text-5xl font-bold text-gray-900 text-center leading-tight

/* Body text */
text-lg text-gray-600 text-center leading-relaxed max-w-2xl mx-auto

/* CTA Button */
bg-[#17B6C3] text-white px-8 py-4 rounded-full inline-flex items-center gap-2

/* Subtitle below CTA */
text-sm text-gray-500 text-center
```

### Section Structure
1. Large bold headline (centered)
2. Supporting paragraph (centered, gray-600)
3. Primary CTA button with arrow icon
4. Text link below ("See how it works")
5. Tagline/subtitle
6. Product screenshot with shadow

### Navigation Header
```css
/* Header */
bg-white border-b border-gray-100

/* Logo */
h-8 w-auto

/* Nav links */
text-gray-600 hover:text-gray-900

/* Hamburger menu (mobile) */
text-gray-900
```

---

## Animations

### Transitions
```css
transition-colors duration-200
transition-shadow duration-200
```

### Hover States
- Buttons: Color change only, no scale effects
- Cards: Subtle shadow increase
- Links: Underline or color change

---

## Accessibility

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus States
```css
focus:outline-none 
focus-visible:ring-2 
focus-visible:ring-[#17B6C3] 
focus-visible:ring-offset-2
```

---

## Dark Mode

Dark mode uses adjusted values while maintaining the minimal aesthetic:

```css
.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --card: 217 33% 17%;
  --primary: 188 74% 42%; /* Teal stays the same */
  --border: 217 33% 17%;
}
```

---

## Quick Reference

### CSS Variables (HSL format)

```css
:root {
  --primary: 188 74% 42%;           /* #17B6C3 */
  --background: 0 0% 100%;          /* white */
  --foreground: 215 16% 20%;        /* dark gray */
  --success: 156 38% 50%;           /* #4FAD80 */
  --warning: 38 75% 57%;            /* #E8A23B */
  --error: 0 48% 58%;               /* #C75C5C */
  --border: 214 32% 91%;
  --radius: 0.75rem;
}
```

### Tailwind Classes Cheat Sheet

```
Page background:   bg-white
Primary button:    bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full px-8 py-4
Text link:         text-gray-900 font-medium
Card:              bg-white rounded-xl shadow-sm border border-gray-100
Input:             border-gray-200 rounded-lg focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]
Headline:          text-4xl md:text-5xl font-bold text-gray-900 text-center
Body text:         text-lg text-gray-600 text-center leading-relaxed
Subtitle:          text-sm text-gray-500 text-center
Success badge:     bg-[#4FAD80]/10 text-[#4FAD80] rounded-full
Warning badge:     bg-[#E8A23B]/10 text-[#E8A23B] rounded-full
Error badge:       bg-[#C75C5C]/10 text-[#C75C5C] rounded-full
```

---

## Design Principles

1. **White space is your friend** - Use generous padding and margins
2. **Less is more** - Minimal shadows, no gradients on backgrounds
3. **Clear hierarchy** - Bold headlines, lighter body text
4. **Centered layouts** - For marketing pages, center-align content
5. **Pill buttons** - Use `rounded-full` for primary CTAs
6. **Arrow icons** - Include `→` in CTA buttons to indicate action
