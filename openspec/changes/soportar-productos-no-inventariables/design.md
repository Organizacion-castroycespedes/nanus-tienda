## Context

El repositorio usa NestJS en `api/`, Next.js en `web/`, `backend-reporteria/` para reportes y PostgreSQL con funciones SQL. El producto actual no tiene un atributo de inventariabilidad. `inventory_create_sale_v2` valida existencias y lotes para las lineas de venta, mientras `StockMovementService` y el trigger de V108 protegen el ledger `stock_movements`.

La rama parte de `origin/develop` en `a3b139b280503457366a6b2dd2974adadebe69a1`. V108 y V109 fueron verificadas en la base PostgreSQL local autorizada; V109 no se reejecuta. Esta fase de HU-PRODUCT-011 no ejecuta nuevas migraciones ni escribe en `manus_tienda_qa`; las pruebas de escritura futuras deben usar una base aislada autorizada.

El owner ratifico `products.is_inventoryable BOOLEAN NOT NULL DEFAULT TRUE`, productos existentes como inventariables y el alcance C. Tambien ratifico que la recepcion comercial de servicios requiere accion explicita del usuario y permite parcialidad. El modulo contable queda fuera de HU-PRODUCT y sera una fase independiente. Todo desarrollo y validacion de esta HU se ejecutara localmente; no se usaran QA/PRD remoto, Vercel ni conexiones de base de datos en esta fase. El cambio se solapa con `fortalecer-productos-inventario`, `mejorar-reportes-productos-inventario`, `inmutabilizar-configuracion-estructural-productos`, `restringir-anulacion-dian-y-kardex` y `corregir-stock-insuficiente-y-recuperacion-carrito-pos`. Este OpenSpec define el comportamiento de no inventariables y requiere coordinacion de ownership antes de implementar archivos compartidos.

## HU-PRODUCT-011 implementation status

La implementacion local actual cubre el primer corte seguro:

- `products.is_inventoryable` se expone en entidad, repositorio, API y formulario web; el default efectivo para datos antiguos es `TRUE`.
- `TRUE -> FALSE` adquiere la fila del producto y scopes V108 por sucursal en orden estable, revisa saldos, reservas y lotes activos, bloquea saldos con `branch_id IS NULL` y exige motivo auditado. `FALSE -> TRUE` no crea stock ni movimientos.
- La recepcion exige `Idempotency-Key` en el controller. La reserva `PENDING` y el resultado `COMPLETED` del ledger se escriben en la misma transaccion de recepcion. El mismo hash recupera resultado; otro hash da conflicto. Un rollback no deja la reserva.
- Recepciones de servicios no crean `IN`, lotes ni enlaces fisicos; recepciones mixtas conservan atomicidad y bloqueos ascendentes ya implementados en `purchase.service.ts`.

Quedan fuera de este change los cambios de `inventory_invoice_order`, pedidos, ajustes, cancelaciones con reverso comercial, importacion y reporteria. La integracion POS de HU-PRODUCT-013C se ejecuta bajo el owner `corregir-stock-insuficiente-y-recuperacion-carrito-pos`; la redefinicion de `inventory_create_sale_v2` requiere una migracion forward-only posterior y ownership de migracion aun no asignado. No se altera V108 ni V109.

## Goals / Non-Goals

**Goals:**

- Usar `is_inventoryable BOOLEAN NOT NULL DEFAULT TRUE` como contrato ratificado de diseno; los productos existentes conservan `TRUE`.
- Mantener inventario, lotes, FEFO, reservas y movimientos para productos inventariables.
- Permitir venta POS y facturacion DIAN de servicios sin stock, sin `IN`/`OUT`, sin lotes y sin FEFO.
- Preservar `sale_items`, precios, descuentos, impuestos, pagos, categorias, subcategorias, `sale_type`, `measurement_unit`, `cost` y codigos fiscales.
- Hacer atomicas las ventas mixtas y protegerlas contra configuracion concurrente, ventas concurrentes y recepciones concurrentes.
- Preservar los invariantes de V108: `inventory_lock_stock_scope`, orden estable, snapshots, rechazo de negativos y tratamiento explicito de `branch_id NULL`.
- Definir transiciones auditadas `TRUE -> FALSE` y `FALSE -> TRUE`.
- Definir reglas para pedidos, entregas, compras, ajustes, cancelaciones, devoluciones, importaciones y reportes.

**Non-Goals:**

- No editar V108 ni funciones SQL historicas.
- No ejecutar nuevas DDL, DML, migraciones, seeds ni despliegues durante esta fase. V109 ya esta aplicada localmente y no se reejecuta.
- No consultar ni certificar QA o PRD.
- No acceder a QA/PRD remoto, Vercel, servicios remotos ni bases de datos durante esta fase documental. La implementacion y QA futura de esta HU quedan limitadas al entorno local autorizado.
- Excluir de esta HU el plan de cuentas, asientos automaticos, libros, balances, estados financieros y clasificacion contable automatica. La alternativa C cubre la operacion comercial; la integracion contable posterior usara informacion comercial auditable y un cambio independiente.
- No usar categoria o subcategoria para derivar inventariabilidad.
- No recalcular ni borrar movimientos historicos.
- No cambiar contratos fiscales DIAN sin evidencia y aprobacion separada.

## Decisions

### 1. Campo y fuente de verdad

Usar `products.is_inventoryable` como fuente de verdad server-side. El contrato ratificado es `BOOLEAN NOT NULL DEFAULT TRUE`. El cliente no puede enviar una politica que contradiga el producto persistido. Categorias y subcategorias solo clasifican.

Alternativa descartada: inferir servicios desde categoria, subcategoria, `sale_type` o `measurement_unit`. Es inseguro y mezcla clasificacion con control fisico.

### 2. Transiciones protegidas

`TRUE -> FALSE` requiere una transaccion que confirme, para todo el tenant y sus sucursales aplicables, saldo fisico operativo cero, reservas activas cero y lotes operativos pendientes cero. El repositorio no tiene entidad ni estados propios de reserva: la fuente actual es `inventory_lot_balances.quantity_reserved`; una reserva activa es cualquier valor positivo. Los lotes usan `inventory_lots.status` con estados `ACTIVE`, `EXPIRED`, `BLOCKED`, `CONSUMED` y `CANCELLED`; un lote `ACTIVE` con saldo o reserva positiva bloquea la transicion. El cambio debe dejar auditoria con actor, tenant, producto, valores anterior/nuevo, fecha y motivo.

`FALSE -> TRUE` inicia con stock cero. No crea movimientos ficticios ni lotes ficticios. El stock aparece despues de una recepcion o ajuste inventariable autorizado.

La transicion debe adquirir los locks advisory de los scopes afectados en orden estable. Debe coordinarse con ventas y recepciones que usan la misma clave V108. `branch_id NULL` debe regularizarse o rechazarse antes de desactivar inventario; no puede convertirse en bypass.

Alternativa descartada: hacer el campo inmutable como los seis campos estructurales existentes. El negocio pide configuracion individual y transiciones controladas; por eso la mutabilidad queda limitada por una politica transaccional.

### 3. Venta POS y venta mixta

La funcion SQL debe obtener `is_inventoryable` desde `products` por `tenant_id` y producto. Debe bloquear todas las lineas en orden determinista antes de leer la politica y ejecutar efectos. Para lineas inventariables mantiene stock, FEFO, lotes, `OUT`, snapshots y rechazo de negativos. Para lineas no inventariables omite esas operaciones.

Una venta mixta usa una unica transaccion. Si falla stock, lote, pago, idempotencia o facturacion dentro del flujo actual, no queda una venta parcial. `sale_items`, impuestos, descuentos, pagos, outbox y datos fiscales siguen el flujo existente.

La misma regla debe aplicarse a `inventory_invoice_order`; no basta cambiar solo POS.

Alternativa descartada: enviar `is_inventoryable` desde el navegador como autorizacion. El backend y SQL deben derivarlo para impedir falsificacion.

### 4. Movimientos y operaciones fisicas

Los productos `FALSE` no generan movimientos fisicos de venta, devolucion, cancelacion, compra ni ajuste. Las operaciones fisicas sobre ellos deben rechazarse con error de dominio, salvo que el dueño apruebe un flujo comercial de gastos/servicios separado.

Las reversiones solo revierten movimientos historicos de lineas inventariables. No se borran movimientos existentes por cambiar la configuracion del producto.

La alternativa C aprobada es una excepcion comercial documentada: una linea `FALSE` puede registrarse y marcarse como recibida o prestada comercialmente, pero no puede generar `IN`, lote, FEFO, reserva ni valoracion fisica. Un intento de recepcion fisica de esa linea debe fallar con error de dominio.

### 5. Compras de servicios y compras mixtas

El contrato real observado usa `POST /api/purchases`, `PUT /api/purchases/:id`, `POST /api/purchases/:id/receive`, `PATCH /api/purchases/:id/cancel` y `PATCH /api/purchases/:id/settle-partial`. `purchase.service.ts` crea el encabezado y `purchase_items` en transaccion, y `receivePurchase` bloquea la compra con `FOR UPDATE`, actualiza `received_quantity` y crea `stock_movements` `IN`. `PurchaseItemEntity` hoy contiene `productId`, `orderedQuantity`, `receivedQuantity`, `cost` y `subtotal`; no contiene politica de inventariabilidad, impuestos ni una cantidad fisica separada.

La implementacion futura debe resolver la politica desde `products.is_inventoryable` dentro de la transaccion. No se debe aceptar un flag de inventariabilidad enviado por el cliente. `ordered_quantity` y `received_quantity` conservan su significado comercial para todas las lineas. Para `TRUE`, el efecto fisico se prueba por los `stock_movements` `IN` y los enlaces de lotes existentes; para `FALSE`, actualizar `received_quantity` solo confirma prestacion comercial. No se agrega una columna de cantidad fisica sin demostrar que los movimientos existentes no permiten reconciliar una linea.

Una compra solo de servicios debe conservar proveedor, lineas, costos, subtotales, factura del proveedor, estado comercial, pagos y trazabilidad existentes. Su recepcion requiere una accion explicita del usuario autorizado sobre la linea o lineas, no se infiere al crear la compra, pagarla o adjuntar el documento del proveedor, y permite cantidades parciales. La accion confirma que el servicio fue prestado o aceptado comercialmente y no genera `IN`, lotes, FEFO, reservas ni valoracion fisica.

Una compra mixta conserva una sola compra comercial. En una recepcion mixta, cada linea se clasifica server-side: `TRUE` puede generar `IN`, lote, FEFO y valoracion conforme al flujo vigente; `FALSE` solo avanza su estado o cantidad comercial. La solicitud completa debe ser atomica: si falla una validacion obligatoria de cualquier linea, no queda recepcion comercial parcial, `IN` parcial, lote parcial, pago parcial ni auditoria de exito parcial. Si una compra repite el mismo `product_id` en varias lineas, la recepcion debe usar `purchaseItemId` explicito o una regla determinista documentada; no debe depender de un orden accidental del payload.

Los tres destinos de servicio se documentan asi, sin inferir contabilidad: servicio adquirido para reventa conserva costo y trazabilidad comercial, pero no stock; servicio de consumo interno conserva la compra y su proveedor, pero no se clasifica automaticamente como gasto; gasto operativo queda pendiente de la cuenta y asiento que el dominio financiero apruebe. Transporte tampoco se clasifica automaticamente como costo de inventario.

La cancelacion actual bloquea compras `PARTIAL`, `RECEIVED` y `CERRADA_PARCIAL`, y tambien bloquea pagos, `received_quantity` positivo o cualquier movimiento `PURCHASE`. La politica futura queda cerrada asi: una compra pendiente sin pagos incompatibles puede cancelarse con motivo y auditoria; una compra de servicios con recepcion comercial positiva debe usar un reverso comercial autorizado, con actor, motivo, fecha y referencia recuperable, o rechazarse con razon explicita si ese contrato aun no existe; nunca se crea un movimiento fisico ficticio. Una compra recibida o pagada requiere el flujo existente de reverso, devolucion, nota o reembolso que corresponda. En una compra mixta, solo se revierten movimientos y saldos fisicos de lineas `TRUE`; la linea `FALSE` se revierte comercial o financieramente sin movimiento. No se permite marcar cancelada una compra con pagos, documentos o efectos fisicos no revertidos.

El codigo observado registra `PURCHASE_CREATED`, `PURCHASE_PARTIAL_CLOSED` y `PURCHASE_CANCELLED` en `auditoria_eventos`, pero no expone una operacion de reverso comercial de servicio. Por eso, la implementacion debe reutilizar la auditoria existente y definir una accion de reverso con linea, cantidad, actor, motivo, fecha y referencia recuperable; si el contrato de reverso no se aprueba, debe rechazar la cancelacion. No se asume un endpoint, estado o tabla nueva en esta fase.

La liquidacion parcial actual calcula `total_liquidado` con `received_quantity * cost` para todas las lineas. Esto puede conservarse como regla comercial para servicios y fisicos, sin crear contabilidad nueva, pero debe probarse que los pagos no superen el valor recibido y que no se cambie la valoracion fisica de `FALSE`.

Los pagos existentes soportan referencias `PURCHASE` y `PURCHASE_ORDER`, asignaciones por tenant, direccion `OUT` y sincronizacion de `payment_status`, `total_paid`, `balance_due` y `balance`. `document_payment_operations` ya usa `operation_key`, `request_fingerprint`, estado y resultado de pagos, pero su semantica es exclusiva de pagos y no es ledger de recepcion. Este cambio preserva esos contratos. No se observo un contrato de impuestos de compra equivalente al de ventas en las tablas y entidades inspeccionadas; la implementacion no debe inventarlo. Para compras, costos, subtotales, pagos y documentos se preservan; impuestos o asientos nuevos quedan fuera de HU-PRODUCT.

#### RBAC de recepcion y reverso comercial

La implementacion debe reutilizar el RBAC vigente del controlador de compras: roles `SUPER_ADMIN`, `SUPER_USER` y `ADMIN`, permiso `INVENTORY_PURCHASES` con nivel `WRITE` para crear, editar y recibir. La cancelacion y el reverso comercial de servicios deben usar la accion existente `INVENTORY_PURCHASES`/`WRITE`/`cancel`; la liquidacion parcial conserva `INVENTORY_PURCHASES`/`WRITE`/`settle_partial`. No se crea un permiso nuevo en esta HU. Si el owner exige separar reverso de cancelacion en el futuro, esa separacion requiere decision y OpenSpec independiente.

#### Alcance contable excluido

HU-PRODUCT no crea ni modifica plan de cuentas, cuentas, asientos automaticos, libros, balances, estados financieros, clasificacion contable automatica ni reglas de gasto, costo de inventario o reventa. Una linea de servicio para reventa, consumo interno, gasto operativo o transporte conserva sus datos comerciales y proveedor, pero no recibe una naturaleza contable inferida. La fase contable posterior definira su propio OpenSpec y consumira la trazabilidad comercial aprobada aqui.

#### Fuente de reservas y lotes

No se encontro tabla de reservas ni estado de reserva independiente. La fuente real es `inventory_lot_balances.quantity_reserved`, con invariantes `quantity_reserved >= 0` y `quantity_reserved <= quantity_on_hand`; las operaciones existentes son `reserve` y `releaseReservation`. Para la transicion `TRUE -> FALSE`, se deben revisar todas las sucursales del tenant. Un lote queda regularizado solo cuando la evidencia existente muestra `quantity_on_hand = 0`, `quantity_reserved = 0` y `quantity_available = 0` para cada saldo del producto, y no existe un `inventory_lots.status='ACTIVE'` con saldo o reserva positiva. `EXPIRED`, `BLOCKED`, `CONSUMED` y `CANCELLED` no bloquean por el estado aislado, pero cualquier saldo, reserva o efecto fisico pendiente si bloquea. No se inventa una clasificacion adicional de obligaciones: las obligaciones operativas se consideran pendientes solamente cuando estan respaldadas por esos saldos, reservas, lotes activos o movimientos fisicos existentes.

### 6. Cantidades comerciales, efectos fisicos y estados

`ordered_quantity` y `received_quantity` son cantidades comerciales existentes. Los estados actuales `PENDING`, `PARTIAL`, `RECEIVED`, `CERRADA_PARCIAL` y `CANCELLED` se conservan. `PENDING`, `PARTIAL` y `RECEIVED` se calculan con la recepcion comercial de las lineas; `CERRADA_PARCIAL` conserva la liquidacion parcial actual. No se agrega un estado nuevo para servicios en esta fase.

Para una linea `TRUE`, `received_quantity` debe quedar respaldada por el efecto fisico transaccional correspondiente: `stock_movements` `IN` con `reference_type='PURCHASE'` y, cuando aplique, `stock_movement_lots` y saldos de lote. Para una linea `FALSE`, `received_quantity` confirma la prestacion comercial y no debe crear movimiento, lote, reserva o valoracion. La reconciliacion por linea debe usar `purchaseItemId` cuando existan varias lineas del mismo producto. Si una auditoria futura demuestra que los movimientos actuales no bastan para distinguir esas lineas, se abre un cambio de esquema separado; no se agrega cantidad fisica ahora.

La recepcion parcial conserva las cantidades y estados existentes. Reintentar una operacion ya confirmada no debe incrementar otra vez `received_quantity`; la idempotencia se define por operacion de recepcion, no por comparar cantidades.

### 7. Idempotencia de recepcion

Ventas ya tienen el patron persistente `sale_creation_idempotency` con clave tenant, hash de request, reserva transaccional, `FOR UPDATE` y resultado asociado. Pagos tienen `document_payment_operations` con `operation_key`, `request_fingerprint`, estado `PENDING`/`COMPLETED` y referencias de pagos. Ninguno se reutiliza literalmente para compras: el primero depende de `sales` y el segundo de pagos; ambos sirven como convenciones probadas.

El ledger creado por V109 usa la clave `(tenant_id, purchase_id, idempotency_key)`, `request_hash` de 64 caracteres hexadecimales, estado `PENDING`/`COMPLETED`/`FAILED`, referencia, resultado recuperable y timestamps. El controller exige `Idempotency-Key`; el servicio reclama la clave con unicidad transaccional, completa el resultado antes de `COMMIT` y conserva la fila sin purga automatica. La reserva, movimientos, actualizaciones de `purchase_items`, lotes y estado de compra se confirman en la misma transaccion. El mismo hash recupera el resultado; un hash diferente da conflicto; un `PENDING` o `FAILED` no se reejecuta automaticamente. Las pruebas unitarias actuales cubren replay y conflicto; timeout real y concurrencia PostgreSQL quedan pendientes.

Invariantes:

- Misma clave y mismo hash: devolver el resultado confirmado sin nuevos efectos.
- Misma clave y hash distinto: responder conflicto y no modificar datos.
- Misma clave concurrente: una operacion gana; la otra espera o recibe conflicto controlado, sin duplicar efectos.
- Timeout despues de `COMMIT`: una consulta posterior recupera el resultado del ledger; `FOR UPDATE` por si solo no basta.
- Rollback antes de `COMMIT`: la reserva queda reutilizable, sin movimientos ni cantidades incrementadas.
- Payload igual con clave distinta: es una nueva operacion y solo procede si queda cantidad comercial pendiente; no se deduplica por similitud.

### 8. Locks V108

Se conserva `inventory_lock_stock_scope(tenant_id, branch_id, product_id)`. La venta bloquea productos distintos en orden ascendente antes del `INSERT INTO sales`. El trigger `BEFORE INSERT` conserva el calculo de `stock_before`/`stock_after` y el rechazo de `OUT` negativo para sucursales no nulas.

Para evitar carreras de configuracion, la nueva funcion debe bloquear tambien la politica de cada producto de la venta, aunque una linea sea no inventariable. Los movimientos multi-producto de pedidos, recepciones y ajustes deben preparar y bloquear el conjunto completo en el mismo orden, no depender de llamadas individuales en orden arbitrario.

El flujo actual de compras bloquea primero la fila `purchases` y luego llama `StockMovementService` por cada linea en el orden del payload. `StockMovementService` adquiere el scope advisory por producto y V108 vuelve a adquirirlo en el trigger. Ese orden por payload no es suficiente como protocolo multi-producto.

Para compras, el protocolo futuro debe reservar primero la operacion de idempotencia si existe, bloquear la fila `purchases`, deduplicar y ordenar los `product_id` ascendentemente, adquirir todos los scopes `inventory_lock_stock_scope`, leer `is_inventoryable` y politicas fisicas, validar cantidades y branch, y aplicar efectos. Las lineas de servicio tambien participan en la lectura coordinada de politica, aunque no lean saldo.

El orden global recomendado es: ledger de idempotencia, documento comercial, productos distintos ordenados ascendentemente, scopes advisory V108 en el mismo orden, filas de configuracion/politica, y luego efectos comerciales o fisicos. La funcion de venta V108 actualmente bloquea productos antes de insertar la venta y no bloquea `purchases`; no se demostro un ciclo con el flujo actual. Si un flujo futuro toca varios documentos, debe ordenar todos los documentos por tipo/id antes de adquirir productos. No se debe introducir una espera producto -> purchase mientras otra ruta mantiene purchase -> producto.

El trigger V108 conserva snapshots y rechazo de negativos para sucursales no nulas. `branch_id NULL` actualmente retorna temprano en el trigger, aunque `StockMovementService` mantiene el lock advisory con scope nulo. La compra nueva exige branch al crearla, pero una recepcion heredada puede resolver branch nulo y crear movimiento no loteado sin snapshot. Por compatibilidad, no se propone aun una restriccion global `NOT NULL`: primero se debe medir y regularizar el legado. En implementacion, una recepcion fisica con branch nulo debe rechazarse o recibir un branch autorizado antes del movimiento; una recepcion comercial de servicio no puede usar null para evadir tenant/branch.

Alternativa descartada: quitar el trigger o reemplazar el lock por una lectura de stock en API. Eso rompe la garantia de V108.

### 9. Campos fisicos y compatibilidad historica

Cuando `is_inventoryable=false`, `requires_lot`, `requires_expiration`, `is_perishable`, `min_stock` y `max_stock` quedan inactivos como politica operativa. Se recomienda conservar sus valores almacenados para historia y auditoria, sin usarlos para autorizar venta o reportar stock.

Los productos existentes reciben `TRUE`. Las ventas historicas, movimientos, lotes, precios y documentos DIAN se conservan.

### 10. Reporteria

Reportes comerciales incluyen servicios. Reportes fisicos distinguen `NOT_APPLICABLE` de `OUT_OF_STOCK` y excluyen servicios de stock, FEFO, lotes, minimos y valorizacion fisica. `inventory_bi_base` y `fnc_report_product_inventory` deben recibir el nuevo atributo o un estado equivalente.

Alternativa descartada: mostrar servicios como stock cero agotado. Produce decisiones operativas falsas.

### 11. Ownership

El manifiesto conserva una asociacion historica para `soportar-productos-no-inventariables/**`. El `current_ownership` mantiene `corregir-stock-insuficiente-y-recuperacion-carrito-pos` sobre ventas/POS y `evolucionar-gobernanza-openspec-ownership-windows` sobre `scripts/governance/*` y su OpenSpec. Ahora agrega una entrada aditiva de esta HU para las cuatro rutas de compras autorizadas. `restringir-anulacion-dian-y-kardex` e `inmutabilizar-configuracion-estructural-productos` mantienen sus asociaciones y no se reasignan aqui. `fortalecer-productos-inventario` y `mejorar-reportes-productos-inventario` conservan sus responsabilidades de productos y reportería.

Matriz vigente, sin apropiarse de rutas ajenas:

- Producto y transiciones: `fortalecer-productos-inventario`, coordinado con `inmutabilizar-configuracion-estructural-productos` para `api/src/modules/inventory/services/product.service.ts`, DTOs y `web/modules/inventory/components/ProductForm.tsx`.
- Compra, recepcion e idempotencia: `soportar-productos-no-inventariables` para `api/src/modules/inventory/controllers/purchase.controller.ts`, `api/src/modules/inventory/services/purchase.service.ts`, `api/src/modules/inventory/entities/purchase.entity.ts` y `api/src/modules/inventory/entities/purchase-item.entity.ts`. Las pruebas siguen dentro del change, sin agregar ownership funcional ajeno.
- Venta POS y recuperacion: `corregir-stock-insuficiente-y-recuperacion-carrito-pos` mantiene ownership unico sobre `SaleRepository`, `SaleService`, `PosScreen`, `usePosCartStore`, `web/store/posCart`, `PosProductCard` y `CartSaleModal`. HU-PRODUCT define el contrato SQL/fisico, y ambos changes coordinan la frontera sin transferir ownership.
- Movimientos, anulaciones y reversos: `restringir-anulacion-dian-y-kardex` para `stock-movement.service.ts` y anulaciones. HU-PRODUCT define la regla de no movimiento para `FALSE`.
- Reporteria e inventario BI: `mejorar-reportes-productos-inventario` para `backend-reporteria`, `inventory_bi_base` y `fnc_report_product_inventory`. Owner debe confirmarse.
- Gobernanza: `evolucionar-gobernanza-openspec-ownership-windows` para `scripts/governance/openspec-scope.json`.

Procedimiento autorizado identificado en `scripts/governance/README.md` y `evolucionar-gobernanza-openspec-ownership-windows`: conservar `changes[].paths` como asociacion historica y agregar un unico registro en `current_ownership` con `change_id`, rutas exactas y razon auditable. El owner debe existir, tener OpenSpec estrictamente valido y no compartir patrones con otro owner actual. La autorizacion del owner del proyecto habilita esta entrada aditiva. La cobertura resultante debe ser `CURRENT_SINGLE_MATCH`.

La entrada de ownership fue agregada de forma minima y aditiva. El diff historico preexistente del manifest se conserva intacto. No se modifican ownership de productos, ventas, POS, reportería, kardex ni governance.

## Risks / Trade-offs

- [Definicion SQL instalada distinta a Git] -> Revalidar la funcion instalada en un ambiente autorizado antes de migrar; no asumir que V108 esta aplicada.
- [Deadlock por orden distinto] -> Bloquear conjuntos completos por UUID ascendente y documentar el protocolo para todos los escritores.
- [Carrera entre transicion y venta] -> Usar la misma clave advisory V108 para todos los productos afectados y leer la politica despues del lock.
- [Producto tenant-wide y stock por sucursal] -> Evaluar todas las sucursales del tenant antes de `TRUE -> FALSE`; aplicar rechazo o regularizacion autorizada al legado `branch_id NULL` sin modificarlo en esta HU.
- [Campos fisicos heredados con valores verdaderos] -> Conservar datos, pero aplicar politica efectiva `FALSE` y evitar validaciones fisicas para servicios.
- [POS viejo bloquea stock cero] -> Desplegar contrato API y funcion SQL antes de habilitar el control web.
- [Reportes mezclan servicio con agotado] -> Agregar estado explicito y pruebas de conteos, filtros y valorizacion.
- [Compra actual modela toda recepcion como fisica] -> Separar recepcion comercial de recepcion fisica por linea; no reutilizar `received_quantity` como evidencia suficiente hasta aprobar el contrato de datos.
- [Impuestos o contabilidad de compra no observados] -> Mantener costos, subtotales, pagos y documentos actuales; bloquear la implementacion de asientos o impuestos nuevos hasta decision del owner financiero.
- [Reintento de recepcion] -> Usar ledger de operacion con hash y resultado; `FOR UPDATE` sobre `purchases` solo evita carreras durante la transaccion, no timeout posterior a `COMMIT`.
- [Mismo producto en varias lineas] -> Exigir `purchaseItemId` o una asignacion determinista y auditable antes de soportar recepcion ambigua.
- [Branch heredado nulo] -> Medir y regularizar legado antes de imponer `NOT NULL`; bloquear toda recepcion fisica nueva sin branch valido.
- [Solapamiento de ownership] -> Mantener ownership actual separado por rutas; la entrada de compras no cubre productos, ventas, POS, reportería, kardex ni governance.

## Migration Plan

1. Implementar por fases el ownership de compras ya formalizado, la recepcion comercial, cancelacion de servicios, branch heredado y ledger de idempotencia; el nombre y default del campo ya estan ratificados.
2. Validar este OpenSpec, asociarlo en el manifiesto gobernado y verificar una version moderna disponible; no usar `MAX(version)+1` ni ejecutar aun.
3. HU-PRODUCT-008 creo `V109__products_non_inventoryable_and_purchase_receipt_idempotency.sql` con `is_inventoryable`, default `TRUE` y sin columnas de cantidad fisica nuevas; ya esta aplicada en la base local autorizada y no se reejecuta.
4. V109 creo en la misma migracion el ledger durable de idempotencia de recepcion; no se reutilizan literalmente tablas de ventas o pagos.
5. Redefinir en migracion posterior o coordinada `inventory_create_sale_v2` e `inventory_invoice_order`, conservando V108.
6. Desplegar API compatible con el campo, cantidades comerciales y recepcion por linea.
7. Desplegar POS, formularios y compras despues de que API y funciones SQL soporten el contrato.
8. Actualizar pedidos, compras, recepciones, pagos, ajustes, lotes, reservas, cancelaciones y reporteria.
9. Ejecutar pruebas y QA manual solo localmente; cualquier promocion `LOCAL -> QA -> PRD` queda fuera de esta HU y requiere autorizacion posterior. No se escribira la base comercial local `manus_tienda_qa` durante HU-PRODUCT-011.

Rollback conceptual:

- Detener primero la habilitacion de servicios en web/API.
- Mantener `is_inventoryable` y la auditoria sin borrar datos.
- Revertir solo mediante migracion forward-only aprobada si la politica de rollback lo exige.
- No eliminar movimientos, lotes, ventas, pagos ni documentos DIAN.
- No ejecutar rollback destructivo ni editar V108.

## Local implementation and QA plan

La HU se implementara y validara solo en el repositorio y herramientas locales. Antes de cualquier migracion o escritura futura, el operador debe:

1. Obtener autorizacion explicita para una base local y una lista de nombres permitidos.
2. Leer solo identidad saneada de configuracion; nunca imprimir `DB_PASSWORD`, `JWT_SECRET`, tokens, claves o contenido completo de `.env`.
3. Exigir `ENVIRONMENT=LOCAL`, host loopback (`localhost`, `127.0.0.1` o `::1`) y nombre de base autorizado. Rechazar host remoto, nombres QA/PRD o configuracion ambigua.
4. Ejecutar una verificacion de solo lectura de base, esquema, servidor y `migrations_history` antes de cualquier DDL/DML.
5. Validar la migracion con `MIGRATION_DRY_RUN=YES` y usar despues solo `scripts/database/apply_single_migration.sh` si la autorizacion local sigue vigente.
6. Ejecutar API, web y pruebas con procesos locales, sin Vercel, QA/PRD ni servicios remotos.
7. Guardar evidencia saneada: identidad local, HEAD, OpenSpec, checksum y resultado de pruebas; nunca credenciales.

Este procedimiento queda documentado, pero no se ejecuta en HU-PRODUCT-004B.

## Open Questions

Decisiones adoptadas para este cierre: `is_inventoryable BOOLEAN NOT NULL DEFAULT TRUE` es contrato ratificado; los productos existentes son `TRUE`; `ordered_quantity` y `received_quantity` son comerciales; la recepcion de servicios requiere accion explicita y puede ser parcial; servicios recibidos no generan `IN`; compras mixtas son atomicas; `purchaseItemId` es obligatorio para lineas repetidas; `inventory_lot_balances.quantity_reserved` es la fuente actual de reservas; un lote regularizado no tiene saldo, reserva ni disponibilidad positiva; no hay purga automatica del ledger en esta HU; el RBAC existente protege recepcion, cancelacion y liquidacion; plan de cuentas, asientos, libros, balances, estados financieros y clasificacion contable automatica quedan fuera; y el legado `branch_id NULL` se analiza antes de una restriccion global.

- Que contrato existente de impuestos de compra debe preservarse, si alguno aparece fuera de las tablas inspeccionadas?
- Que branch autorizado regularizara compras heredadas con contexto nulo?

- La forma exacta de respuesta de recepcion comercial puede alinearse con la respuesta existente, pero debe devolver resultado recuperable y auditoria.
- Los campos fisicos se conservan siempre o se normalizan despues de auditar?
- Que reportes historicos muestran el valor actual y cuales deben preservar la clasificacion de la venta original?
- Como se regularizan movimientos con `branch_id NULL` antes de cambiar la politica?
- Cual es la lista local autorizada de bases y nombres de esquema antes de ejecutar una migracion futura?
