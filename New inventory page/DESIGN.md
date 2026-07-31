---
name: Hornet Tactical OS
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d5c4ab'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9e8f78'
  outline-variant: '#514532'
  surface-tint: '#ffba20'
  primary: '#ffdca1'
  on-primary: '#412d00'
  primary-container: '#ffb800'
  on-primary-container: '#6b4c00'
  inverse-primary: '#7c5800'
  secondary: '#abc9f2'
  on-secondary: '#103253'
  secondary-container: '#2a486b'
  on-secondary-container: '#9ab7e0'
  tertiary: '#e3dcff'
  on-tertiary: '#30009b'
  tertiary-container: '#c7bcff'
  on-tertiary-container: '#512bd4'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdea8'
  primary-fixed-dim: '#ffba20'
  on-primary-fixed: '#271900'
  on-primary-fixed-variant: '#5e4200'
  secondary-fixed: '#d2e4ff'
  secondary-fixed-dim: '#abc9f2'
  on-secondary-fixed: '#001c37'
  on-secondary-fixed-variant: '#2a486b'
  tertiary-fixed: '#e6deff'
  tertiary-fixed-dim: '#c9beff'
  on-tertiary-fixed: '#1b0063'
  on-tertiary-fixed-variant: '#4619ca'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Archivo Narrow
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.05em
  body-md:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 12px
  margin-desktop: 24px
  panel-padding: 12px
---

## Brand & Style

The design system is engineered for high-stakes, real-time FPV drone unit management. It prioritizes rapid information processing and situational awareness under high-stress field conditions. The aesthetic follows a **Tactical HUD (Heads-Up Display)** style, blending technical precision with high-contrast visibility.

The brand personality is aggressive, reliable, and functional. It utilizes a **Modern-Brutalist** framework—characterized by sharp geometric edges, heavy-duty borders, and a monochromatic dark base—interjected with "Hornet Yellow" to signal critical actions. Visual interest is maintained through subtle technical motifs like hexagonal grid overlays and scanline textures, evoking a sense of military-grade hardware interfaces.

## Colors

The palette is optimized for low-light field environments (Dark Mode) to reduce eye strain and maintain user stealth.

- **Base Layers:** `#0d0d0d` serves as the primary canvas, with `#1a1a1a` used for elevated panel surfaces.
- **Action/Highlight:** `#ffb800` (Hornet Yellow) is reserved exclusively for interactive elements, primary status indicators, and active selection states.
- **Structural Blue:** `#1a3a5c` and `#2e6da4` provide visual grounding for headers and permanent sidebars, differentiating navigation from tactical data.
- **Semantic Logic:**
  - **Success (Green):** System active, signal locked.
  - **Error (Red):** Link lost, battery critical, target conflict.
  - **Warning (Orange):** Low signal, proximity warning.
  - **Reserve (Purple):** Reserved frequencies, VTX standby modes.
  - **External (Grey):** Non-unit entities or historical data.

## Typography

This design system uses a dual-font strategy to separate UI navigation from telemetry data.

- **UI/Navigation:** **Archivo Narrow** is used for all headers and body text. Its condensed nature allows for maximum information density in compact tactical sidebars. All UI labels should be in Ukrainian.
- **Telemetry/Data:** **JetBrains Mono** is mandatory for coordinates, radio frequencies (MHz), battery voltages, and Unit IDs. The monospaced nature ensures that fluctuating numbers do not cause layout shifts during high-speed data updates.
- **Styling:** Use uppercase for all `label-caps` and `headline-md` roles to enhance the "military report" aesthetic.

## Layout & Spacing

The layout utilizes a **Fixed Grid** system with a dense 4px baseline rhythm. 

- **Dashboard:** 12-column grid for desktop views. Sidebars are fixed at 280px to ensure telemetry panels remain constant while the map/video feed scales.
- **Mobile/Tablet:** Transitions to a single-column stacked view. Critical telemetry (Battery/Signal) must remain pinned to the top or bottom edge of the viewport.
- **Density:** High information density is preferred. Use minimal internal padding (`panel-padding`) to maximize the visibility of live drone feeds and map data.

## Elevation & Depth

This design system eschews soft shadows in favor of **Tonal Layering and Bold Borders**.

- **Depth:** Surfaces are defined by their background color and 1px solid borders. Elevated panels (e.g., a drone settings modal) use `#1a1a1a` with a `#2e6da4` (Blue) border.
- **Dividers:** Use thin (1px) bright dividers with 30% opacity to separate data points without creating visual clutter.
- **HUD Overlays:** Elements appearing over video feeds should use a 60% blurred background (`backdrop-filter: blur(8px)`) with a high-contrast yellow or white border to ensure legibility regardless of the video background.

## Shapes

The shape language is strictly **Angular and Geometric**. 

- **Corners:** 0px radius (Sharp) for all primary containers, buttons, and input fields.
- **Accents:** Use 45-degree "clipped corners" (dog-eared) on active tabs or primary status badges to reinforce the tactical aesthetic.
- **Textures:** Hexagonal patterns may be used as a low-opacity (5%) background overlay on primary structural panels to provide a technical feel.

## Components

- **Buttons:** Sharp-edged. Primary buttons are solid `#ffb800` with black text. Secondary buttons are outlined with 1px borders.
- **Status Chips:** Rectangular badges with a left-side 4px color bar indicating status (e.g., "АКТИВНИЙ" in green, "ПОМИЛКА" in red).
- **Data Lists:** Zebra-striped rows using `#0d0d0d` and `#141414`. High-speed telemetry data should use monospaced fonts aligned to decimal points.
- **Input Fields:** Dark background with a bottom-only border that glows Hornet Yellow on focus.
- **Tactical Cards:** Containers for individual drone units. Must display Unit ID, Frequency, and Battery % prominently. Use a clipped-corner treatment for the top-right corner to indicate the drone's flight mode.
- **HUD Indicators:** Circular progress rings for signal strength and battery, utilizing the primary yellow for active segments.