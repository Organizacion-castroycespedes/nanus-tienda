# Design

## Diagnostico

- El frontend envia `x-pos-session-id` desde `web/lib/http.ts` cuando hay contexto POS.
- `JwtAuthGuard` valida `x-pos-session-id` contra `pos_user_sessions` y carga `request.context`.
- Existe `@RequirePosSession()`, usado en ventas POS y facturar pedido.
- `@RequirePosSession()` no valida caja abierta.
- Pagos y movimientos validan `cashSessionId` cuando se envia, pero una llamada directa puede intentar flujos sin caja abierta.
- Domicilios ya tiene validacion condicional para operaciones con impacto de caja.

## Decision

Crear decorator backend:

```text
@RequireOpenCashSession()
```

`JwtAuthGuard` lee el metadata y valida:

- Usuario autenticado.
- Tenant correcto.
- Existe una sesion `cash_sessions` con `status = 'OPEN'`.
- Si hay contexto POS, la caja abierta debe coincidir con sucursal y terminal del POS.
- Si no hay contexto POS, debe existir caja abierta del usuario en el tenant.

Mensaje estandar:

```text
Debes tener una caja abierta para realizar esta operacion.
```

Si el contexto POS no coincide con caja abierta:

```text
La operacion requiere la caja actual del usuario.
```

## Aplicacion

Se aplica en endpoints mutables:

- Pedidos: crear, editar, entregar/recibir productos de pedido, confirmar, facturar, cancelar.
- Compras: crear, editar, recibir productos, cancelar, liquidar parcial.
- POS/Ventas: crear y cancelar.
- Pagos: crear.
- Movimientos de caja: crear.

Lectura queda sin bloqueo:

- Listados.
- Detalles.
- Tickets/PDF.
- Reportes.

## Roles

Regla segura:

- `USER` / `POS_USER`: caja abierta requerida.
- `ADMIN` / `SUPER_USER`: caja abierta requerida para mutaciones financieras/operativas.
- `SUPER_ADMIN`: sin bypass para registrar pagos/ventas/caja; solo conserva visibilidad.

## No cambia

- No altera facturacion fiscal/electronica.
- No altera calculos.
- No abre ni cierra caja automaticamente.
- No cambia inventario fuera de los flujos ya existentes.
