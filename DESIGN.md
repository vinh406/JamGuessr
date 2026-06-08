---
name: Spotiguess
description: Multiplayer Spotify song guessing game
colors:
  verdant-glow: "#4ade80"
  verdant-deep: "#16a34a"
  ink-primary: "#ffffff"
  ink-secondary: "#9ca3af"
  ink-muted: "#6b7280"
  surface-elevated: "rgba(31,41,55,0.5)"
  surface-base: "rgba(31,41,55,0.4)"
  border-subtle: "rgba(55,65,81,0.3)"
  border-default: "rgba(55,65,81,0.5)"
  body-bg: "#111827"
  body-bg-mid: "#1f2937"
  amber-accent: "#fbbf24"
  amber-deep: "#ea580c"
  blue-accent: "#60a5fa"
  yellow-bright: "#facc15"
  red-bright: "#f87171"
  purple-accent: "#a855f7"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.verdant-glow}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
  button-primary-hover:
    backgroundColor: "{colors.verdant-deep}"
    textColor: "{colors.ink-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
  input-default:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    border: "1px solid {colors.border-default}"
  card-default:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.border-default}"
---

# Design System: Spotiguess

## 1. Overview

**Creative North Star: "The Jam Session"**

A shared room with dimmed lights, a good sound system, and friends gathered around music. The interface is a dark stage where the music preview is the spotlight and everything else recedes into the background. Surfaces are tonal layers rather than physical cards — depth comes from opacity and borders, not shadows — so nothing competes with the listening experience.

This system explicitly rejects cluttered, noisy game UIs. Every element answers one question: does it help players focus on the music and the guess? If it doesn't, it doesn't belong.

**Key Characteristics:**
- Dark stage background (deep charcoal gradient) as a canvas for the music spotlight
- Verdant glow accent — a lively, energized green inspired by Spotify's identity
- Tonal layering instead of physical shadows — depth through opacity and borders
- Clean rounded shapes (12–16px corners) that feel approachable, not aggressive
- System sans-serif typography throughout — familiar, fast-loading, no friction

## 2. Colors

A restrained palette anchored by the dark stage and a single vibrant green accent. Secondary colors (amber, blue, purple) appear sparingly for specific functional contexts — library, blend creation, settings — never as decoration.

### Primary
- **Verdant Glow** (`#4ade80`): The primary accent — buttons, active states, the music icon, timer bars when healthy. A lively, fresh green that pops against the dark background. Used on typically ≤15% of any screen.
- **Verdant Deep** (`#16a34a`): Hover state anchor for verdant glow. Deeper, more grounded.

### Secondary
- **Amber Accent** (`#fbbf24`): Library iconography and stats. Warmer, more editorial — signals "your collection" rather than "play now."
- **Blue Accent** (`#60a5fa`): Alternative button variant and round-complete indicators. Used where green would create confusion with game state.

### Tertiary
- **Purple Accent** (`#a855f7`): Blend creation only — a one-off gradient treat for a collaborative feature.
- **Yellow Bright** (`#facc15`): Streak indicators and rank-1 winner highlights. Celebratory, sparing.
- **Red Bright** (`#f87171`): Urgency (countdown under 5s), errors, destructive actions.

### Neutral
- **Body BG** (`#111827`): The stage floor. Deep near-black charcoal.
- **Body BG Mid** (`#1f2937`): The stage walls. One step lighter for backdrop surfaces.
- **Surface Elevated** (`rgba(31,41,55,0.5)`): Card and container fills. Semi-transparent so the stage gradient breathes through.
- **Surface Base** (`rgba(31,41,55,0.4)`): Lower-priority surfaces, subtle fills.
- **Ink Primary** (`#ffffff`): Headings, body text, button labels. Full white for maximum contrast.
- **Ink Secondary** (`#9ca3af`): Body copy, descriptions. Clean gray that reads clearly at 4.5:1+.
- **Ink Muted** (`#6b7280`): Metadata, timestamps, placeholders. Intentionally lower contrast for hierarchy.
- **Border Default** (`rgba(55,65,81,0.5)`): Primary dividers and container outlines.
- **Border Subtle** (`rgba(55,65,81,0.3)`): Lighter dividers, inactive state outlines.

### Named Rules

**The Stage Rule.** The body gradient is a dark room, not a decorative canvas. Every surface overlay is semi-transparent so the stage gradient stays visible. No solid gray-800 fills — always with transparency.

**The Accent Share Rule.** Verdant glow appears on at most 15% of any viewport. Its scarcity is what makes it read as interactive and alive. If a screen has two green elements that aren't the same interactive group, one of them is wrong.

## 3. Typography

**Display/Body Font:** System sans-serif stack (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)

**Character:** Zero-friction, fast-loading, familiar. No custom fonts — the music is the personality, not the typeface. The system stack loads instantly, matches every OS's native feel, and keeps the interface snappy.

### Hierarchy
- **Display** (700, `clamp(2.5rem, 5vw, 3.75rem)`, 1.2): Hero headings on the login and home pages. Use `text-wrap: balance`.
- **Headline** (700, 1.875rem, 1.25): Page titles ("My Library", "Game Room"), section headers within cards. Use `text-wrap: balance`.
- **Title** (600, 1.25rem, 1.4): Card titles, modal headers, playlist names.
- **Body** (400, 1rem, 1.5): Primary reading text. Cap at 65–75ch.
- **Small** (400, 0.875rem, 1.5): Descriptions, secondary information, metadata.
- **Label** (500, 0.75rem, 1.5): Timestamps, counters, tabular data. Used with uppercase `tracking-wider` for section eyebrows (sparingly).

### Named Rules

**The System Stack Rule.** No custom webfonts. The system stack loads with the OS, needs no network request, and can't flash or flicker. Custom type would add latency and visual weight that contradicts the Jam Session's focus-forward ethos.

## 4. Elevation

The system is flat by default. Depth is conveyed through tonal layering — opacity, backdrop blurs, and borders — not through box shadows. This keeps the focus on the music content rather than decorative depth.

Cards and containers use a semi-transparent surface fill (`surface-elevated`) with a 1px border (`border-default`). The most prominent surfaces (modals, drawers) add a soft `backdrop-blur-sm` to separate them from the stage, but still without shadows.

### Named Rules

**The Flat-Confidence Rule.** No box shadows on surfaces at rest. A subtle backdrop blur is the ceiling for separation. Shadows imply physicality; this interface is a stage, not a desktop.

## 5. Components

### Buttons

- **Shape:** Softly rounded corners (12px / `rounded.lg`). No pill shapes except the header avatar.
- **Primary:** Verdant Glow background, white text, 16px 24px padding. The boldest interactive element. Hover deepens to Verdant Deep.
- **Secondary:** Semi-transparent surface (`surface-elevated`) with a visible border, secondary ink text. Less prominent than primary but clearly tappable.
- **Ghost:** Transparent background, secondary ink text. Used in game answer choices where many buttons share space and the interaction is selection, not call-to-action.
- **Disabled:** 50% opacity across all variants. No custom disabled styling beyond the opacity reduction.

### Inputs / Fields

- **Style:** Same semi-transparent surface as secondary buttons, 1px border, 12px rounded corners.
- **Focus:** Border shifts to accent color (Verdant Glow or Blue depending on variant) with a matching 2px focus ring at 20% opacity.
- **Placeholder:** Muted ink. Contrast-critical — keep at 4.5:1.
- **Error:** Red-bright border and focus ring. No icon required; the color shift is sufficient.

### Cards / Containers

- **Corner Style:** 16px radius (`rounded.xl`).
- **Background:** Semi-transparent surface overlay so the stage gradient shows through.
- **Border:** 1px solid border-default.
- **Shadow Strategy:** None at rest. Hover states may shift background opacity subtly.
- **Internal Padding:** 24px (`spacing.lg`).

### Modal / Dialog

- **Base:** Same card styling but with backdrop blur overlay (`bg-black/50 backdrop-blur-sm`) behind it.
- **Header:** Divider line beneath title. Close button top-right.
- **Animation:** Fade + scale on open/close (150ms ease).

### Navigation / Header

- **Style:** Fixed top bar with bottom border. Semi-transparent dark background with backdrop blur.
- **Logo:** Rounded icon container with Verdant Glow gradient + music note SVG. Always present.

### Slider

- **Track:** Gray fill with Verdant Glow indicator, 12px rounded.
- **Thumb:** White circle (20px), subtle shadow. Focus ring matches primary accent.
- **States:** Hover slightly lightens the thumb. Disabled at 50% opacity.

## 6. Do's and Don'ts

### Do:
- **Do** use Verdant Glow sparingly — it's the accent, not the background.
- **Do** use tonal layering (transparent surfaces + borders) instead of box shadows to create depth.
- **Do** keep the body gradient visible through semi-transparent surface fills.
- **Do** use system sans-serif stack for zero-loading typography.
- **Do** use `text-wrap: balance` on headings, `text-wrap: pretty` on long prose.
- **Do** let the music preview be the focal point — the UI should recede during gameplay.

### Don't:
- **Don't** use cluttered, noisy game UIs — the interface should never compete with the music.
- **Don't** use box shadows on cards or containers at rest — depth comes from tonal layering.
- **Don't** use decorative gradient text (`background-clip: text` on headings) — the one `text-transparent` on the home page greeting is a personalized flourish, not a pattern.
- **Don't** use custom webfonts that add load time — the system stack is fast enough.
- **Don't** use glassmorphism or backdrop blurs beyond the subtle modal overlay treatment.
- **Don't** use side-stripe borders on cards — use full borders or nothing.
- **Don't** stack multiple accent colors in a single view — one accent per surface.
- **Don't** let placeholder text fall below 4.5:1 contrast against its background.
