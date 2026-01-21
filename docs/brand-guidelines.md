# Qashivo Brand Guidelines

## Design System Overview

Qashivo uses a modern, Apple-inspired clean design aesthetic with glassmorphism effects. The visual language is professional, trustworthy, and fintech-focused.

---

## Color Palette

### Primary Brand Colors

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Nexus Teal** | `#17B6C3` | `188 74% 42%` | Primary buttons, links, accents, brand identity |
| **Teal Hover** | `#1396A1` | - | Button hover states |
| **Gold Accent** | `#A98743` | - | Secondary highlights, premium features |

### Status Colors (Desaturated Fintech Palette)

| Status | Hex | RGB | Usage |
|--------|-----|-----|-------|
| **Success** | `#4FAD80` | `79, 173, 128` | Completed actions, positive outcomes, payments received |
| **Warning** | `#E8A23B` | `232, 162, 59` | Pending items, attention needed, approaching due dates |
| **Error/Critical** | `#C75C5C` | `199, 92, 92` | Errors, overdue invoices, critical alerts |

### Neutral Colors

| Name | Hex/Value | Usage |
|------|-----------|-------|
| **Background** | `#FAFAFA` | Page base background |
| **Card Background** | `white/80` with blur | Card surfaces |
| **Text Primary** | `gray-900` | Headings, important text |
| **Text Secondary** | `gray-600` | Body text, descriptions |
| **Text Muted** | `gray-400` | Placeholders, hints |
| **Border** | `gray-200` / `white/50` | Card and input borders |

---

## Typography

### Font Families

- **Headings**: `Archivo` - Bold, confident, professional
- **Body Text**: `DM Sans` - Clean, readable, modern

### Font Import
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
```

### Type Scale

| Element | Desktop Size | Mobile Size | Weight | Font |
|---------|--------------|-------------|--------|------|
| **H1** | `text-6xl` (60px) | `text-4xl` (36px) | Bold (700) | Archivo |
| **H2** | `text-4xl` (36px) | `text-3xl` (30px) | Bold (700) | Archivo |
| **H3** | `text-2xl` (24px) | `text-xl` (20px) | Semibold (600) | Archivo |
| **H4** | `text-lg` (18px) | `text-base` (16px) | Semibold (600) | Archivo |
| **Body** | `text-base` (16px) | `text-base` (16px) | Regular (400) | DM Sans |
| **Small** | `text-sm` (14px) | `text-sm` (14px) | Regular (400) | DM Sans |

---

## Backgrounds

### Page Backgrounds

```css
/* Primary gradient background (marketing pages) */
bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50

/* Base application background */
bg-[#FAFAFA]
```

### Header Background

```css
/* Sticky header with glass effect */
bg-white/95 backdrop-blur-sm border-b border-gray-200
```

---

## Component Styles

### Buttons

#### Primary Button
```css
bg-[#17B6C3] hover:bg-[#1396A1] text-white font-semibold
px-6 py-3 rounded-2xl shadow-sm
transition-all duration-200 active:scale-[0.98]
min-h-[44px]
```

#### Secondary Button
```css
bg-slate-100 text-slate-900 font-medium
px-6 py-3 rounded-2xl
transition-all duration-200 hover:bg-slate-200 active:scale-[0.98]
min-h-[44px]
```

#### Ghost Button
```css
text-slate-600 font-medium
px-4 py-2 rounded-xl
transition-all duration-200 hover:bg-slate-100 active:scale-[0.98]
min-h-[44px]
```

### Cards

#### Glassmorphism Card (Primary)
```css
bg-white/80 backdrop-blur-sm border-white/50 shadow-lg rounded-2xl
transition-all duration-200
```

#### Apple-Style Card
```css
bg-white rounded-2xl shadow-sm border border-slate-200
transition-all duration-200
```

#### Card with Hover Effect
```css
bg-white rounded-2xl shadow-sm border border-slate-200
transition-all duration-200 hover:shadow-md active:scale-[0.99]
```

### Input Fields

```css
w-full bg-white border border-slate-200 rounded-xl
px-4 py-3 text-base
transition-all duration-200
focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]
placeholder:text-slate-400
min-h-[44px]
```

### Badges

#### Teal Tag (Category/Label)
```css
bg-[#17B6C3]/10 text-[#17B6C3] 
px-4 py-2 rounded-full
font-semibold text-sm uppercase tracking-wide
```

#### Gold Tag (Premium/Highlight)
```css
bg-[#A98743]/10 text-[#A98743]
px-4 py-2 rounded-full
font-semibold text-sm uppercase tracking-wide
```

#### Status Badges
```css
/* Success */
bg-[#4FAD80]/10 text-[#4FAD80] px-2.5 py-1 rounded-full text-sm font-medium

/* Warning */
bg-[#E8A23B]/10 text-[#E8A23B] px-2.5 py-1 rounded-full text-sm font-medium

/* Error */
bg-[#C75C5C]/10 text-[#C75C5C] px-2.5 py-1 rounded-full text-sm font-medium

/* Info */
bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full text-sm font-medium
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
| **Default** | `1rem` (16px) / `rounded-2xl` | Cards, buttons |
| **Full** | `rounded-full` | Badges, tags, avatars |
| **Medium** | `rounded-xl` | Inputs, smaller cards |

### Shadows

```css
/* Subtle - for inputs, small elements */
shadow-sm
/* or: box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); */

/* Standard - for cards */
shadow-lg
/* or: box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); */

/* Prominent - for featured cards */
shadow-xl

/* Hero - for main CTAs and hero images */
shadow-2xl
```

### Container

```css
/* Standard container with responsive padding */
w-full px-4 sm:px-6 lg:px-8
max-w-7xl mx-auto
```

### Touch Targets

All interactive elements must have a minimum size of `44px x 44px` for accessibility:
```css
min-h-[44px] min-w-[44px]
```

---

## Animations

### Transitions

```css
/* Standard transition for all interactive elements */
transition-all duration-200
```

### Button Press Effect

```css
active:scale-[0.98]
```

### Fade In Animation

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in { animation: fadeIn 0.8s ease-out; }
.animate-fade-in-delay-1 { animation: fadeIn 0.8s ease-out 0.2s both; }
.animate-fade-in-delay-2 { animation: fadeIn 0.8s ease-out 0.4s both; }
.animate-fade-in-delay-3 { animation: fadeIn 0.8s ease-out 0.6s both; }
```

---

## Accessibility

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
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

Dark mode uses the same design tokens with adjusted values:

```css
.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --card: 222 47% 11%;
  --primary: 188 74% 42%; /* Teal stays the same */
  --muted: 217 33% 17%;
  --border: 217 33% 17%;
}
```

---

## Marketing Page Patterns

### Hero Section
- Gradient background
- Centered content with max-width
- Large bold headline with teal accent color for key phrase
- CTA button with lock icon and "100% Secure" reassurance

### Value Proposition Cards
- 3-column grid on desktop, stacked on mobile
- Icon/image at top
- Bold heading
- Gray body text
- Teal accent text for key benefit

### Section Headers
- Teal or gold tag above heading
- Large bold heading
- Supporting paragraph in gray

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
  --radius: 1rem;
}
```

### Tailwind Classes Cheat Sheet

```
Primary button:    bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-2xl
Card:              bg-white/80 backdrop-blur-sm border-white/50 shadow-lg rounded-2xl
Input:             border-slate-200 rounded-xl focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]
Page background:   bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50
Success badge:     bg-[#4FAD80]/10 text-[#4FAD80] rounded-full
Warning badge:     bg-[#E8A23B]/10 text-[#E8A23B] rounded-full
Error badge:       bg-[#C75C5C]/10 text-[#C75C5C] rounded-full
```
