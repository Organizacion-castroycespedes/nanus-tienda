# Evidencia HU-SCAN-001 — Captura con lector HID en Orders y Purchases

Estado: implementación LOCAL completa (F1–F4) con pruebas automáticas en PASS. **QA manual pendiente** (Web y Electron con lector real). QA/PRD no autorizados.

Change OpenSpec: `openspec/changes/modernizar-captura-barcode-orders-purchases/`.

## Base y commits

- Rama: `feature/develop/hu-scan-001-barcode-orders-purchases` desde `develop` `1646b6ad`.
- `3ad7ade3` F0: change OpenSpec y registro en `scripts/governance/openspec-scope.json`.
- `b7862d7e` F1: núcleo `web/modules/inventory/barcode/`.
- `80786a11` F2: Orders (`OrderForm.tsx`, `web/modules/inventory/order-capture/`).
- `c0d7ebd7` F3: Purchases (`PurchaseForm.tsx`, `web/modules/inventory/purchase-capture/`).
- F4: recepción (`PurchaseReceiveForm.tsx`, `purchase-receive-lines.ts`), factura ya registrada, escaneo en la entrega de pedidos (`OrderDeliverForm.tsx`) y corrección de lecturas con el foco en otro campo.

Sin cambios en `web/modules/pos/**`, `api/**`, `scripts/database/**` ni `desktop/**`.

## Pruebas automáticas

| Prueba | Resultado |
|---|---|
| `openspec validate modernizar-captura-barcode-orders-purchases --type change --strict` (Windows) | Válido (F0–F3) |
| `npx tsx --test` sobre `barcode`, `order-capture`, `purchase-capture` y `purchase-receive-lines` (Windows) | 60/60 OK hasta F3; 68/68 con F4 en la VM Linux (pendiente repetir en Windows) |
| `npx vitest run InventoryScanBar.test.tsx orders-responsive-layout.spec.ts` (Windows) | 9/9 OK |
| `npx tsc --noEmit` | Sin errores nuevos; 26 errores preexistentes en 12 specs ajenos |
| `npm run build` (Windows) | OK (F3) |
| ESLint sobre los archivos del change | Sin hallazgos |
| Diagnóstico de gobernanza STRICT (VM, sin CLI) | Los 41 archivos del diff se asignan a un único change; bloqueo solo por `TOOL_UNAVAILABLE`. Pendiente con CLI en Windows |

En la VM Linux las specs `node:test` se ejecutaron con `node --experimental-strip-types` y un cargador local fuera del repositorio, porque `tsx` y Vitest dependen de binarios nativos de Windows.

## QA manual (pendiente)

Registrar resultado (PASS/FAIL), entorno y observaciones.

| ID | Módulo | Caso | Entorno | Esperado | Resultado |
|---|---|---|---|---|---|
| QA-01 | Orders | Escanear producto UNIT nuevo y repetido | Web, Electron | 1 línea, cantidad incrementa | |
| QA-02 | Orders | Código inexistente / ambiguo / caja | Web | Mensaje específico, sin cambios | |
| QA-03 | Orders | Doble lectura < 300 ms y lecturas > 300 ms | Web | Se procesa 1 / se procesan 2 | |
| QA-04 | Orders | Producto BOTH y WEIGHT | Web | Diálogo Unidad/Peso; peso manual con 2 decimales | |
| QA-05 | Orders | Cantidad mayor al stock | Web | Aviso no bloqueante; guarda | |
| QA-06 | Orders | Usuario sin lectura de productos | Web | Precio de lista con etiqueta | |
| QA-07 | Orders | Guardar y verificar precio del backend | Web | Valores devueltos por el backend | |
| QA-08 | Orders | Escanear sin guardar | Web | Sin solicitudes de escritura | |
| QA-09 | Orders | Cambio de sucursal con líneas | Web | Confirmación y limpieza | |
| QA-10 | Purchases | Escaneo continuo y costo editable | Web, Electron | Líneas únicas, costo conservado | |
| QA-11 | Purchases | Guardar compra | Web | 1 `POST /purchases`, sin movimiento de inventario | |
| QA-12 | Recepción | Producto ajeno | Web | Error, sin cambios | |
| QA-13 | Recepción | Excedente | Web | Error, cantidad preparada en el tope | |
| QA-14 | Recepción | Recepción parcial y luego total | Web | Estados `PARTIAL` y `RECEIVED` | |
| QA-15 | Recepción | Dividir línea en dos lotes | Web | Dos lotes registrados | |
| QA-16 | Recepción | Doble clic en confirmar | Web | Un solo movimiento de inventario | |
| QA-17 | Recepción | Usuario `USER` | Web | Sin acción de recibir | |
| QA-18 | Todos | Foco, F2, Tab, lector de pantalla | Web | Política de foco y anuncios correctos | |
| QA-19 | Todos | Móvil (375 px) | Web | Tarjetas y pie fijo | |
| QA-21 | Orders | Entregar pedido escaneando, producto ajeno y excedente | Web, Electron | Solo productos del pedido, tope en el pendiente | |
| QA-22 | Recepción | Segunda recepción parcial con factura ya registrada | Web | Inicia en Productos con la factura precargada y editable | |
| QA-20 | POS | Regresión de escaneo en `/pos` | Web, Electron | Sin cambios de comportamiento | |

## Hallazgos de QA manual

| Fecha | Caso | Hallazgo | Estado |
|---|---|---|---|
| 2026-11-12 | Recepción, producto con lote y vencimiento | Con el foco en Lote, la segunda lectura escribió el código del producto en el lote y su Enter avanzó a Confirmación. | Corregido: el hook bloquea el Enter del lector en otros campos, procesa la lectura como escaneo si es un producto y restaura el campo; un código desconocido en Lote se conserva. Pendiente re-probar. |

## Decisiones y limitaciones conocidas

- Códigos `PACKAGE`/`BOX` bloqueados: no existe factor de conversión (otro change).
- Peso manual con 2 decimales (`NUMERIC(12,2)` en `order_items`/`purchase_items`); sin báscula.
- El precio de Orders mostrado es informativo; el backend lo recalcula al guardar. Se retiró el campo de precio editable porque el backend ya ignoraba ese valor.
- La recepción carga además `GET /products?branchId` para los códigos de barras; si falla, el lector reconoce solo el SKU.
- Riesgo preexistente no abordado: `PUT /purchases/:id` sobre compras `PARTIAL` reinicia cantidades recibidas (no expuesto en la web).
