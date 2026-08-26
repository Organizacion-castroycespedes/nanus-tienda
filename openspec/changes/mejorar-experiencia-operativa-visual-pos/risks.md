# Risks: mejorar-experiencia-operativa-visual-pos

- POS layout is large and easy to regress with small className changes.
- Sidebar auto-collapse could affect non-POS routes if route detection is too broad.
- The floating POS trigger could overlap diagnostics, filters or the cart if its z-index and offsets are wrong.
- Drag persistence could place a floating trigger under another control if clamp or snap logic is wrong.
- Changing the topbar may cause overflow on long role/branch/terminal names.
- Audio playback can fail on browser policy restrictions; the add flow must not depend on it.
- Mobile cart modal could conflict with existing charge/payment overlays if z-index or scroll handling is wrong.
- Filters/customer compaction could accidentally hide existing state if the overlay is not wired to the current handlers.
