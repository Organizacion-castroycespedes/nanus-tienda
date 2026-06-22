# Evidencia QA - Repartidores y Domicilios

Fecha: 2026-06-22

## Alcance validado

- Se agrego migracion aditiva `scripts/database/migrations/V066__delivery_drivers.sql`.
- Se agrego tabla `delivery_drivers`.
- Se agrego columna nullable `deliveries.driver_id`.
- Se agregaron endpoints:
  - `GET /api/delivery-drivers`
  - `POST /api/delivery-drivers`
  - `GET /api/delivery-drivers/:id`
  - `PATCH /api/delivery-drivers/:id`
  - `PATCH /api/delivery-drivers/:id/deactivate`
  - `POST /api/deliveries/:id/assign-driver`
- La asignacion de repartidor no cambia estado del domicilio.
- La asignacion permite `driver_id: null` para quitar repartidor.
- La lista de domicilios soporta filtro `driver_id`.
- La UI agrega ruta `/{tenant}/deliveries/drivers`.
- La UI agrega boton `Repartidores` en Domicilios.

## Casos cubiertos por pruebas

- Crear repartidor activo por defecto.
- Editar repartidor.
- Desactivar repartidor.
- Aislamiento por tenant en repartidores.
- Rechazo de payload vacio al editar repartidor.
- Asignar repartidor activo a domicilio.
- Quitar repartidor de domicilio.
- Rechazar repartidor inactivo.
- Rechazar repartidor de otro tenant o inexistente.
- Confirmar que asignar/quitar repartidor no cambia estado.
- Filtrar domicilios por `driver_id`.
- Mapear resumen del repartidor en lista.
- Helpers frontend de filtros y query string con `driver_id`.
- Helper frontend de busqueda local incluye repartidor.

## Validaciones ejecutadas

- `openspec.cmd validate gestionar-repartidores-domicilios --type change --strict`: OK.
- `openspec.cmd validate --all --strict`: OK, 55 items passed.
- `cd api && npx.cmd tsx --test src/modules/deliveries/delivery-drivers.service.spec.ts src/modules/deliveries/deliveries.service.spec.ts`: OK, 27 tests passed.
- `cd api && npm.cmd run build`: OK.
- Fix posterior por DB local sin `public.delivery_drivers`: OK, lista de domicilios usa fallback sin join y lista de repartidores devuelve `[]` hasta ejecutar `V066`.
- Revalidacion posterior del fix con focused tests API: OK, 29 tests passed.
- Revalidacion posterior del fix con `cd api && npm.cmd run build`: OK.
- `cd web && npx.cmd tsx --test modules/deliveries/delivery-navigation.spec.ts modules/deliveries/services/deliveries.service.spec.ts modules/deliveries/services/delivery-drivers.service.spec.ts modules/deliveries/delivery-helpers.spec.ts`: OK, 15 tests passed.
- `cd web && npm.cmd run lint`: OK con warnings existentes de hooks e `<img>`.
- `cd web && npm.cmd run build`: OK con warnings existentes y aviso Browserslist/caniuse-lite stale.
- `git diff --check`: OK, con advertencias CRLF de Git en archivos modificados.

## Comprobaciones de no alcance

- Caja/recaudo: no se modificaron servicios ni tablas.
- Pagos: no se modificaron reglas ni payloads de pagos.
- POS: no se modifico flujo POS.
- Facturacion fiscal/electronica: no se modificaron modulos ni estados.
- Inventario: no se modificaron movimientos ni stock.
- Rutas/geolocalizacion: no implementado.
- SQL destructivo: no se agrego `DROP`, `TRUNCATE`, `DELETE` ni updates de datos historicos.

## QA manual pendiente

- Crear repartidor.
- Editar repartidor.
- Desactivar repartidor.
- Crear o usar domicilio existente.
- Asignar repartidor activo.
- Confirmar repartidor en listado.
- Confirmar repartidor en detalle.
- Filtrar por repartidor.
- Confirmar que repartidor inactivo no aparece en selector de asignacion o backend lo rechaza.
- Confirmar que estado de domicilio no cambia por asignacion.
- Confirmar caja/POS/facturacion/pagos no cambian.
