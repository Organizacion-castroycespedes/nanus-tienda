# Domicilios - Smoke HTTP backend integral QA

## Contexto

- Rama: `feat/0.0.1/domicilios-plan-implementacion-backend`
- HEAD base de referencia: `c92849b feat(deliveries): integrate deliveries with sales`
- Fecha: `2026-06-21`
- Ambiente: local/QA controlado
- API base: `http://localhost:4062/api`
- DB: `manus_tienda_prd`
- Produccion tocada: `NO`

## Preparacion

- API local levantada en `4062` con variables de entorno locales.
- La instancia vieja en `4020` pertenecia a otra ruta de trabajo y no se uso para el smoke.
- Script local/QA de permisos aplicado:
  - `scripts/database/security/20260620_1730_deliveries_permissions_local_qa.sql`
- Tokens obtenidos via `POST /api/auth/login/force` para:
  - `admin+default@manustienda.local`
  - `user+default@manustienda.local`
- Password demo usada:
  - `12345678!`

## Fixtures

- Tenant: `default`
- `tenant_id`: `00000000-0000-0000-0000-000000000001`
- `branch_id`: `ab41d3da-6686-4de3-9191-875a5a7da5a5`
- Courier/repartidor de prueba: `c78f123b-c672-4277-a2d0-eb580d68c544`
- Pedido de prueba: `669d1646-c725-49b5-b82f-ba80f8b4ba8f`
- Venta de prueba: `9db41f09-01fe-4dfd-8705-60813b5bdf33`

## Endpoints probados

### Domicilios standalone

- `GET /api/deliveries`
- `POST /api/deliveries`

Resultado:

- PASS
- Se creo domicilio standalone en `CREATED`.
- Se pudo cancelar luego.

### Domicilios desde pedidos

- `POST /api/orders/:id/delivery`
- `GET /api/orders/:id/delivery`
- `GET /api/deliveries?order_id=:id`

Resultado:

- PASS
- Se creo domicilio en `CREATED`.
- Se consulto por pedido.
- Se filtro por `order_id`.
- Segundo intento rechazo controlado.

### Domicilios desde ventas

- `POST /api/sales/:id/delivery`
- `GET /api/sales/:id/delivery`
- `GET /api/deliveries?sale_id=:id`

Resultado:

- PASS
- Se creo domicilio en `CREATED`.
- Se consulto por venta.
- Se filtro por `sale_id`.
- Segundo intento rechazo controlado.

### State machine

- `POST /api/deliveries/:id/assign`
- `POST /api/deliveries/:id/dispatch`
- `POST /api/deliveries/:id/mark-delivered`
- `POST /api/deliveries/:id/mark-not-delivered`
- `POST /api/deliveries/:id/cancel`

Resultado:

- PASS
- Flujo feliz pedido: `CREATED -> ASSIGNED -> DISPATCHED -> DELIVERED`
- Flujo no entregado: `CREATED -> ASSIGNED -> DISPATCHED -> NOT_DELIVERED`
- Flujo cancelado: `CREATED -> CANCELLED`
- Transiciones invalidas rechazadas con 400.

### Permisos

- `DELIVERIES_VIEW`
- `DELIVERIES_CREATE`
- `DELIVERIES_ASSIGN`
- `DELIVERIES_DISPATCH`
- `DELIVERIES_MARK_DELIVERED`
- `DELIVERIES_MARK_NOT_DELIVERED`
- `DELIVERIES_CANCEL`
- `DELIVERIES_REPORTS`

Resultado:

- PASS parcial
- `USER` permitio lectura/creacion y bloqueo de `assign` y `reports`.
- `ADMIN` permitio el flujo operativo completo.

## Evidencia de no impacto

- Caja tocada: `NO`
- Movimientos financieros creados: `NO`
- Facturacion electronica tocada: `NO`
- Totales/impuestos modificados: `NO`
- POS tocado: `NO`
- Frontend tocado: `NO`

## Verificaciones de DB

Antes del smoke:

- `deliveries`: 6
- `delivery_status_history`: 14
- `cash_sessions`: 40
- `cash_movements`: 204
- `pos_user_sessions`: 227
- `sales`: 102

Despues del smoke:

- `deliveries`: 10
- `delivery_status_history`: 25
- `cash_sessions`: 40
- `cash_movements`: 204
- `pos_user_sessions`: 227
- `sales`: 102

Resultado:

- PASS
- No cambiaron caja, POS ni ventas.
- Se agregaron 4 domicilios y 11 eventos de historial.

## Historial validado

- `CREATED`
- `ASSIGNED`
- `DISPATCHED`
- `DELIVERED`
- `NOT_DELIVERED`
- `CANCELLED`

## Problemas encontrados

- La instancia inicial en `4020` no correspondia al codigo actual del change.
- Se levanto una API local nueva en `4062` para el smoke.

## Comandos ejecutados

```text
$env:PGPASSWORD='root'; psql -h localhost -p 5432 -U postgres -d manus_tienda_prd ...
npm.cmd run start:dev
Invoke-WebRequest /api/auth/login/force
node %TEMP%/domicilios-smoke-http.cjs
```

## Confirmaciones

- Produccion tocada: NO
- Frontend tocado: NO
- Caja tocada: NO
- Movimientos financieros creados: NO
- Facturacion electronica tocada: NO
- Totales/impuestos de factura modificados: NO
- POS tocado: NO
- SQL productivo aplicado: NO
- Permisos productivos aplicados: NO
- Commit realizado: NO
