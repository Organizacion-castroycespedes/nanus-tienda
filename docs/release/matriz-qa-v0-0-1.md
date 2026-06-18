# Matriz QA v0.0.1

## Estado general

Estado QA recomendado para `v0.0.1`: `FUNCIONAL_CON_OBSERVACIONES`.

Evidencia fuerte existente:

- `docs/evidencia-qa-operativo-integral-end-to-end-mvp-01-3x.md`: `QA_OPERATIVO_END_TO_END_READY`, 52/52 checks base, 15/15 confirmaciones finales, 0 P0/P1/P2 fallidos.
- `docs/evidencia-qa-permisos-operativos-clientes-pedidos-pos-inventario.md`: permisos operativos por rol validados para Clientes, Pedidos, POS, Inventario, Finanzas, Terminales y Roles.
- `docs/evidencia-qa-configuracion-terminal-perifericos-fase-12.md`: configuracion terminal y perifericos MOCK documentados.
- `docs/release-readiness-pricing-promociones-pos-orders-fase-6-10.md`: pricing/promociones/POS/Orders listo para predeploy controlado.
- `docs/release-readiness-dian-terceros-clientes-proveedores-fe-3-8.md`: FE mock listo; DIAN real no listo.
- `docs/evidencia-qa-release-mock-fiscal-fe-3-12.md`: flujo fiscal mock local con customers, suppliers y POS.

## Matriz por modulo

| Modulo | Estado QA | Evidencia | Observacion |
| --- | --- | --- | --- |
| Web shell / tenant routes | PASS historico | Web QA HTTP 200 en evidencia MVP-01.3X | Requiere smoke visual final si cambia UI. |
| Auth / session | PASS historico | Login force, `/auth/me`, `/auth/context` | No documentar tokens. |
| Menu / RBAC | PASS historico | `/auth/menu`, auditoria RBAC | Riesgo de drift si seeds faltan. |
| POS session | PASS historico | `POST /api/pos/session` | Mock terminal validado. |
| POS venta directa | PASS historico | `POST /api/sales`, venta confirmada pagada | Hardware real fuera. |
| Orders | PASS historico | Create/confirm/deliver/invoice | Casos borde quedan post-release. |
| Compras | PASS historico | Total, parcial, settle partial | Reportes confirmados. |
| Caja | PASS historico | Open, movements, summary, close | Conciliacion avanzada post-release. |
| Finanzas pagos | PASS historico | `POST /api/finance/payments` | Scope por rol documentado. |
| Productos | PASS historico | `GET /api/products` | Admin inventory bloqueado para USER. |
| Lotes / balances | PASS historico | `/inventory/lot-balances` | FEFO/lotes validados en flujos. |
| Clientes | PASS historico | CRUD y FE mock | Delete restringido para USER. |
| Proveedores | PASS historico/parcial | FE mock suppliers | Suppliers no usan GetAcquirer real. |
| Impuestos | PASS historico | `GET /api/taxes` | Catalogo fiscal final pendiente. |
| Pricing preview | PASS historico | `POST /api/pricing/preview-line` | Backend es fuente de verdad. |
| Promociones | PASS/WARN | Endpoint PASS con `count=0` en QA integral | Crear fixture activa si se exige validar descuento aplicado. |
| Reporteria POS | PASS historico | `/api/reports/pos-sales`, PDF ticket | Confirmado despues de V061. |
| Reporteria compras | PASS historico | `/api/reports/purchases`, PDF ticket | Confirmado. |
| Reporteria caja | PASS historico | `/api/reports/cash-closings`, PDF ticket | Confirmado. |
| Perifericos MOCK | PASS historico | Agent/mock fallback y terminal settings | Hardware real no probado. |
| Facturacion electronica mock | PASS historico | Customers/suppliers lookup mock | DIAN real bloqueado. |
| Electron | NOT_RUN | No implementado | Fuera de v0.0.1. |
| Capacitor | NOT_RUN | No implementado | Fuera de v0.0.1. |
| CRM | PARTIAL | Customers operativos | CRM comercial no cerrado. |
| Dashboard/home | PARTIAL | Dashboard route e inventory dashboard | Home producto queda roadmap. |

## Validaciones de este change

Estas validaciones deben reportarse al cierre del trabajo:

| Comando | Aplicabilidad | Resultado |
| --- | --- | --- |
| `openspec.cmd validate cerrar-version-inicial-0-0-1 --type change --strict` | OpenSpec change | PASS |
| `openspec.cmd validate --all --strict` | OpenSpec repo | PASS: 25 passed, 0 failed |
| `cd api && npm.cmd run build` | API | PASS |
| `cd api && npx.cmd tsx --test "src/**/*.spec.ts"` | API tests | FAIL: 480 tests, 478 pass, 1 fail, 1 skipped |
| `cd web && npm.cmd run lint` | Web lint | PASS with warnings |
| `cd web && npm.cmd run build` | Web build | PASS with warnings |
| `git diff --check` | Whitespace | PASS |
| `git status --short` | Git state | PASS executed; only expected new release docs/OpenSpec files |

## API test failure detected

The single failing API test is:

```text
src/modules/inventory/services/inventory.service.spec.ts
InventoryService product mapping
RangeError: Invalid time value
InventoryService.mapInventoryRow -> new Date(row.image_updated_at).toISOString()
```

Observed cause: the test fixture omits `image_updated_at`; the mapper treats only `null` as empty and attempts to convert `undefined` to a Date. This change does not fix it because the release closure is documentation-only and must not alter business logic.

## Criterio QA para sellar

Puede sellarse `v0.0.1` si:

- OpenSpec valida este change y el repo.
- API build pasa y el fallo de test API queda aceptado como fix post-release documentado o se resuelve en un change separado.
- Web lint/build pasa o cualquier falla queda documentada.
- No hay cambios en logica, permisos, API contracts ni SQL.
- Los pendientes externos quedan explicitamente fuera de `v0.0.1`.

No debe sellarse si:

- Aparece necesidad de SQL no planificada.
- Hay cambio en runtime o permisos dentro de este corte.
- Se intenta tocar PRD.
- Se activa hardware real o DIAN real.
