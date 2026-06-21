# Evidencia QA - Domicilios desde pedidos y ventas

Fecha: 2026-06-21

## Alcance

- Rama: `feat/0.0.1/frontend-domicilios-menu`
- HEAD inicial de fase: `708ce71 feat(deliveries): add frontend deliveries screen and menu`
- Tenant de prueba sugerido: `00000000-0000-0000-0000-000000000001`
- Rutas objetivo:
  - `/{tenant}/orders`
  - `/{tenant}/reporteria/pos`
  - `/{tenant}/deliveries?order_id={orderId}`
  - `/{tenant}/deliveries?sale_id={saleId}`

## Implementado

- Pedidos: accion `Domicilio` en el listado, con consulta por `GET /api/orders/:id/delivery`.
- Pedidos: creacion por `POST /api/orders/:id/delivery` desde panel contextual.
- Ventas: accion `Domicilio` en la tabla de reporteria de ventas POS, con consulta por `GET /api/sales/:id/delivery`.
- Ventas: creacion por `POST /api/sales/:id/delivery` desde panel contextual.
- Domicilios: links filtrados hacia `/{tenant}/deliveries?order_id=...` y `/{tenant}/deliveries?sale_id=...`.
- Domicilios: pantalla principal inicializa filtros desde `order_id` y `sale_id`.
- Componente reutilizable: `DeliveryRelationCard`.

## Resultados esperados por UI

- Si existe domicilio asociado:
  - Muestra estado, contacto, direccion, valor informativo y fuente financiera si aplica.
  - Permite `Ver domicilio`.
  - Permite `Abrir en Domicilios` con filtro contextual.
- Si no existe domicilio asociado:
  - Muestra estado vacio claro.
  - Permite `Crear domicilio` solo si hay permiso `DELIVERIES_CREATE`.
  - Muestra error backend si falla o si backend responde duplicado/403.

## Validaciones automaticas

- `cd web && npx.cmd tsx --test modules\deliveries\**\*.spec.ts`: OK, 12 tests.
- Pendiente final de fase:
  - `openspec.cmd validate implementar-frontend-domicilios-menu --type change --strict`
  - `openspec.cmd validate --all --strict`
  - `cd web && npm.cmd run lint`
  - `cd web && npm.cmd run build`
  - `git diff --check`

## QA manual local

- Frontend dev server detectado en `http://localhost:3030`.
- Smoke HTTP `GET /00000000-0000-0000-0000-000000000001/orders`: `200 OK`.
- Smoke HTTP `GET /00000000-0000-0000-0000-000000000001/reporteria/pos`: `200 OK`.
- Smoke HTTP `GET /00000000-0000-0000-0000-000000000001/deliveries?order_id=qa-order`: `200 OK`.
- Smoke HTTP `GET /00000000-0000-0000-0000-000000000001/deliveries?sale_id=qa-sale`: `200 OK`.
- In-app Browser: no se pudo completar QA visual por falla del runtime del browser tool (`windows sandbox failed: spawn setup refresh`). Se uso HTTP smoke como fallback.

Pendiente con backend, datos locales y navegador visual:

- Abrir `http://localhost:3030/00000000-0000-0000-0000-000000000001/orders`.
- En un pedido, abrir `Domicilio`.
- Validar pedido sin domicilio.
- Crear domicilio desde pedido con direccion minima.
- Validar pedido con domicilio.
- Abrir modulo Domicilios filtrado por `order_id`.
- Abrir `http://localhost:3030/00000000-0000-0000-0000-000000000001/reporteria/pos`.
- En una venta, abrir `Domicilio`.
- Validar venta sin domicilio.
- Crear domicilio desde venta con fuente `NO_FEE` o `INVOICE_INCLUDED`.
- Validar venta con domicilio.
- Abrir modulo Domicilios filtrado por `sale_id`.
- Validar duplicado controlado por backend.
- Validar usuario sin permisos o respuesta 403.
- Validar vista movil sin overflow horizontal.

## Limites y pendientes

- No existe ruta dedicada `/{tenant}/sales`; la integracion de ventas se ubico en reporteria de ventas POS disponible actualmente.
- No se modifica `web/modules/pos` ni `web/app/[tenant]/pos`.
- Los datos minimos de direccion/contacto dependen de lo que backend pueda resolver desde pedido o venta.
- La seleccion real de repartidores sigue pendiente.

## Exclusiones confirmadas

- Caja tocada: NO.
- Movimientos financieros creados: NO.
- POS tocado: NO.
- Facturacion electronica tocada: NO.
- Totales/impuestos modificados: NO.
- Backend tocado: NO.
- SQL tocado: NO.
- Produccion tocada: NO.
