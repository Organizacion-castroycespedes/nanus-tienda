## 1. Theme Helpers

- [x] 1.1 Add or expose color validation, normalization, readable text and contrast helpers.
- [x] 1.2 Add tenant theme token and menu item state style helpers with safe fallbacks.
- [x] 1.3 Add focused tests for color helpers, contrast and tenant token fallbacks.

## 2. Branding Configuration UX

- [x] 2.1 Replace plain color inputs with swatch plus editable hex fields and invalid-state messages.
- [x] 2.2 Normalize valid colors before save and block invalid branding saves.
- [x] 2.3 Prevent stale tenant colors during tenant changes and loading.
- [x] 2.4 Expand live preview with company name, logo, primary action, secondary accent and mini menu states.

## 3. Menu Visual UX

- [x] 3.1 Apply menu item state helper to real sidebar items, active parents, active submenus, hover and focus.
- [x] 3.2 Keep responsive/collapsed sidebar behavior unchanged.

## 4. QA And Validation

- [x] 4.1 Add QA evidence document for route, tenant, colors, preview, save, menu states and responsive check.
- [x] 4.2 Run OpenSpec validation, lint, build, available tests and diff checks.

## 5. Design-System Refinement

- [x] 5.1 Review design-system tokens, variants and visual conventions before refinement.
- [x] 5.2 Extract the branding color field into a reusable design-system component.
- [x] 5.3 Extract the branding preview into a focused configuration component.
- [x] 5.4 Refine tenant theme tokens so branding acts as accent instead of saturated layout replacement.
- [x] 5.5 Update focused tests, QA evidence and validations after refinement.

## 6. Preview/Menu Coherence Fix

- [x] 6.1 Audit branding load/save/provider/sidebar/preview flow for stale state and token divergence.
- [x] 6.2 Make preview sidebar use the same final menu tokens and state helper as the real sidebar.
- [x] 6.3 Strengthen menu active, submenu active, hover and focus contrast for dark and light menu backgrounds.
- [x] 6.4 Ensure save dispatches normalized current-tenant branding immediately even if API response is partial.
- [x] 6.5 Update focused tests, QA notes and validation results.

## 7. Final Active Menu Contrast Fix

- [x] 7.1 Audit preview/sidebar token application for submenu opacity and class overrides.
- [x] 7.2 Replace weak submenu active color mixing with contrast-safe final tokens.
- [x] 7.3 Make real sidebar child indicator and active surface consume the same helper output as preview.
- [x] 7.4 Add focused dark/light/primary/secondary token contrast tests.
- [x] 7.5 Update QA evidence and rerun required validations.
