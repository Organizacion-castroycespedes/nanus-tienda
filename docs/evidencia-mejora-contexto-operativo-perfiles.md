# Evidencia mejora contexto operativo perfiles

## 1. Resumen

Estado: PASS CON OBSERVACIONES.

Re-QA final ejecutado en local/QA el 2026-06-12. Se aplico el SQL idempotente, se valido login local por rol con requests controlados, contexto operativo, scope por sucursal/tenant, terminal POS, caja, pedidos, clientes, roles asignables, inventario y menu por perfil.

Observacion: el Browser plugin no estuvo disponible para click manual visual. Falla tecnica del conector: `windows sandbox failed: spawn setup refresh`. La validacion frontend se cubrio con API de menu/rutas y backend real.

## 2. Change OpenSpec

- Change: `mejora-contexto-operativo-perfiles`
- Specs:
  - `operational-context`
  - `profile-permissions`
  - `pos-terminal-context`

## 3. Ambiente QA

| Recurso | Valor |
| --- | --- |
| Base de datos | local/QA `localhost:5432/manus_tienda_prd`, sin credenciales |
| API | `http://localhost:4020/api` |
| Web | `http://localhost:3000` |
| SQL aplicado | `scripts/database/security/20260612_1930_mejora_perfiles_contexto_operativo.sql` |
| Produccion tocada | NO |

## 4. SQL aplicado

| Script | Primera ejecucion | Segunda ejecucion | Idempotente |
| --- | --- | --- | --- |
| `scripts/database/security/20260612_1930_mejora_perfiles_contexto_operativo.sql` | PASS: `BEGIN`, `INSERT 0 0`, `INSERT 0 31`, `DELETE 0`, `COMMIT` | PASS: `BEGIN`, `INSERT 0 0`, `INSERT 0 31`, `DELETE 0`, `COMMIT` | SI |

Validacion de permisos esperados: PASS. La consulta de faltantes devolvio `0 filas`.

## 5. Usuarios QA

| Rol | Usuario/email | Tenant | Sucursal(es) | Terminales | Estado |
| --- | --- | --- | --- | --- | --- |
| `USER` | `user+default@manustienda.local` | `Tenant Principal` | `Sucursal Principal` | `Terminal 1` | PASS |
| `ADMIN` | `admin+default@manustienda.local` | `Tenant Principal` | `Sucursal Principal` | `Terminal 1` | PASS |
| `SUPER_USER` | `super.user+default@manustienda.local` | `Tenant Principal` | `Adelita de Char`, `Sucursal Principal` | `Terminal 1 Adelita`, `Terminal 2 Adelita`, `Terminal 1` | PASS |
| `SUPER_ADMIN` | `icastror@hotmail.com` | Global | Global | Global | NO APLICA en login local sin credencial QA documentable |

## 6. Flujo post-login

| Rol | Tenant | Sucursal | Terminal | POS protegido | Estado |
| --- | --- | --- | --- | --- | --- |
| `USER` | resuelto automaticamente | 1 asignada | solo de su sucursal | branch ajena `403` | PASS |
| `ADMIN` | resuelto automaticamente | 1 asignada | solo de su sucursal | branch ajena `403` | PASS |
| `SUPER_USER` | resuelto automaticamente | 2 del tenant | terminales del tenant | tenant ajeno `403` | PASS |
| `SUPER_ADMIN` | global | global | global | no validado con login local | NO APLICA |

## 7. Permisos por rol

| Rol | Modulo | Accion | Esperado | Real | Estado |
| --- | --- | --- | --- | --- | --- |
| `USER` | POS | crear sesion branch asignada | `201` | `201` | PASS |
| `USER` | POS | crear sesion branch ajena | `403` | `403` | PASS |
| `USER` | Caja | abrir/cerrar caja asignada | `201/201` | `201/201` | PASS |
| `USER` | Caja | abrir caja branch ajena | `403` | `403` | PASS |
| `USER` | Pedidos | crear/listar/editar branch asignada | `201/200/200` | `201/200/200` | PASS |
| `USER` | Pedidos | crear/editar branch ajena | `403/403` | `403/403` | PASS |
| `USER` | Clientes FE | crear/editar fiscal | `201/200` | `201/200` | PASS |
| `ADMIN` | POS | crear sesion branch asignada | `201` | `201` | PASS |
| `ADMIN` | POS | crear sesion branch ajena | `403` | `403` | PASS |
| `ADMIN` | Caja | abrir/cerrar caja asignada | `201/201` | `201/201` | PASS |
| `ADMIN` | Caja | abrir caja branch ajena | `403` | `403` | PASS |
| `ADMIN` | Clientes FE | crear/editar fiscal | `201/200` | `201/200` | PASS |
| `ADMIN` | Inventario | ver productos/compras/unidades/impuestos/proveedores/promociones | `200` | `200` | PASS |
| `SUPER_USER` | POS | crear sesion en branch del tenant | `201` | `201` | PASS |
| `SUPER_USER` | Roles | listar asignables | `200` | `200`, solo `ADMIN`, `USER` | PASS |
| `SUPER_USER` | Roles | crear rol global | `403` | `403` | PASS |
| `SUPER_USER` | Clientes FE | listar/crear/editar | `200/201/200` | `200/201/200` | PASS |
| `SUPER_USER` | Inventario | ver productos/compras/unidades/impuestos/proveedores/promociones | `200` | `200` | PASS |
| `SUPER_USER` | Tenant ajeno | terminal/contexto ajeno | `403` | `403` | PASS |

## 8. Rutas directas frontend

Validacion real por menu API y guards/backend. Validacion visual con Browser: NO EJECUTADA por falla del conector local.

| Rol | Ruta | Esperado | Real | Estado |
| --- | --- | --- | --- | --- |
| `USER` | `/:tenantId/pos` | requiere contexto POS | protegido por `x-pos-session-id` y menu permitido | PASS |
| `USER` | `/:tenantId/pos/select-context` | sesion valida requerida | contexto API solo devuelve su branch/terminal | PASS |
| `USER` | `/:tenantId/orders` | permitido | presente en menu | PASS |
| `USER` | `/:tenantId/customers` | permitido | presente en menu | PASS |
| `USER` | `/:tenantId/inventory/products` | permitido lectura | presente en menu | PASS |
| `USER` | `/:tenantId/inventory/purchases` | permitido lectura | presente en menu | PASS |
| `USER` | `/:tenantId/inventory/suppliers` | no permitido | ausente en menu | PASS |
| `USER` | `/:tenantId/admin/peripherals` | no permitido | ausente en menu | PASS |
| `USER` | `/:tenantId/configuracion` | no permitido | ausente en menu | PASS |
| `USER` | `/:tenantId/users` | no permitido | ausente en menu | PASS |
| `ADMIN` | `/:tenantId/pos` | requiere contexto POS | protegido por `x-pos-session-id` y menu permitido | PASS |
| `ADMIN` | `/:tenantId/orders` | permitido | presente en menu | PASS |
| `ADMIN` | `/:tenantId/customers` | permitido | presente en menu | PASS |
| `ADMIN` | `/:tenantId/inventory/products` | permitido lectura | presente en menu | PASS |
| `ADMIN` | `/:tenantId/inventory/purchases` | permitido lectura | presente en menu | PASS |
| `ADMIN` | `/:tenantId/inventory/suppliers` | permitido lectura | presente en menu | PASS |
| `ADMIN` | `/:tenantId/admin/peripherals` | no permitido | ausente en menu | PASS |
| `ADMIN` | `/:tenantId/configuracion` | no permitido | ausente en menu | PASS |
| `ADMIN` | `/:tenantId/users` | no permitido | ausente en menu | PASS |
| `SUPER_USER` | `/:tenantId/users` | permitido | `/usuarios` presente en menu | PASS |
| `SUPER_USER` | `/:tenantId/admin/peripherals` | permitido por matriz actual | presente en menu | PASS |
| `SUPER_USER` | `/:tenantId/configuracion` | permitido por matriz actual | presente en menu | PASS |

## 9. Requests backend

| Rol | Endpoint | Esperado | Real | Estado |
| --- | --- | --- | --- | --- |
| `USER` | `POST /api/orders` branch asignada | `201` | `201` | PASS |
| `USER` | `POST /api/orders` branch ajena | `403` | `403` | PASS |
| `USER` | `PUT /api/orders/:id` branch asignada | `200` | `200` | PASS |
| `USER` | `PUT /api/orders/:id` branch ajena | `403` | `403` | PASS |
| `USER` | `PATCH /api/electronic-invoicing/customers/:id` | `200` | `200` | PASS |
| `USER` | `POST /api/finance/cash-sessions/open` | `201` | `201` | PASS |
| `USER` | `POST /api/finance/cash-sessions/:id/close` | `201` | `201` | PASS |
| `ADMIN` | `PATCH /api/electronic-invoicing/customers/:id` | `200` | `200` | PASS |
| `ADMIN` | `POST /api/finance/cash-sessions/open` | `201` | `201` | PASS |
| `ADMIN` | `POST /api/finance/cash-sessions/:id/close` | `201` | `201` | PASS |
| `SUPER_USER` | `GET /api/roles` | `200` | `200` | PASS |
| `SUPER_USER` | `POST /api/roles` | `403` | `403` | PASS |
| `SUPER_USER` | `GET /api/electronic-invoicing/customers` | `200` | `200` | PASS |
| `SUPER_USER` | `POST/PATCH /api/electronic-invoicing/customers` | `201/200` | `201/200` | PASS |
| `SUPER_USER` | `GET /api/pos-terminals/resolve-current?tenantId=tenant_ajeno` | `403` | `403` | PASS |

## 10. Hallazgo corregido en re-QA

Durante re-QA aparecio un bug bloqueante de caja: apertura con `openingAmount: 0` devolvia `500` porque `OpenCashSessionDto` permite cero, pero el servicio insertaba un movimiento de caja de monto cero y la DB lo rechazaba por `cash_movements_amount_check`.

Correccion aplicada:

- `api/src/modules/finance/cash-sessions/cash-sessions.service.ts`: no inserta movimiento `OPENING` cuando `openingAmount` es `0`.
- `api/src/modules/finance/cash-sessions/cash-sessions.service.spec.ts`: test agregado para apertura con monto cero.

Resultado posterior: `USER` y `ADMIN` abren/cerran caja con `openingAmount: 0` en `201/201`.

## 11. Tests ejecutados

| Validacion | Resultado |
| --- | --- |
| `openspec.cmd validate mejora-contexto-operativo-perfiles --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 13 passed, 0 failed |
| `git diff --check` | PASS, solo warnings CRLF/LF |
| `cd api && npm run build` | PASS |
| `cd api && npx.cmd tsx --test src/**/*.spec.ts` | PASS, 402 passed, 1 skipped |
| `cd web && npm run lint` | PASS, warnings existentes |
| `cd web && npm run build` | PASS, warnings existentes |
| Backend requests controlados local/QA | PASS, `48/48` |
| SQL idempotente | PASS |
| Permisos esperados DB | PASS, `0 filas` faltantes |

## 12. Warnings no bloqueantes

- Browser plugin no disponible para click visual: `windows sandbox failed: spawn setup refresh`.
- Warnings ESLint existentes de `react-hooks/exhaustive-deps` e `img` en varias paginas.
- Warning Browserslist: `caniuse-lite` esta desactualizado.
- Warnings Git CRLF/LF esperados al inspeccionar diff.

## 13. Riesgos pendientes

- SUPER_ADMIN no fue validado con login local porque no se documentan credenciales y no hubo usuario QA global utilizable en la evidencia.
- Validacion visual click-by-click queda pendiente por falla del Browser plugin; cobertura funcional se hizo con menu API, guards y requests backend reales.
- Produccion no fue tocada.

## 14. Estado final

PASS CON OBSERVACIONES.

Recomendacion: ejecutar validaciones finales completas. Si pasan, el change queda listo para archive con la observacion del Browser plugin y SUPER_ADMIN local.
