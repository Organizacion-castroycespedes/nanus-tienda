## Context

Discovery sobre `develop` `1646b6ad` (solo lectura, 2026-11-11). Evidencia confirmada:

- **POS (referencia, no se modifica):** `web/modules/pos/utils/pos-scanner-wedge.ts` detecta el lector HID por tiempos (`maxKeyGapMs=50`, `maxDurationMs=750`, `minLength=8`, terminadores Enter/CR/LF). `pos-scanner.ts` resuelve contra el catálogo en memoria y devuelve `null` tanto para 0 como para más de 1 coincidencia. `PosScreen.tsx` (2118-2190) integra la detección solo en el `onKeyDown` del buscador y mantiene el foco con `restoreSearchFocus` (795-870). No hay protección de doble escaneo.
- **Catálogo:** POS, `OrderForm` y `PurchaseForm` usan `GET /products?branchId`, que ya incluye `primaryBarcode`, `barcodeCodes`, `barcodes[]` (con `barcodeType`) y `stock` por sucursal (`api/src/modules/inventory/services/product.service.ts` 803-813, 1019-1045).
- **Códigos:** `product_barcodes` es único por `(tenant_id, barcode)`; `barcodeType` incluye `PACKAGE` y `BOX` sin factor de conversión.
- **Orders:** `order.service.ts` recalcula precio e impuestos con `PricingService.calculateLinePrice` canal `ORDER` y guarda `pricing_snapshot`; el precio enviado por el cliente no es autoritativo. `order_items.ordered_quantity` es `NUMERIC(12,2)`. Solo se edita en `DRAFT`.
- **Purchases:** `createPurchase` crea en `DRAFT` sin inventario ni pagos. La web no tiene edición de compras.
- **Recepción:** `POST /purchases/:id/receive` exige `Idempotency-Key`, bloquea la compra (`FOR UPDATE`), rechaza excedentes y descuenta el pendiente por cada entrada de la misma solicitud, por lo que varias entradas con el mismo `purchaseItemId` (varios lotes) ya son válidas (`purchase.service.ts` 1564-1850).
- **Electron:** `desktop/electron/` no intercepta teclado; el lector HID se comporta igual que en Web.

## Goals / Non-Goals

**Goals**
- Escaneo continuo y búsqueda manual en Orders, Purchases y recepción.
- Agregar o incrementar sin duplicar líneas; distinguir código inexistente, ambiguo y presentación no soportada.
- Evitar doble escaneo accidental, excedentes en recepción y estados inválidos.
- Mantener al backend como autoridad de precios, permisos, atomicidad e idempotencia.
- UX responsive y accesible.

**Non-Goals**
- Cualquier cambio en `/pos` (`web/modules/pos/**`), en el agente de periféricos, en Electron o en la báscula.
- Factor de conversión de presentaciones (requeriría migración; otro change).
- Cambios de API o de base de datos, incluida la corrección de `PUT /purchases/:id` sobre compras `PARTIAL` (riesgo preexistente, no se expone en la web).
- Edición de compras en la web.

## Decisions

### D1. Núcleo propio de Inventario, sin dependencia del POS
Se crea `web/modules/inventory/barcode/` con funciones puras y un hook. El algoritmo de detección por tiempos replica el del POS (mismos valores por defecto) pero vive aparte, para que cambios en el POS no afecten a Orders/Purchases y viceversa. Decisión del propietario: el POS es solo referencia; no se importa `web/modules/pos/**`.

Contenido previsto:
- `barcode-wedge.ts`: estado y evaluación de teclas (`maxKeyGapMs`, `maxDurationMs`, `minLength`).
- `barcode-resolver.ts`: `resolveInventoryBarcode(code, products)`.
- `barcode-deduper.ts`: ventana de 300 ms por código normalizado.
- `use-inventory-barcode-capture.ts`: hook que conecta input, detección, deduplicación, resolución y foco.
- `InventoryScanBar.tsx`: input, estado del lector y región `aria-live`.
- `inventory-scan-feedback.ts`: sonidos de éxito y error propios.

### D2. Solo lector en modo teclado, ligado a la barra de escaneo
No se usa el canal WebSocket del agente local ni un listener global. La detección corre en el `onKeyDown` de la barra de escaneo y el foco vuelve a ella después de cada acción, salvo cuando hay un diálogo abierto, el usuario está editando otro campo o navega con Tab (misma política que el POS). Así un escaneo nunca escribe en campos de lote, costo o cantidad.

### D3. Resolución explícita
`resolveInventoryBarcode` normaliza (NFD, sin tildes, trim, minúsculas) y compara contra códigos de barras activos (`barcodes[]`, `barcodeCodes`, `primaryBarcode`) y `sku`. Resultado:
- `MATCH` con el producto, si hay exactamente uno;
- `AMBIGUOUS` con los candidatos, si hay más de uno;
- `NOT_FOUND`;
- `PRESENTATION_UNSUPPORTED`, si el código coincide con un barcode `PACKAGE` o `BOX` (decisión del propietario: bloquear con aviso).
El Enter manual en la barra usa la misma resolución sobre el texto digitado; si no hay `MATCH` se muestran los resultados de búsqueda para selección manual.

### D4. Doble escaneo
Un mismo código normalizado leído dentro de 300 ms del anterior se ignora y se registra en consola de depuración. Aplica solo a estos módulos. Escaneos del mismo producto separados por más de 300 ms incrementan normalmente.

### D5. Pesables (misma lógica de decisión que el POS, sin báscula)
- `UNIT`: suma 1.
- `BOTH`: diálogo Unidad / Peso.
- `WEIGHT`: diálogo para digitar el peso (> 0, máximo 2 decimales, coherente con `NUMERIC(12,2)`).
Una línea guarda el modo con el que se creó; un escaneo posterior del mismo producto en modo peso vuelve a pedir el peso a sumar, y no se permite mezclar unidad y peso en la misma línea. El precio persistido sigue siendo el que calcula el backend de Orders (`calculateLinePrice`, escala 2); el preview usa los mismos parámetros para no diferir.

### D6. Precio informativo en Orders
Cada cambio de cantidad dispara (con debounce) `POST /pricing/preview-line` con `channel: "ORDER"`, sucursal y cliente. Estados por línea: calculando, calculado, pendiente (red), sin permiso. Si el usuario no tiene `INVENTORY_PRODUCTS READ` (decisión del propietario: se acepta ese permiso), se muestra el precio de lista con la etiqueta "se recalcula al guardar". El total mostrado es informativo; el backend recalcula al guardar.

### D7. Stock en Orders
Para productos inventariables, si la cantidad de la línea supera `stock` de la sucursal se muestra un aviso no bloqueante en la línea y en el resumen. El pedido sigue siendo `DRAFT`; la entrega conserva sus validaciones actuales.

### D8. Purchases
Factura de proveedor: proveedor, sucursal, terminal y tipo en la cabecera; tabla de líneas (código, producto, cantidad, costo unitario editable, subtotal); costo por defecto `product.cost`. Una línea por producto. Guardar usa `createPurchase` sin cambios.

### D9. Recepción por escaneo
- Resolución restringida a los productos de la compra; un producto ajeno es error duro y no modifica líneas.
- Cada escaneo `UNIT` suma 1 a la cantidad *preparada* de la primera línea del producto con pendiente; pesables piden la cantidad.
- La cantidad preparada nunca supera el pendiente: el excedente es error duro (decisión del propietario: cero tolerancia).
- "Dividir en lotes" crea sublíneas con lote, vencimiento, ubicación y cantidad propios; la suma no puede superar el pendiente. El payload envía una entrada por sublínea con el mismo `purchaseItemId`.
- Nada se persiste hasta "Confirmar recepción"; se conserva el `Idempotency-Key` actual y los tres pasos (información, productos, confirmación).

### D10. Contexto, tenant y sucursal
Las líneas pertenecen a la sucursal del formulario. Si se cambia la sucursal con líneas capturadas se pide confirmación y se limpian las líneas, porque el catálogo, el stock y los precios cambian. El tenant viene del contexto autenticado y el backend lo valida en cada endpoint.

### D11. RBAC
Sin cambios. La barra de escaneo solo aparece dentro de las acciones ya habilitadas (`ORDERS` WRITE para pedidos; `canCreate` / `canReceive` en compras). El backend mantiene `INVENTORY_PURCHASES` WRITE y los roles de recepción.

### D12. Accesibilidad y responsive
Barra de escaneo con `label`, región `aria-live="polite"` para resultados y `assertive` para errores, atajo F2 para enfocar la barra, botones de cantidad con nombre accesible y objetivos táctiles de al menos 40 px. En móvil las líneas se muestran como tarjetas y el total y la acción principal quedan en un pie fijo.

## Risks / Trade-offs

- Duplicar el algoritmo de detección del POS: aceptado por el propietario para aislar módulos; se documenta la referencia.
- Ventana de 300 ms: puede ignorar un escaneo legítimo muy rápido del mismo producto; mitigado con feedback visual y edición manual de cantidad.
- `orders-responsive-layout.spec.ts` verifica clases por texto: se actualizará con el nuevo diseño.
- Productos con pesos de 3 decimales se redondean a 2 en Orders (limitación existente de `order_items`).
- Usuarios sin lectura de productos no ven el precio calculado antes de guardar.

## Migration Plan

Solo frontend. Despliegue normal de `web`. Sin migraciones ni variables de entorno nuevas.

## Rollback

Revertir el commit del frontend. No hay datos ni contratos que revertir.

## Open Questions

Ninguna bloqueante. Decisiones del propietario registradas el 2026-11-11: solo modo teclado; bloquear `PACKAGE`/`BOX`; pesables con flujo POS y peso manual; doble escaneo de 300 ms solo en estos módulos; recepción con cero tolerancia y error duro para productos ajenos; precio con permiso actual; aviso de stock; dividir líneas en lotes; `/pos` sin cambios.
