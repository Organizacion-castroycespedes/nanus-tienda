## Why

Los formularios de pedidos de venta (`/orders`) y de compras (`/purchases`) se capturan hoy fila por fila con un selector de producto, sin soporte para lector de códigos de barras. El POS (`/pos`) ya procesa lectores HID que funcionan como teclado, pero esa lógica vive dentro de `PosScreen.tsx` y en utilidades propias del POS.

HU-SCAN-001 pide modernizar la captura de Orders con una experiencia visual tipo POS y la de Purchases con una presentación tipo factura de proveedor, habilitando escaneo continuo y búsqueda manual, y permitir que la recepción de compras se prepare escaneando los productos recibidos, sin que el escaneo por sí mismo mueva inventario, registre pagos ni facture.

## What Changes

- **Núcleo de captura propio de Inventario** (`web/modules/inventory/barcode/`): detección de lector HID por tiempos de tecleo (modo teclado), resolución de códigos con resultado explícito (encontrado, ambiguo, inexistente, presentación no soportada), protección de doble escaneo de 300 ms y una barra de escaneo accesible. Se usa el POS solo como referencia: **no** se importa ni modifica nada de `web/modules/pos/**`.
- **Orders**: rediseño de `OrderForm` con barra de escaneo y búsqueda manual, ticket de líneas sin duplicar productos, control de cantidades, precio informativo calculado por el backend (`POST /pricing/preview-line`, canal `ORDER`) y aviso de stock insuficiente. Guardar sigue usando `POST/PUT /orders`; el backend continúa recalculando precio e impuestos.
- **Purchases (captura)**: rediseño de `PurchaseForm` como factura de proveedor con escaneo continuo, líneas únicas por producto y costo editable. Guardar sigue usando `POST /purchases`.
- **Recepción**: `PurchaseReceiveForm` permite escanear solo productos de la compra, acumula una cantidad *preparada* que no puede superar el pendiente, permite dividir una línea en varios lotes y solo afecta inventario al confirmar con el endpoint actual (`POST /purchases/:id/receive`, idempotente).
- **Productos pesables**: mismo flujo de decisión que el POS (UNIT suma 1, BOTH pregunta Unidad/Peso, WEIGHT pide el peso), con peso digitado manualmente (2 decimales); sin báscula.
- **Códigos de caja/paquete** (`PACKAGE`, `BOX`): se bloquean con aviso porque no existe factor de conversión.

## Capabilities

### New Capabilities

- `inventory-barcode-capture`: captura con lector HID en modo teclado y resolución de códigos para los módulos de Inventario (Orders y Purchases).
- `orders-barcode-capture`: captura de pedidos de venta con escaneo y experiencia visual tipo POS.
- `purchases-barcode-capture`: captura de compras con escaneo y presentación tipo factura de proveedor.
- `purchase-receipt-scan`: preparación de la recepción de compras mediante escaneo.

### Modified Capabilities

Ninguna capacidad publicada en `openspec/specs/` cambia. El POS (`pos-barcode-hid` en `validar-lector-barras-hid-pos-electron`) no se modifica.

## Impact

- **Web:** `web/modules/inventory/barcode/**` (nuevo), `OrderForm.tsx`, `PurchaseForm.tsx`, `PurchaseReceiveForm.tsx`, `purchase-receive-lines.ts` y sus pruebas, `web/app/[tenant]/orders/**` y `web/app/[tenant]/purchases/page.tsx`.
- **API:** sin cambios. Se reutilizan `GET /products?branchId`, `POST /pricing/preview-line`, `POST/PUT /orders`, `POST /purchases` y `POST /purchases/:id/receive`.
- **Base de datos:** sin migraciones.
- **POS (`/pos`), agente de periféricos y Electron:** sin cambios de código. Electron solo requiere QA de regresión.
- **Gobernanza:** reasignación autorizada por el propietario de la titularidad vigente de `OrderForm.tsx`, `web/app/[tenant]/orders/page.tsx`, `orders-responsive-layout.spec.ts` y `PurchaseReceiveForm.tsx` a este change en `scripts/governance/openspec-scope.json`.
