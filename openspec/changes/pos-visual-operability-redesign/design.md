## Context

`web/app/[tenant]/pos/page.tsx` gates the POS by authenticated session, POS context and open cash session, then renders `web/modules/pos/components/PosScreen.tsx`.

`PosScreen.tsx` currently owns catalog loading, customer selection, product search, stock filters, scanner MOCK, scale MOCK, cart rendering, tax display, payment modal and sale creation. The cart state is stored in Redux through `web/store/posCart.ts` and persisted per tenant, branch, terminal, user and POS session in `localStorage`.

Existing design-system components in `web/components/design-system` include `Button`, `Input`, `Select`, `Modal`, `Tabs`, `Toast`, `SearchFilters`, `Textarea`, `DataTable`, `NoticeDialog`, `ColorField`, `TenantListItem`, `confirm-dialog` and `confirmation-message`. There is no existing `Card`, `Badge`, `Drawer`, `Sheet`, `ScrollArea`, `Separator`, `Tooltip`, `DropdownMenu`, `IconButton`, `Skeleton` or `EmptyState` component file, so POS-specific visual wrappers may be created with the same Tailwind token style while reusing the available primitives.

The reference visual provided by the user shows a sale-first POS:

```text
Top app row:
  menu / title        large search input        quick actions / user

Main area:
  sale context + client            cart side panel
  product filters                  cart items
  product grid                     taxes / totals / charge

Bottom:
  compact peripheral status bar
```

No fiscal, discount, inventory or payment business logic changes are allowed.

## Goals / Non-Goals

**Goals:**

- Make product search the primary POS action and autofocus it on load.
- Return focus to search after product add, scanner add or scale add.
- Keep cart visible on desktop and one-action accessible on tablet/mobile.
- Keep total and charge action visible when the cart has items.
- Collapse scanner and scale MOCK controls into a diagnostic area.
- Keep compact peripheral status visible without displacing products or cart.
- Preserve current product filtering, pricing preview, tax display, discount display, stock guards and payment modal behavior.
- Support desktop Web/Electron, tablet and mobile/Capacitor safe area.
- Document expected visual states in `docs/pos-visual-experience.md`.

**Non-Goals:**

- No backend/API changes.
- No changes to tax, discount, inventory mutation or payment calculations.
- No new hardware integrations.
- No new design system library or broad design-system rewrite.
- No new dependency for drawer/sheet/tooltip.
- No route, contract or state shape changes.

## Decisions

### Decision: Keep POS logic in `PosScreen.tsx`, extract focused visual components only when low-risk

`PosScreen.tsx` is large but contains tightly coupled sale logic. The safe path is to keep calculations and side effects in place and extract small visual components only where props are simple. This avoids accidental changes to sale payloads, tax summaries, pricing preview, scanner events or scale reads.

Alternative considered: full feature-folder rewrite into many files. That would match the proposed component list but increases risk because current POS logic is centralized and business-sensitive.

### Decision: Use design-system primitives plus POS-local wrappers

The implementation SHALL reuse `Button`, `Input`, `Select`, `Modal` and `Toast`. Missing primitives such as Card, Badge, Drawer and Sheet will be implemented as scoped markup in POS using existing Tailwind classes (`slate`, `blue`, `emerald`, `rose`, `amber`) already used by the app.

Alternative considered: add generic design-system components first. That is broader than the POS change and could affect unrelated modules.

### Decision: Main search is the scanner-friendly command input

The top search input remains backed by the existing `query` state and existing filter haystack. It will include name, description, SKU, internal codes and scanner/barcode candidates through `collectProductScannerCodes(product)`. Enter can add the first result when exactly useful, while normal typing remains safe.

Alternative considered: make the MOCK scanner input the primary search. Rejected because scanner simulator is diagnostic, not the daily sale input.

### Decision: Cart layout is responsive CSS, not a new route or state model

Desktop uses a sticky right panel inside the POS workspace. Tablet/mobile use a floating bottom summary and bottom sheet. The cart items, quantity controls, tax expansion, discounts, summary and charge button continue using existing handlers.

Alternative considered: keep the current fixed full-height right drawer. It keeps cart accessible but visually competes with the global app and does not match the reference layout.

### Decision: Peripherals become a compact status bar with optional diagnostic panel

Scanner and scale status chips live at the bottom of the product workspace. The detailed MOCK/SIMULATOR controls move into a collapsible diagnostics panel. Controls are available when mock devices are enabled by feature flags, development mode or the new `NEXT_PUBLIC_POS_MOCK_DEVICES=true` flag. This keeps existing MOCK functionality without making it primary.

Alternative considered: remove mock controls from POS. Rejected because current QA and demo workflows depend on them.

### Decision: Keyboard shortcuts are conservative

Implement `/` for search, `Escape` for clear/close drawer and `F4` for charge when valid. Shortcuts must ignore events from inputs, textareas and selects, except `Escape` clearing the search input when focused. This avoids conflicts with browser/Electron/Capacitor text input.

Alternative considered: implement all suggested shortcuts. Rejected because `+` and `-` can interfere with numeric entry and browser keyboard layouts.

## Visual Plan

### Desktop wireframe

```text
+----------------------------------------------------------------------------------+
| POS title + context             [ Buscar productos por nombre, SKU o codigo ]     |
+----------------------------------------------------------------------------------+
| Usuario / Estado / Cliente compactos                         | Carrito sticky     |
|--------------------------------------------------------------|--------------------|
| [Todos 7] [Con stock 7] [Stock bajo 2] [Sin stock 0] [diag]  | Item list          |
|--------------------------------------------------------------| Quantity / price   |
| Product card | Product card | Product card                   | Taxes collapsed    |
| Product card | Product card | Product card                   | Subtotal           |
|                                                              | Taxes              |
| Compact peripheral status bar                                | Discounts          |
|                                                              | Total final        |
|                                                              | COBRAR             |
+----------------------------------------------------------------------------------+
```

### Tablet wireframe

```text
[ Search ]
[ Context compact ]
[ Filters ]
[ Product grid 2 columns ]
[ Peripheral status compact ]
                         [ Floating cart: 3 - $24.500 ]
```

### Mobile / Capacitor wireframe

```text
[ Search ]
[ Context compact ]
[ Filters horizontally scrollable ]
[ Product cards 1 column ]
[ Peripheral status compact/collapsed ]
[ Bottom cart bar: 3 items - $24.500 ]
tap -> bottom sheet with cart, total and fixed COBRAR button
padding-bottom: env(safe-area-inset-bottom)
```

## Mockups

### Mock 1: POS limpio sin productos en carrito

```text
Top: POS + focused search.
Context: Usuario actual | Estado DRAFT | Cliente Consumidor final.
Products: filter chips and product grid.
Cart: visible empty panel on desktop or floating empty access on mobile.
Empty text: "No hay productos en la venta actual. Busca, escanea o selecciona un producto para iniciar."
Peripherals: compact chips, no large cards.
```

### Mock 2: POS con productos en carrito

```text
Left: search, filters and products remain usable.
Right: cart sticky with item rows, quantity stepper, unit price, discount label, tax accordion, subtotal, taxes, discounts, total and COBRAR.
Total final is prominent.
```

### Mock 3: Scanner y balanza desconectados

```text
Bottom compact bar:
  Scanner desconectado
  Balanza desconectada
  Ver diagnostico

Diagnostic details are collapsed by default. Product grid keeps primary space.
```

### Mock 4: Producto pesable con balanza conectada

```text
Cafe
SKU 678624254445
Peso / KG
$ 4.000 / KG
[Leer balanza]

Cart line:
Cafe
0.350 KG
$ 4.000 / KG
Total linea: $ 1.400
```

### Mock 5: Vista mobile / Capacitor

```text
Search remains first.
Products render in 1 column.
Bottom cart summary stays above safe area.
Bottom sheet shows cart items and fixed charge CTA.
Peripherals stay collapsed below product grid or in diagnostic panel.
```

The repo has no Storybook/Ladle scripts in `web/package.json`; mockups are documented in Markdown instead of visual story files.

## Risks / Trade-offs

- [Risk] `PosScreen.tsx` remains a large component. -> Mitigation: keep business logic unchanged and extract only low-risk presentational helpers when needed.
- [Risk] Sticky/floating cart can overlap app layout on small screens. -> Mitigation: use breakpoint-specific rendering, bottom safe-area padding and one overlay path for mobile.
- [Risk] Autofocus can fight modal or select interactions. -> Mitigation: focus only on POS ready, after successful add, and when no modal is open.
- [Risk] Keyboard shortcuts can trigger inside form fields. -> Mitigation: ignore global shortcuts from editable targets.
- [Risk] Exact screenshot parity may be limited by missing product images and no Card/Drawer design-system primitives. -> Mitigation: preserve equivalent layout, hierarchy and operational behavior with existing palette and components.

## Migration Plan

1. Add OpenSpec and visual guide.
2. Refactor POS layout and styles in `web/modules/pos/components/PosScreen.tsx`.
3. Add small POS-local visual helpers/components only as needed.
4. Keep current sale creation, pricing preview, tax, discount, stock and payment handlers.
5. Validate OpenSpec, lint/build and focused tests available in repo.

Rollback is reverting the POS visual files and the new documentation/spec artifacts. No database or API migration is involved.
