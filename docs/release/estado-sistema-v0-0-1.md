# Estado del sistema v0.0.1

Proyecto: Manus POS / Tienda Castro & Cespedes  
Version objetivo: `0.0.1`  
Fecha de corte documental: 2026-06-18  
OpenSpec change: `cerrar-version-inicial-0-0-1`

## Resumen ejecutivo

Manus POS queda en estado `FUNCIONAL_CON_OBSERVACIONES` para sellar `v0.0.1`. El core operativo esta avanzado: POS, pedidos, caja, inventario, compras, clientes, proveedores, pricing/promociones, impuestos, reportes, roles/permisos y multitenant/configuracion.

No quedan P0/P1 operativos reportados en la evidencia QA integral `MVP-01.3X`. Quedan pendientes relevantes fuera del corte: hardware fisico, DIAN real/facturacion electronica real, Electron, Capacitor, CRM completo y dashboard/home de producto.

Este change no toca codigo runtime, SQL, permisos, API contracts ni produccion.

## Discovery inicial

| Item | Resultado |
| --- | --- |
| Rama | `release/evolutivo/0.0.1` |
| HEAD inicial | `9c6199b` |
| `git status --short` | Limpio al inicio |
| `openspec.cmd validate --all --strict` | PASS: 24 passed, 0 failed |
| Root `package.json` | No existe |
| API package | `api/package.json`, version `0.1.0` |
| Web package | `web/package.json`, version `0.1.0` |
| Reporteria package | `backend-reporteria/package.json`, version `0.1.0` |
| Perifericos package | `backend-perifericos/package.json`, version `0.1.0` |
| Facturacion electronica package | `backend-facturacion-electronica/package.json`, version `0.1.0` |

Nota Windows: `openspec validate --all --strict` via PowerShell intento cargar `openspec.ps1` y fallo por `ExecutionPolicy`. Se valido con `openspec.cmd`.

## Changes activos detectados

Este change queda separado. No modifica ni completa estos changes activos:

| Change | Estado observado |
| --- | --- |
| `pos-visual-operability-redesign` | 61/78 tasks |
| `fortalecer-productos-inventario` | 1292/1363 tasks |
| `mejorar-ux-branding-menu-multitenant` | Complete |
| `mvp-web-hardening` | 654/797 tasks |
| `mejoras-funcionales-operativas-caja-roles-menu` | Complete |
| `mejorar-responsive-recepcion-compras` | Complete |
| `mejorar-recepcion-parcial-compras-pendientes` | Complete |
| `mejora-contexto-operativo-perfiles` | Complete |
| `gestion-operativa-turno-caja-actual` | 34/36 tasks |
| `fix-peripherals-public-endpoint` | Complete |
| `fix-cash-session-close-negative-expected` | Complete |
| `dian-terceros-clientes-proveedores-fe-3` | 349/363 tasks |
| `clarificar-descuento-pos-balanza-carrito` | Complete |
| `ajustes-operativos-cierre-caja-permisos` | 34/35 tasks |
| `ajustar-permisos-operativos-clientes-pedidos-pos-inventario` | Complete |
| `add-pos-peripherals-platform` | 427/512 tasks |
| `add-electronic-invoicing-customer-backend` | 421/451 tasks |

## Modulos backend detectados

`api/src/modules` contiene:

- `auth`
- `branches`
- `electronic-invoicing`
- `finance`
- `inventory`
- `locations`
- `menu`
- `permissions`
- `pos-terminals`
- `pos-user-sessions`
- `pricing`
- `roles`
- `system`
- `tenants`
- `terminals`
- `users`

Servicios complementarios detectados:

- `backend-reporteria`: auth, database, pdf, reports.
- `backend-perifericos`: devices, printer, scale, scanner, cash-drawer, logs, health, mock adapters, network ESC/POS adapter desactivado por defecto.
- `backend-facturacion-electronica`: fiscal lookup, DIAN provider skeleton, certificates, sync, webhooks, mock provider.

## Modulos frontend detectados

`web/modules` contiene:

- `electronic-invoicing`
- `finance`
- `inventory`
- `pos`
- `pricing`
- `reporteria`
- `shared`
- `terminals`

`web/domains` contiene:

- `auth`
- `branches`
- `locations`
- `menu`
- `peripherals`
- `pos`
- `products`
- `roles`
- `system`
- `tenants`
- `users`

Rutas principales detectadas:

- `/{tenant}/dashboard`
- `/{tenant}/pos`
- `/{tenant}/pos/select-context`
- `/{tenant}/orders`
- `/{tenant}/purchases`
- `/{tenant}/customers`
- `/{tenant}/suppliers`
- `/{tenant}/inventory/*`
- `/{tenant}/finance/*`
- `/{tenant}/reporteria/*`
- `/{tenant}/configuracion`
- `/{tenant}/configuracion/menu`
- `/{tenant}/config/terminals`
- `/{tenant}/admin/peripherals`
- `/{tenant}/roles`
- `/{tenant}/usuarios`

## Estado por modulo

| Modulo | Estado v0.0.1 | Evidencia principal | Observacion |
| --- | --- | --- | --- |
| POS | `FUNCIONAL_CON_OBSERVACIONES` | QA operativo E2E, POS pricing, perifericos MOCK | Venta directa, sesion POS, pagos, caja y pricing funcionan; hardware real fuera. |
| Pedidos / Orders | `FUNCIONAL_CON_OBSERVACIONES` | QA operativo E2E, pricing snapshot | Pedido, entrega, confirmacion e invoice funcionan; revisar UX y casos borde post-release. |
| Caja / Finanzas operativas | `FUNCIONAL_CON_OBSERVACIONES` | QA operativo E2E, cash sessions tests | Apertura/cierre, movimientos y pagos funcionan; conciliacion avanzada queda roadmap. |
| Inventario | `FUNCIONAL_CON_OBSERVACIONES` | Specs inventario, QA productos/lotes | Productos, lotes, ubicaciones, FEFO y dashboard operativo existen; consolidacion completa sigue activa. |
| Compras / Recepcion | `FUNCIONAL_CON_OBSERVACIONES` | QA operativo E2E, recepcion parcial docs | Compra, recepcion parcial/total, pagos y liquidacion parcial validados. |
| Clientes | `FUNCIONAL_CON_OBSERVACIONES` | QA permisos, FE mock customers | CRUD y fiscal mock funcionan; DIAN real no. |
| Proveedores | `FUNCIONAL_CON_OBSERVACIONES` | FE mock suppliers, inventory suppliers | CRUD/base fiscal mock existe; fuente fiscal real de suppliers pendiente. |
| Promociones / Pricing | `FUNCIONAL_CON_OBSERVACIONES` | Release readiness fase 6.10 | Pricing backend como verdad; promociones CRUD/listado; fixture QA de promocion activa no siempre presente. |
| Impuestos | `FUNCIONAL_CON_OBSERVACIONES` | QA operativo E2E | Impuestos se cargan y participan en POS/pricing; catalogos fiscales finales pendientes. |
| Reportes | `FUNCIONAL_CON_OBSERVACIONES` | QA E2E `MVP-01.3X` | Reportes POS, compras, caja, pedidos y clientes devuelven JSON/PDF; servicio separado. |
| Seguridad, roles y permisos | `FUNCIONAL_CON_OBSERVACIONES` | Auditoria RBAC, QA permisos | Roles base y guards operativos; riesgo de drift por seeds/migraciones. |
| Multitenant / Branding / Configuracion | `FUNCIONAL_CON_OBSERVACIONES` | Branding/menu multitenant, route permissions | Tenant-aware y branding avanzado; home/dashboard producto no cerrado. |
| Capacitor | `PENDIENTE` | POS visual change | Layout mobile considerado, pero safe area y build nativo no validados. |
| Electron | `PENDIENTE` | POS visual/perifericos docs | No implementado ni empaquetado. |
| Perifericos fisicos | `BLOQUEADO_EXTERNO` | Fase 12 perifericos | MOCK funciona; hardware real, drivers y adapters reales no activados. |
| Facturacion electronica | `BLOQUEADO_EXTERNO` | FE-3.8 readiness | Mock fiscal avanzado; DIAN real bloqueado por certificados, WSDL, habilitacion y SCA. |
| CRM | `PARCIAL` | Customers y migration CRM customers | Clientes existen; CRM como modulo comercial completo no esta cerrado. |
| Home / Dashboard / UX producto | `PARCIAL` | Dashboard route, inventory dashboard | Dashboard existe; home/product UX completo queda post-v0.0.1. |

## Scripts relevantes

| Area | Scripts |
| --- | --- |
| API | `npm run start:dev`, `npm run build`, `npm run start`, `npm run build:bin`; tests con `npx tsx --test "src/**/*.spec.ts"` |
| Web | `npm run dev`, `npm run build`, `npm run start`, `npm run lint` |
| Reporteria | `npm run start:dev`, `npm run build`, `npm run start`, `npm run build:bin` |
| Perifericos | `npm run start:dev`, `npm run build`, `npm run build:bin`, `npm test` |
| Facturacion electronica | `npm run start:dev`, `npm run build`, `npm run build:bin`, `npm test` |
| DB/Ops | `scripts/database/migrate.sh`, `seed.sh`, `backup.sh`, `rollback.sh`, `scripts/ssh/deploy-db.sh`, `scripts/build/build-all-backends.sh` |

## Decision de corte

Recomendacion: sellar `v0.0.1` como primera version funcional con observaciones. Congelar alcance. Hacer siguiente fase como hardening post-release, no como parte del corte inicial.
