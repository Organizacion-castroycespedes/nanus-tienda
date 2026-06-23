# Design

## Diagnostico

1. Pedidos no guardaban `cash_session_id`.
2. Compras no guardaban `cash_session_id`.
3. Pedidos y compras guardaban sucursal/terminal solo como contexto operativo via auditoria.
4. La creacion de pedidos/compras ya exige `@RequireOpenCashSession()`, pero el servicio no persistia la caja en el registro principal.
5. El listado no aceptaba filtro por caja.
6. El frontend ya consulta caja actual en `orders` y `purchases` para bloquear mutaciones.
7. `x-pos-session-id` solo se envia cuando el cliente pide `includePosSession`; los listados no deben depender de ese header.

## Decision

Agregar persistencia aditiva:

- `orders.cash_session_id UUID NULL`
- `purchases.cash_session_id UUID NULL`

Nuevos registros creados bajo caja abierta guardan `cash_session_id` desde `request.context.cashSessionId`.

Agregar scope:

```text
cashScope=current|all
```

Reglas:

- `cashScope=current` resuelve la caja abierta del usuario autenticado.
- Si no hay caja abierta, devuelve lista vacia.
- Si se envia `cashSessionId`, debe coincidir con la caja abierta del usuario.
- `cashScope=all` solo para `ADMIN`, `SUPER_USER`, `SUPER_ADMIN`.
- `USER` no puede usar `cashScope=all`.

## Frontend

- Pedidos y compras envian `cashScope=current` por defecto.
- Se muestra indicador `Alcance: Caja actual`.
- Si no hay caja abierta, no se muestra historico como operacion actual.
- Roles admin pueden cambiar explicitamente a `Todas`.

## No Cambia

- No se cambia cierre de caja.
- No se cambia arqueo.
- No se cambia ticket.
- No se cambia facturacion fiscal/electronica.
- No se cambia inventario fuera de filtros/listados.
