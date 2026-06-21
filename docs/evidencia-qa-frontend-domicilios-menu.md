# Evidencia QA - Frontend Domicilios + menu

Fecha: 2026-06-21

## Alcance

- Ruta objetivo: `/{tenant}/deliveries`
- Tenant de prueba sugerido: `00000000-0000-0000-0000-000000000001`
- Rama: `feat/0.0.1/frontend-domicilios-menu`
- Backend esperado: endpoints `/api/deliveries`, acciones de estado y wrappers de orders/sales ya integrados en `develop`.

## Patrones reutilizados

- Rutas tenant bajo `web/app/[tenant]/...`.
- Servicios frontend con `apiClient` desde `web/lib/http.ts`.
- Permisos frontend con `MENU_KEYS`, `/me/permissions` y `route-permissions`.
- Componentes `Button`, `Input`, `Select`, `Textarea`, `Modal` y `Toast`.
- Listado con filtros, loading, error, estado vacio y paginacion como pedidos/clientes/inventario.
- Acciones por estado con confirmacion/modal, refresco posterior y mensaje visible.

## Resultados implementados

- Listado de domicilios con datos operativos disponibles.
- Filtros backend reales: `status`, `order_id`, `sale_id`, `date_from`, `date_to`, `page`, `limit`.
- Busqueda local por contacto, telefono, direccion y campos visibles de la pagina cargada.
- Detalle operativo con `GET /api/deliveries/:id`.
- Creacion manual basica con `POST /api/deliveries`.
- Acciones por estado:
  - `CREATED`: asignar, cancelar.
  - `ASSIGNED`: despachar, cancelar.
  - `DISPATCHED`: marcar entregado, marcar no entregado.
  - Finales: sin acciones operativas.
- Menu/ruta protegida con `MENU_KEYS.DELIVERIES`.
- Vista movil con tarjetas y filtros apilados.

## Validaciones automaticas

- `openspec.cmd validate implementar-frontend-domicilios-menu --type change --strict`: OK.
- `cd web && npx.cmd tsx --test modules\deliveries\**\*.spec.ts`: OK, 6 tests.
- `cd web && npx.cmd tsx --test lib\route-permissions.spec.ts modules\deliveries\**\*.spec.ts`: OK, 13 tests.
- `cd web && npm.cmd run lint`: OK con warnings preexistentes.
- `cd web && npm.cmd run build`: OK con warnings preexistentes.

## QA manual local

- Frontend dev server: `http://localhost:3030`.
- Smoke HTTP: `GET http://localhost:3030/00000000-0000-0000-0000-000000000001/deliveries` respondio `200 OK`.
- Smoke HTTP: `GET http://localhost:3030/` respondio `200 OK`.
- In-app Browser: no se pudo completar screenshot/DOM por falla de runtime del browser tool (`node_repl` no inicio en esta sesion). Se uso HTTP smoke como fallback.

Pendiente con navegador visual y usuario real:

- Abrir `http://localhost:3030/00000000-0000-0000-0000-000000000001/deliveries`.
- Verificar redireccion/login si no hay sesion.
- Con usuario autorizado, validar carga inicial, filtros, detalle y acciones contra backend local con datos.
- Con usuario sin permiso, validar bloqueo por permisos.
- Validar mobile/responsive sin overflow global.
- QA manual visual completo queda pendiente post-merge a `develop`.

## Pendientes

- El backend no soporta busqueda textual global; la busqueda actual es local sobre la pagina cargada.
- El backend no devuelve historial `delivery_status_history` en detalle; se muestra nota pendiente.
- No hay selector de repartidores; asignar usa input `assigned_courier_id`.
- La entrada visible del sidebar depende de que `/me/menu` devuelva `DELIVERIES`; no se modifico SQL ni seed.
- Integracion visual desde pedidos y ventas continua en `docs/evidencia-qa-frontend-domicilios-pedidos-ventas.md`.

## Exclusiones confirmadas

- Caja tocada: NO.
- Movimientos financieros creados: NO.
- POS tocado: NO.
- Facturacion electronica tocada: NO.
- Backend tocado: NO.
- SQL tocado: NO.
- Produccion tocada: NO.
