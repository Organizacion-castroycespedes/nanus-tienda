## 1. Prerrequisitos y gobernanza

- [x] 1.1 Discovery de solo lectura sobre `develop` `1646b6ad`: escáner del POS, catálogo con códigos, Orders, Purchases, recepción, RBAC, Electron y OpenSpec.
- [x] 1.2 Decisiones del propietario (2026-11-11): solo modo teclado; bloquear `PACKAGE`/`BOX`; pesables con flujo POS y peso manual; doble escaneo de 300 ms solo en estos módulos; recepción con cero tolerancia y error duro para productos ajenos; precio con permiso actual; aviso de stock; dividir líneas en lotes; `/pos` sin cambios.
- [x] 1.3 Rama `feature/develop/hu-scan-001-barcode-orders-purchases` desde `develop` `1646b6ad`.
- [x] 1.4 Registrar el change en `scripts/governance/openspec-scope.json` con la reasignación autorizada de titularidad vigente.
- [x] 1.5 `openspec validate modernizar-captura-barcode-orders-purchases --type change --strict`: válido (Windows, propietario, 2026-11-11).
- [ ] 1.6 Diagnóstico de gobernanza STRICT sobre el diff con el CLI de OpenSpec disponible.

## 2. Núcleo de captura de Inventario (`web/modules/inventory/barcode/`)

- [x] 2.1 `barcode-wedge.ts` con detección por tiempos y pruebas (lectura válida, tecleo humano, código corto, terminadores).
- [x] 2.2 `barcode-resolver.ts` con `MATCH`, `AMBIGUOUS`, `NOT_FOUND`, `PRESENTATION_UNSUPPORTED` y pruebas (normalización, barcodes inactivos, SKU, catálogo de otro tenant).
- [x] 2.3 `barcode-deduper.ts` (300 ms) y pruebas.
- [x] 2.4 Reglas puras de líneas: agregar/incrementar, modo unidad/peso, decimales, límite de pendiente; pruebas.
- [x] 2.5 `use-inventory-barcode-capture.ts`, `InventoryScanBar.tsx` y `inventory-scan-feedback.ts` (foco, F2, `aria-live`, sonidos); prueba `InventoryScanBar.test.tsx` (Vitest, se ejecuta en 6.1).
- [x] 2.6 Verificar que ningún archivo del núcleo importa `web/modules/pos/**`.

## 3. Orders

- [x] 3.1 Rediseño de `OrderForm.tsx`: cabecera, barra de escaneo, búsqueda manual, ticket sin duplicados, controles de cantidad.
- [x] 3.2 Diálogos de unidad/peso y de peso manual.
- [x] 3.3 Preview de precio con `POST /pricing/preview-line` canal `ORDER`, debounce y estados (calculando, pendiente, sin permiso).
- [x] 3.4 Aviso de stock insuficiente.
- [x] 3.5 Confirmación y limpieza al cambiar sucursal; captura solo en nuevo o `DRAFT`.
- [x] 3.6 Layout responsive y actualización de `orders-responsive-layout.spec.ts`.

## 4. Purchases (captura)

- [ ] 4.1 Rediseño de `PurchaseForm.tsx` como factura de proveedor con barra de escaneo y búsqueda manual.
- [ ] 4.2 Líneas únicas por producto, costo editable que no se sobrescribe, validaciones.
- [ ] 4.3 Confirmación y limpieza al cambiar sucursal; ajustes en `web/app/[tenant]/purchases/page.tsx` si se requieren.

## 5. Recepción

- [ ] 5.1 Barra de escaneo en el paso de productos de `PurchaseReceiveForm.tsx`, restringida a los productos de la compra.
- [ ] 5.2 Cantidad preparada con tope en el pendiente, producto ajeno como error y primera línea con pendiente para productos repetidos.
- [ ] 5.3 Dividir línea en lotes y payload con varias entradas por `purchaseItemId`; extender `purchase-receive-lines.ts` y sus pruebas.
- [ ] 5.4 Conservar `Idempotency-Key`, factura del proveedor y los tres pasos.

## 6. Verificación

- [ ] 6.1 En Windows: `cd web && npx tsx --test modules/inventory/barcode/*.spec.ts modules/inventory/components/purchase-receive-lines.spec.ts` y `npx vitest run modules/inventory/barcode/InventoryScanBar.test.tsx app/[tenant]/orders`.
- [ ] 6.2 `cd web && npm run lint`, `npx tsc --noEmit` y `npm run build`.
- [ ] 6.3 `git diff --name-only develop...HEAD` sin archivos de `web/modules/pos/**`, `api/**`, `scripts/database/**` ni `desktop/**`.
- [ ] 6.4 QA manual según la matriz y evidencia en `docs/evidencia-hu-scan-001.md`.

## Matriz QA

| ID | Módulo | Caso | Entorno | Resultado esperado |
|---|---|---|---|---|
| QA-01 | Orders | Escanear producto UNIT nuevo y repetido | Web, Electron | 1 línea, cantidad incrementa |
| QA-02 | Orders | Código inexistente / ambiguo / caja | Web | Mensaje específico, sin cambios |
| QA-03 | Orders | Doble lectura < 300 ms y lecturas > 300 ms | Web | Se procesa 1 / se procesan 2 |
| QA-04 | Orders | Producto BOTH y WEIGHT | Web | Diálogo Unidad/Peso; peso manual con 2 decimales |
| QA-05 | Orders | Cantidad mayor al stock | Web | Aviso no bloqueante; guarda |
| QA-06 | Orders | Usuario sin lectura de productos | Web | Precio de lista con etiqueta |
| QA-07 | Orders | Guardar y verificar precio del backend | Web | Valores devueltos por el backend |
| QA-08 | Orders | Escanear sin guardar | Web | Sin solicitudes de escritura |
| QA-09 | Orders | Cambio de sucursal con líneas | Web | Confirmación y limpieza |
| QA-10 | Purchases | Escaneo continuo y costo editable | Web, Electron | Líneas únicas, costo conservado |
| QA-11 | Purchases | Guardar compra | Web | 1 `POST /purchases`, sin movimiento de inventario |
| QA-12 | Recepción | Producto ajeno | Web | Error, sin cambios |
| QA-13 | Recepción | Excedente | Web | Error, cantidad preparada en el tope |
| QA-14 | Recepción | Recepción parcial y luego total | Web | Estados `PARTIAL` y `RECEIVED` |
| QA-15 | Recepción | Dividir línea en dos lotes | Web | Dos lotes registrados |
| QA-16 | Recepción | Doble clic en confirmar | Web | Un solo movimiento de inventario |
| QA-17 | Recepción | Usuario `USER` | Web | Sin acción de recibir |
| QA-18 | Todos | Foco, F2, Tab, lector de pantalla | Web | Política de foco y anuncios correctos |
| QA-19 | Todos | Móvil (375 px) | Web | Tarjetas y pie fijo |
| QA-20 | POS | Regresión de escaneo en `/pos` | Web, Electron | Sin cambios de comportamiento |
