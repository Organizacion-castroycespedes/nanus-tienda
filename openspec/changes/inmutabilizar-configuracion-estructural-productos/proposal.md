## Why

Hoy un producto puede cambiar despues de creado su unidad base, modelo/unidad de venta y reglas de lote o vencimiento. Ese cambio reinterpreta movimientos historicos y puede separar el Kardex agregado de los saldos por lote, como ya ocurre con stock creado antes de activar lotes.

## What Changes

- Permitir definir durante la creacion `unitId`, `saleType`, `measurementUnit`, `isPerishable`, `requiresLot` y `requiresExpiration` con las validaciones existentes.
- Hacer inmutables esos seis campos desde el primer guardado, sin depender de que el producto tenga movimientos.
- Rechazar en backend cualquier cambio real de esos campos, incluyendo llamadas API directas e importaciones que reutilizan `ProductService`.
- Mantener compatibles los clientes que envian de nuevo el mismo valor y los productos historicos ya persistidos.
- Deshabilitar esos controles en la edicion web y explicar que solo se definen al crear el producto.
- Mantener editables los atributos comerciales y operativos que no cambian la identidad estructural del inventario.
- Documentar, fuera de la implementacion funcional, la intervencion transaccional requerida para reconciliar stock historico sin lote. No se ejecuta ni se agrega una migracion de datos en esta HU.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `productos`: restringe la configuracion estructural del producto a su creacion y define compatibilidad de actualizaciones parciales e historicas.

## Impact

- Backend: `ProductService` y sus pruebas unitarias.
- Frontend: formulario y secciones de producto, con pruebas de controles bloqueados en modo edicion.
- Importacion: conserva el contrato existente y recibe el mismo rechazo central cuando intenta cambiar configuracion estructural.
- Datos: no requiere migracion de esquema ni cambia ventas, FEFO, Kardex, lotes o V108.
- Operacion: los productos historicos conservan exactamente su configuracion actual; cualquier reconciliacion de datos se autoriza y ejecuta por separado.
