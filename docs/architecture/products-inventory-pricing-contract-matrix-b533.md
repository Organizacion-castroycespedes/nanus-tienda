# Matriz de contratos: productos, inventario y pricing — B5.3.3

| Acción | Método y ruta | Servicio/control | Persistencia o efecto |
|---|---|---|---|
| Crear producto | `POST /products` | `ProductController`, permisos de inventario | `products`, impuestos y perfil |
| Consultar catálogo | `GET /products` | tenant y sucursal | productos, barcodes y stock consultado |
| Cambiar precio | `POST /products/:id/change-price` | ruta dedicada | precio e historial |
| Lote | `GET/POST/PUT /inventory/lots` | acceso de inventario | `inventory_lots` |
| Bloquear/cancelar lote | `PATCH /inventory/lots/:lotId/block` / `cancel` | estado de lote | lote y balances relacionados |
| Balance de lote | servicio de balances | tenant, sucursal, ubicación | `inventory_lot_balances` |
| Preview FEFO | `GET /inventory/fefo/preview` | acceso de sucursal | selección calculada; no mueve stock |
| Ajuste | `POST /stock-adjustments` | sucursal y contexto operativo | movimiento y vínculos de lote |
| Pricing de línea | `POST /pricing/preview-line` | canal `POS` o `ORDER` | preview; no persiste documento |
| Preview fiscal | `POST /pricing/fiscal-preview` | validación de perfil | preview tributario |
| Listar promociones | `GET /pricing/promotions` | tenant y permiso | promociones aplicables/admin |
| Crear promoción | `POST /pricing/promotions` | permiso de pricing | promoción, productos y sucursales |
| Actualizar promoción | `PATCH /pricing/promotions/:id` | permiso de pricing | reemplaza objetivos en transacción |
| Desactivar promoción | `PATCH /pricing/promotions/:id/deactivate` | permiso de pricing | `is_active=false` |

## Contexto y límites

Los servicios reciben tenant y, en inventario, sucursal y ubicación. Los
guards y permisos se aplican en los controladores reales. La selección FEFO
comprueba acceso a sucursal; la consulta de pricing usa tenant, producto,
sucursal y fecha. No se certifica cobertura idéntica de cada ruta frontend.

La Web usa clientes en `web/modules/inventory/services/`,
`web/modules/pricing/services/promotions.service.ts` y los componentes POS.
La forma exacta de cada DTO se mantiene en el código; esta matriz no inventa
campos no necesarios para el flujo documentado.
