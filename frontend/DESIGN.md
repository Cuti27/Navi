---
name: Analogue Blueprint
lang: en
es: [Versión en español](./DESIGN.es.md)
colors:
  surface: '#fff8f6'
  surface-dim: '#e8d6d2'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ed'
  surface-container: '#fceae5'
  surface-container-high: '#f6e4e0'
  surface-container-highest: '#f0dfda'
  on-surface: '#221a17'
  on-surface-variant: '#55433d'
  inverse-surface: '#382e2b'
  inverse-on-surface: '#ffede8'
  outline: '#88726c'
  outline-variant: '#dbc1b9'
  surface-tint: '#99462a'
  primary: '#99462a'
  on-primary: '#ffffff'
  primary-container: '#d97757'
  on-primary-container: '#541400'
  inverse-primary: '#ffb59e'
  secondary: '#545f72'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f7'
  on-secondary-container: '#586377'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#09a493'
  on-tertiary-container: '#00312b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#390b00'
  on-primary-fixed-variant: '#7a2f15'
  secondary-fixed: '#d8e3fa'
  secondary-fixed-dim: '#bcc7dd'
  on-secondary-fixed: '#111c2c'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#7df7e3'
  tertiary-fixed-dim: '#5edac7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#fff8f6'
  on-background: '#221a17'
  surface-variant: '#f0dfda'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-ui:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1200px
---

## Brand & Style

The design system for this Homelab AI Agent is rooted in the "Analogue Blueprint" aesthetic—a synthesis of mid-century technical documentation and modern engineering precision. The brand personality is authoritative yet approachable, acting as a reliable co-pilot for technical infrastructure. It avoids the sterile "nuclear white" of typical SaaS products in favor of a warm, tactile palette that evokes archival paper and architectural drafts.

The visual style leans into **Minimalism** with a **Structural** twist. It prioritizes information density and technical clarity without sacrificing warmth. High-precision alignment, intentional use of monospaced accents, and a "paper-on-paper" layering strategy create a professional environment suitable for managing complex home server environments.

## Colors

The palette is designed to reduce eye strain during long technical sessions. 

- **Primary Background (#F6F5F1):** A warm bone/crema base that provides a soft, non-reflective surface.
- **Surfaces (#FFFFFF):** Pure white is reserved strictly for interactive cards and elevated surfaces to create a crisp "blueprint" contrast.
- **Primary Text (#2D3748):** A charcoal gray that maintains high legibility while appearing softer than pure black.
- **Accents:** Terracotta (#D97757) is used for primary actions and "system active" states, while Slate Blue (#4A5568) provides a structural, engineering-grade secondary tone for borders and iconography.

## Typography

This design system utilizes a dual-type approach to distinguish between conversational AI guidance and technical system data.

- **Inter** is the primary typeface for all interface elements, headings, and chat bubbles, ensuring a modern and accessible feel.
- **JetBrains Mono** is employed for technical metadata, payload previews, IP addresses, and status labels. This distinguishes "Human" language from "Machine" data.

Headings should use tight letter-spacing to maintain a professional, architectural look. Label styles should frequently use uppercase with increased tracking to mimic engineering stamps.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** with strict adherence to a 4px baseline rhythm. 

- **Structure:** A 12-column grid for desktop and a 4-column grid for mobile. 
- **Density:** Information density should be moderate. Use generous margins (#xl) to separate major sections like "Agent Interaction" and "Server Health," but use tight padding (#sm) within technical data tables.
- **Hierarchy:** Content flows vertically on mobile, but utilizes a "Command Center" layout on desktop (`md:` breakpoint and up). The left column displays the Navi agent avatar at a prominent size (`md:w-1/2 md:max-w-[520px]`), while the right column contains the primary content: the session list on the home screen or the conversation and composer on the chat screen.

## Elevation & Depth

To maintain the "Blueprint" aesthetic, depth is conveyed through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows.

- **Borders:** All primary cards and input fields use a 1px solid border in Slate Blue at 15-20% opacity. 
- **Shadows:** Only one shadow tier is used: a very subtle, sharp "technical" shadow (0px 2px 4px rgba(0,0,0,0.05)) to lift the active interaction card or modal from the bone background.
- **Layering:** The base layer is Bone (#F6F5F1). The second layer (Cards/Bubbles) is Pure White (#FFFFFF). The third layer (Active/Focus) uses a Terracotta accent border.

## Shapes

The shape language is **Soft (0.25rem)**. This provides enough roundness to feel modern and user-friendly, while maintaining the structural integrity and precision of an engineering tool. 

- **Standard Buttons & Inputs:** 0.25rem (4px) corner radius.
- **Cards & Chat Bubbles:** 0.5rem (8px) corner radius.
- **Avatar Container:** Circular (999px) to contrast with the rigid grid.

## Components

- **Buttons:** Primary buttons use the Terracotta (#D97757) background with white text. Secondary buttons are ghost-style with a Slate Blue border and mono-spaced labels.
- **AI Chat Bubbles:** Agent responses use the pure white surface with a 1px border. User inputs use a very light gray tint to distinguish the flow.
- **Technical Chips:** Used for server status (e.g., "Online", "CPU 12%"). These use JetBrains Mono text and a subtle background tint matching the status color (Success/Error).
- **SVG Avatar:** The Navi agent icon should be a geometric, line-art based SVG. Micro-interactions should include a subtle "pulse" on the stroke-width during AI thinking states.
- **Data Cards:** Technical info cards (Hard Drive health, Network logs) should feature a mono-spaced header and a 1px divider line to separate sections.
- **Inputs:** Text fields should use a 1px border that shifts from Light Gray to Slate Blue on focus, with no "glow" effect, maintaining the crisp blueprint feel.