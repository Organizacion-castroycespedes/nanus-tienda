# Evidencia - Fase 5.1.R Validacion UX operativa

## Resumen ejecutivo

Se ejecuto validacion funcional UX en QA local sobre copia PRD para POS, Orders y Purchases.

Decision final: **FASE 5.1.R APROBADA**.

No se agregaron funcionalidades nuevas. No se modifico backend, SQL ni reporteria.

## Ambiente usado

- Web local: `http://localhost:3000`
- API local: `http://localhost:4020/api`
- DB local: `localhost:5432/manus_tienda_prd`
- PostgreSQL: 16.12
- Tenant: `00000000-0000-0000-0000-000000000001`
- Confirmacion: no PRD real, no servidor remoto.

## Resultado POS

Ruta validada:

- `/00000000-0000-0000-0000-000000000001/pos`

Resultado:

- Producto `Leche` agregado al carrito por total `$ 4.800`.
- Modal `Cobrar venta` abrio con `EFECTIVO` seleccionado por defecto.
- Efectivo inicio con `4800`.
- Al agregar `NEQUI = 3000`, efectivo se rebalanceo a `1800`.
- Al cambiar `NEQUI = 4800`, efectivo quedo `0`.
- Al intentar `NEQUI = 5000`, UI mostro error: `Los pagos diferentes a efectivo no pueden superar el total.`
- Modal mantuvo foco visual. El contenido esta dentro del modal de cobro y no usa `alert()` ni `confirm()` nativos.

Nota operativa:

- No habia caja abierta para el usuario de prueba; se valido UX de pago sin confirmar venta real en POS.

## Resultado Orders crear pedido

Ruta validada:

- `/00000000-0000-0000-0000-000000000001/orders`

Resultado:

- En `Crear pedido`, seleccionar `Leche` lleno `Precio = 4800` desde `product.price`.
- Con cantidad `2`, subtotal y total recalcularon a `$ 9.600`.
- Precio manual `5000` se mantuvo al cambiar cantidad a `3`.
- Cambiar producto a `Arroz` actualizo `Precio = 4200`.
- Se creo pedido QA local con `Arroz`, cantidad `1`, precio `4200`.
- Pedido creado: `ccc01228-fd3b-4d61-95ad-0d235dbe492e`.

Validacion de error:

- Usuario `USER` intento crear pedido y API devolvio `403`.
- Error se mostro con `confirm-dialog.tsx`: `Permisos insuficientes Forbidden · Codigo 403`.

## Resultado Orders focus mode

Resultado:

- Accion `Entregar pedido` oculto filtros/listado y mostro foco principal.
- Encabezado mostro `Entregar pedido` y pedido seleccionado.
- Boton `Volver al listado` restauro listado.
- Accion `Facturar pedido` oculto filtros/listado y mostro foco principal.
- Encabezado mostro `Facturar pedido` y pedido seleccionado.

## Resultado Orders entrega

Resultado:

- Pedido `ccc01228-fd3b-4d61-95ad-0d235dbe492e` se abrio en `Entregar pedido`.
- Entrega de `Arroz = 1` mostro confirmacion previa `Confirmar entrega`.
- Tras confirmar, se mostro dialog visual `Entrega registrada`.
- No se uso `alert()` ni `confirm()` nativo.

## Resultado Orders facturacion

Resultado:

- Pedido `ccc01228-fd3b-4d61-95ad-0d235dbe492e` se abrio en `Facturar pedido`.
- Pago nuevo inicio con `EFECTIVO = 4200`.
- Al agregar `NEQUI = 1000`, efectivo se rebalanceo a `3200`.
- Al cambiar `NEQUI = 4200`, efectivo quedo `0`.
- Al intentar `NEQUI = 5000`, UI bloqueo con: `Los pagos nuevos no pueden superar el saldo restante tras aplicar los abonos heredados.`
- `Crear venta` mostro confirmacion visual previa.
- Al confirmar, se mostro dialog visual `Venta creada`.

## Resultado Purchases crear compra

Ruta validada:

- `/00000000-0000-0000-0000-000000000001/inventory/purchases`

Resultado:

- En `Crear compra`, seleccionar `Leche` lleno `Costo = 3600` desde `product.cost`.
- Con cantidad `2`, subtotal y total recalcularon a `$ 7.200`.
- Costo manual `3700` se mantuvo al cambiar cantidad a `3`.
- Cambiar producto a `Arroz` actualizo `Costo = 3400`.

## Resultado Purchases errores

Resultado:

- Se confirmo que `PurchaseForm` y `PurchaseReceiveForm` usan `confirm-dialog.tsx` para errores criticos de API mediante el flujo implementado en Fase 5.1.
- En esta ejecucion no se forzo un error backend real de compras porque las validaciones frontend bloquearon entradas invalidas antes de enviar.

## Regresion general

- POS cargo y permitio carrito/cobro.
- Orders cargo, creo pedido, entrego y facturo pedido.
- Purchases cargo y valido formulario de crear compra.
- No se tocaron `api/`, `backend-reporteria/`, SQL, migraciones ni funciones `inventory_create_sale`.

## Bugs encontrados

- Con usuario `USER`, crear pedido falla por permisos `403`; comportamiento esperado segun RBAC, y error se muestra con `confirm-dialog.tsx`.
- Al hacer `goto` directo desde browser automation, la sesion se pierde porque el access token vive en Redux y depende del refresh. Se valido navegando por links internos de la app.
- Warning React preexistente: keys duplicadas en select de `/inventory/lots`. No bloquea esta fase, pero queda como riesgo visual/tecnico.

## Bugs corregidos

- No se corrigio codigo en esta fase. La validacion no encontro bug bloqueante en el alcance POS, Orders y Purchases.

## Bugs pendientes

- Revisar warning de keys duplicadas en `/inventory/lots`.
- Probar producto sin `price` y producto sin `cost` con fixture dedicado si negocio requiere cubrir ese borde visual en QA.
- `npm run lint` sigue bloqueado por prompt interactivo de configuracion ESLint de Next.js.

## Comandos ejecutados

- `cd web && npx.cmd tsc --noEmit --pretty false` - OK, exit code 0.
- `cd web && npm.cmd run build` - OK, exit code 0.
- `cd web && npm.cmd run lint` - bloqueado por prompt interactivo de Next.js ESLint: `How would you like to configure ESLint?`.
- `npx.cmd -y @fission-ai/openspec@1.3.1 validate fortalecer-productos-inventario --type change --strict --json` - OK, change valido.
- `git diff --check` - OK, exit code 0. Solo avisos CRLF de Git.

## Confirmaciones

- No PRD real.
- No servidor remoto.
- No `backend-reporteria/`.
- No SQL.
- No migraciones.
- No cambios de backend.
