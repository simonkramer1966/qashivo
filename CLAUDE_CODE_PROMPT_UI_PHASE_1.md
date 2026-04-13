# CLAUDE CODE PROMPT — UI REFRESH PHASE 1: DESIGN TOKEN INSTALLATION

## CONTEXT

Qashivo is a React/Vite + Express TypeScript monolith using shadcn/ui components and Tailwind CSS. The UI currently looks functional but generic — "a dev built it." We're installing a comprehensive design token system that will transform the visual foundation of every page in one go.

This is Phase 1 of a 3-phase UI refresh. This session ONLY installs the tokens, fonts, and base styles. It does NOT touch individual page layouts or components — those come in Phase 2 and 3.

## FILES TO CREATE

### 1. `client/src/styles/tokens.css`

Create this file with ALL of the following CSS custom properties. Both light and dark mode values must be included.

```css
/* ============================================
   QASHIVO DESIGN TOKENS v1.0
   The visual DNA — every colour, size, and 
   spacing decision in one place.
   ============================================ */

:root {
  /* === NEUTRALS (warm gray family) === */
  --q-bg-page: #F8F7F5;
  --q-bg-surface: #FFFFFF;
  --q-bg-surface-hover: #F4F3F0;
  --q-bg-surface-alt: #F1F0EC;
  --q-bg-input: #FFFFFF;
  --q-bg-sidebar: #FFFFFF;

  --q-text-primary: #1A1918;
  --q-text-secondary: #6B6A66;
  --q-text-tertiary: #9C9B97;
  --q-text-muted: #C4C3BF;

  --q-border-default: rgba(0, 0, 0, 0.08);
  --q-border-hover: rgba(0, 0, 0, 0.15);
  --q-border-strong: rgba(0, 0, 0, 0.25);

  /* === SEMANTIC: Money in (green) === */
  --q-money-in-bg: #ECFAEF;
  --q-money-in-text: #15803D;
  --q-money-in-border: #BBF7D0;

  /* === SEMANTIC: Risk / money out (red) === */
  --q-risk-bg: #FEF2F2;
  --q-risk-text: #DC2626;
  --q-risk-border: #FECACA;

  /* === SEMANTIC: Attention / warning (amber) === */
  --q-attention-bg: #FFFBEB;
  --q-attention-text: #B45309;
  --q-attention-border: #FDE68A;

  /* === SEMANTIC: Information (blue) === */
  --q-info-bg: #EFF6FF;
  --q-info-text: #1D4ED8;
  --q-info-border: #BFDBFE;

  /* === BRAND ACCENT (deep teal) === */
  --q-accent: #0F766E;
  --q-accent-hover: #0D6D66;
  --q-accent-bg: #F0FDFA;

  /* === VIP (purple) === */
  --q-vip-bg: #F5F3FF;
  --q-vip-text: #6D28D9;

  /* === CHART COLOURS === */
  --q-chart-primary: #0F766E;
  --q-chart-secondary: #6B6A66;
  --q-chart-positive: #15803D;
  --q-chart-negative: #DC2626;
  --q-chart-band: rgba(15, 118, 110, 0.08);
  --q-chart-grid: rgba(0, 0, 0, 0.05);
  --q-chart-tooltip-bg: #1A1918;
  --q-chart-tooltip-text: #FFFFFF;

  /* === TYPOGRAPHY === */
  --q-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --q-font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* === SPACING === */
  --q-space-xs: 4px;
  --q-space-sm: 8px;
  --q-space-md: 12px;
  --q-space-lg: 16px;
  --q-space-xl: 24px;
  --q-space-2xl: 32px;
  --q-space-3xl: 48px;

  /* === RADIUS === */
  --q-radius-sm: 4px;
  --q-radius-md: 8px;
  --q-radius-lg: 12px;
  --q-radius-xl: 16px;

  /* === TRANSITIONS === */
  --q-transition-fast: 0.1s ease;
  --q-transition-default: 0.15s ease;
  --q-transition-slow: 0.3s ease;

  /* === LAYOUT === */
  --q-sidebar-width: 240px;
  --q-sidebar-collapsed: 64px;
  --q-content-max-width: 1200px;
}

/* === DARK MODE === */
@media (prefers-color-scheme: dark) {
  :root {
    --q-bg-page: #141413;
    --q-bg-surface: #1E1E1C;
    --q-bg-surface-hover: #2A2A27;
    --q-bg-surface-alt: #252523;
    --q-bg-input: #1E1E1C;
    --q-bg-sidebar: #1A1A18;

    --q-text-primary: #EDECEA;
    --q-text-secondary: #9C9B97;
    --q-text-tertiary: #6B6A66;
    --q-text-muted: #44443F;

    --q-border-default: rgba(255, 255, 255, 0.08);
    --q-border-hover: rgba(255, 255, 255, 0.15);
    --q-border-strong: rgba(255, 255, 255, 0.25);

    --q-money-in-bg: #0C2912;
    --q-money-in-text: #4ADE80;
    --q-money-in-border: #166534;

    --q-risk-bg: #2D0F0F;
    --q-risk-text: #FCA5A5;
    --q-risk-border: #7F1D1D;

    --q-attention-bg: #2D2006;
    --q-attention-text: #FCD34D;
    --q-attention-border: #78350F;

    --q-info-bg: #0C1929;
    --q-info-text: #93C5FD;
    --q-info-border: #1E3A5F;

    --q-accent: #2DD4BF;
    --q-accent-hover: #5EEAD4;
    --q-accent-bg: #0D2D2A;

    --q-vip-bg: #1E1833;
    --q-vip-text: #C4B5FD;

    --q-chart-primary: #2DD4BF;
    --q-chart-secondary: #9C9B97;
    --q-chart-positive: #4ADE80;
    --q-chart-negative: #FCA5A5;
    --q-chart-band: rgba(45, 212, 191, 0.08);
    --q-chart-grid: rgba(255, 255, 255, 0.05);
  }
}

/* Also support class-based dark mode for manual toggle */
.dark {
  --q-bg-page: #141413;
  --q-bg-surface: #1E1E1C;
  --q-bg-surface-hover: #2A2A27;
  --q-bg-surface-alt: #252523;
  --q-bg-input: #1E1E1C;
  --q-bg-sidebar: #1A1A18;

  --q-text-primary: #EDECEA;
  --q-text-secondary: #9C9B97;
  --q-text-tertiary: #6B6A66;
  --q-text-muted: #44443F;

  --q-border-default: rgba(255, 255, 255, 0.08);
  --q-border-hover: rgba(255, 255, 255, 0.15);
  --q-border-strong: rgba(255, 255, 255, 0.25);

  --q-money-in-bg: #0C2912;
  --q-money-in-text: #4ADE80;
  --q-money-in-border: #166534;

  --q-risk-bg: #2D0F0F;
  --q-risk-text: #FCA5A5;
  --q-risk-border: #7F1D1D;

  --q-attention-bg: #2D2006;
  --q-attention-text: #FCD34D;
  --q-attention-border: #78350F;

  --q-info-bg: #0C1929;
  --q-info-text: #93C5FD;
  --q-info-border: #1E3A5F;

  --q-accent: #2DD4BF;
  --q-accent-hover: #5EEAD4;
  --q-accent-bg: #0D2D2A;

  --q-vip-bg: #1E1833;
  --q-vip-text: #C4B5FD;

  --q-chart-primary: #2DD4BF;
  --q-chart-secondary: #9C9B97;
  --q-chart-positive: #4ADE80;
  --q-chart-negative: #FCA5A5;
  --q-chart-band: rgba(45, 212, 191, 0.08);
  --q-chart-grid: rgba(255, 255, 255, 0.05);
}
```

### 2. `client/src/styles/base.css`

Create this file with global base styles that apply the tokens to the app shell. This replaces/supplements existing base styles — check what exists first and merge carefully.

```css
/* ============================================
   QASHIVO BASE STYLES
   Applied globally — sets the foundation
   ============================================ */

/* Import fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

/* Root */
html {
  font-family: var(--q-font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--q-bg-page);
  color: var(--q-text-primary);
  font-size: 14px;
  line-height: 1.6;
}

/* Tabular numbers for all monetary displays */
.q-mono {
  font-family: var(--q-font-mono);
  font-variant-numeric: tabular-nums;
}

/* Amount formatting utilities */
.q-amount {
  font-family: var(--q-font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.q-amount--overdue {
  color: var(--q-risk-text);
}

.q-amount--positive {
  color: var(--q-money-in-text);
}

/* Column header style */
.q-col-header {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--q-text-tertiary);
}

/* Section label (sidebar, page sections) */
.q-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--q-text-tertiary);
}

/* Trend indicators */
.q-trend--up {
  color: var(--q-money-in-text);
}

.q-trend--down {
  color: var(--q-risk-text);
}

.q-trend--flat {
  color: var(--q-text-tertiary);
}

/* Skeleton loading animation */
.q-skeleton {
  background: var(--q-bg-surface-alt);
  border-radius: var(--q-radius-md);
  animation: q-pulse 1.5s ease-in-out infinite;
}

@keyframes q-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Selection colour */
::selection {
  background-color: var(--q-accent-bg);
  color: var(--q-text-primary);
}

/* Scrollbar styling (subtle) */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--q-border-hover);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--q-border-strong);
}
```

## FILES TO MODIFY

### 3. Update `tailwind.config.ts`

Find the existing Tailwind config and EXTEND (do not replace) the theme with:

```typescript
// Add to the extend section of the theme
extend: {
  colors: {
    'q-bg': {
      page: 'var(--q-bg-page)',
      surface: 'var(--q-bg-surface)',
      'surface-hover': 'var(--q-bg-surface-hover)',
      'surface-alt': 'var(--q-bg-surface-alt)',
      input: 'var(--q-bg-input)',
      sidebar: 'var(--q-bg-sidebar)',
    },
    'q-text': {
      primary: 'var(--q-text-primary)',
      secondary: 'var(--q-text-secondary)',
      tertiary: 'var(--q-text-tertiary)',
      muted: 'var(--q-text-muted)',
    },
    'q-border': {
      DEFAULT: 'var(--q-border-default)',
      hover: 'var(--q-border-hover)',
      strong: 'var(--q-border-strong)',
    },
    'q-money-in': {
      DEFAULT: 'var(--q-money-in-text)',
      bg: 'var(--q-money-in-bg)',
      border: 'var(--q-money-in-border)',
    },
    'q-risk': {
      DEFAULT: 'var(--q-risk-text)',
      bg: 'var(--q-risk-bg)',
      border: 'var(--q-risk-border)',
    },
    'q-attention': {
      DEFAULT: 'var(--q-attention-text)',
      bg: 'var(--q-attention-bg)',
      border: 'var(--q-attention-border)',
    },
    'q-info': {
      DEFAULT: 'var(--q-info-text)',
      bg: 'var(--q-info-bg)',
      border: 'var(--q-info-border)',
    },
    'q-accent': {
      DEFAULT: 'var(--q-accent)',
      hover: 'var(--q-accent-hover)',
      bg: 'var(--q-accent-bg)',
    },
    'q-vip': {
      DEFAULT: 'var(--q-vip-text)',
      bg: 'var(--q-vip-bg)',
    },
  },
  fontFamily: {
    'q-sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    'q-mono': ['JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
  },
  borderRadius: {
    'q-sm': '4px',
    'q-md': '8px',
    'q-lg': '12px',
    'q-xl': '16px',
  },
  spacing: {
    'q-xs': '4px',
    'q-sm': '8px',
    'q-md': '12px',
    'q-lg': '16px',
    'q-xl': '24px',
    'q-2xl': '32px',
    'q-3xl': '48px',
  },
  fontSize: {
    'q-hero': ['32px', { lineHeight: '1.1', fontWeight: '600' }],
    'q-metric': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
    'q-page-title': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
    'q-section': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
    'q-body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
    'q-body-medium': ['14px', { lineHeight: '1.6', fontWeight: '500' }],
    'q-small': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
    'q-caption': ['11px', { lineHeight: '1.4', fontWeight: '500' }],
  },
},
```

Do NOT remove any existing Tailwind config values — shadcn/ui depends on them. Only ADD the q-prefixed extensions.

### 4. Update the CSS import chain

Find the main CSS entry point (likely `client/src/index.css` or similar) and add the token imports BEFORE the Tailwind directives:

```css
@import './styles/tokens.css';
@import './styles/base.css';

/* Existing Tailwind directives stay as they are */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

If the imports need to go after Tailwind directives due to the build setup, that's fine — the CSS custom properties in tokens.css will work regardless of import order. Just make sure both files are imported.

### 5. Update the app's root layout

Find the root layout component (likely `client/src/App.tsx` or a layout wrapper) and ensure the `<body>` or root container uses the new page background:

- The root container should have `bg-q-bg-page` applied (or the existing background should be replaced with `var(--q-bg-page)`)
- The main content area background should be `bg-q-bg-page`
- Any existing hardcoded background colours (#fff, white, gray-50, etc.) on the root layout should be replaced with the token equivalents

### 6. Update the sidebar background

Find the sidebar component and update its background from whatever it currently is to `bg-q-bg-sidebar`. Also update the sidebar border (likely a right border) to use `border-q-border`.

## WHAT NOT TO TOUCH

- Do NOT modify any page-specific components, tables, cards, or charts
- Do NOT modify any shadcn/ui component source files
- Do NOT remove existing Tailwind config values
- Do NOT change any routing, API calls, or business logic
- Do NOT modify any server-side files

## VERIFICATION

After completing the changes:

1. Run the dev server and confirm the app loads without errors
2. Check that the page background is warm gray (#F8F7F5), not pure white
3. Check that the sidebar background is white, creating a subtle contrast against the page
4. Check that text throughout the app uses the Inter font
5. Check that no existing shadcn/ui components are visually broken
6. The app should look subtly different — warmer, calmer — but nothing should be broken

## IMPORTANT NOTES

- The `q-` prefix on all tokens is deliberate — it namespaces Qashivo's design system away from shadcn/ui's built-in tokens so nothing conflicts
- The Google Fonts imports for Inter and JetBrains Mono are included in base.css — these load from Google's CDN
- Dark mode is supported via both `prefers-color-scheme` media query AND a `.dark` class for manual toggle (future feature)
- All existing shadcn/ui components will continue to work with their own token system — the q-tokens are additive
