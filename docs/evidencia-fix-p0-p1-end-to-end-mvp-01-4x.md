# Evidencia fix P0/P1 end-to-end MVP-01.4X

Fecha: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_P0_P1_BLOCKERS_FIXED`

## Contexto

MVP-01.3X quedo `QA_OPERATIVO_END_TO_END_BLOCKED`.

Bloqueos tratados:

- P0: `PATCH /api/purchases/:id/settle-partial` devolvia HTTP 500 con body vacio.
- P1: `backend-reporteria` devolvia HTTP 500 generalizado en reportes y health.

Restricciones:

- No se toco AWS.
- No se hizo deploy.
- No se ejecutaron migraciones contra QA.
- No se reinicio PM2.
- No se versionaron secretos.
- No se hicieron escrituras directas en DB.

## Diagnostico P0

El flujo `settle-partial` ya tenia cobertura positiva, pero no cubria datos historicos de auditoria con `branchId` o `terminalId` no UUID en `auditoria_eventos.datos_despues`.

La consulta `getPurchaseAuditContext` hacia cast directo:

```sql
NULLIF(ae.datos_despues->>'terminalId', '')::uuid
```

Si el audit context tenia un valor operativo no UUID, por ejemplo `local-terminal`, PostgreSQL podia lanzar `22P02 invalid input syntax for type uuid` antes de llegar a la liquidacion funcional.

## Fix P0

Archivo:

- `api/src/modules/inventory/services/purchase.service.ts`

Cambio:

- Se reemplazo el cast directo por `CASE WHEN ... ~* <uuid-regex> THEN ...::uuid ELSE NULL END`.
- Se aplico en:
  - `getPurchaseAuditContext`.
  - listado de compras que tambien lee audit context.

Regresion agregada:

- `api/src/modules/inventory/services/purchase.service.spec.ts`
- Caso: `PurchaseService.settlePartialPurchase: tolera audit context con terminalId no UUID`.

Resultado local:

- `settlePartialPurchase` liquida la compra parcial.
- El audit context invalido se degrada a `NULL`.
- No se ejecuta cast directo inseguro a UUID.

## Diagnostico P1

`backend-reporteria` aceptaba actor mock cuando no habia Bearer JWT.

Pero cuando llegaba un Bearer invalido, expirado o firmado con un `JWT_SECRET` distinto, `jwt.verify` lanzaba error crudo de `jsonwebtoken`. Ese error no era traducido a `UnauthorizedException`, por lo que Nest podia responder HTTP 500.

Esto explica un HTTP 500 incluso en:

```text
GET /api/reports/health
```

porque health pasa por `JwtAuthGuard`, aunque no consulte DB.

## Fix P1

Archivos:

- `backend-reporteria/src/modules/auth/jwt-auth.guard.ts`
- `backend-reporteria/src/modules/auth/jwt-auth.guard.spec.ts`
- `backend-reporteria/.env.example`

Cambios:

- `JwtAuthGuard` ahora captura errores de `jwt.verify`.
- Si `REPORTS_ALLOW_MOCK_AUTH` no es `false`, conserva el comportamiento QA/demo y usa actor mock.
- Si `REPORTS_ALLOW_MOCK_AUTH=false`, devuelve `UnauthorizedException` controlada en vez de HTTP 500.
- Se documento `REPORTS_ALLOW_MOCK_AUTH=true` en `.env.example`.

Regresiones agregadas:

- JWT valido con claims de API se decodifica.
- Bearer invalido usa actor mock cuando mock auth esta permitido.
- Bearer invalido devuelve `UnauthorizedException` cuando mock auth esta deshabilitado.

## SQL y migraciones

No se creo migracion nueva.

Razon:

- P0 se corrigio en consulta de servicio.
- P1 se corrigio en guard de autenticacion de `backend-reporteria`.
- No se confirmo drift SQL que requiera cambio versionado adicional en esta fase.

## Validaciones

| Validacion | Resultado |
| --- | --- |
| `cd api && npx.cmd tsx --test src/modules/inventory/services/purchase.service.spec.ts` | PASS |
| `cd backend-reporteria && npx.cmd tsx --test src/modules/auth/jwt-auth.guard.spec.ts` | PASS |
| `cd api && npm.cmd run build` | PASS |
| `cd backend-reporteria && npm.cmd run build` | PASS |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS |
| `git diff --check` | PASS |
| `git status --short` | PASS, worktree con cambios versionados y evidencias sin trackear. |

`git status --short` observado:

```text
 M api/src/modules/inventory/services/purchase.service.spec.ts
 M api/src/modules/inventory/services/purchase.service.ts
 M backend-reporteria/.env.example
 M backend-reporteria/src/modules/auth/jwt-auth.guard.ts
 M openspec/changes/mvp-web-hardening/tasks.md
?? backend-reporteria/src/modules/auth/jwt-auth.guard.spec.ts
?? docs/evidencia-fix-p0-p1-end-to-end-mvp-01-4x.md
?? docs/evidencia-qa-operativo-integral-end-to-end-mvp-01-3x.md
?? docs/evidencia-qa-operativo-integral-mvp-01-3.md
```

## Riesgo residual

- La correccion esta versionada y validada localmente.
- Se requiere deploy posterior y rerun QA para confirmar HTTP real en `manus_tienda_qa`.
- Si reporteria aun falla despues del deploy, siguiente diagnostico debe revisar runtime `.env`, `DB_NAME`, `DB_USER`, grants y logs del proceso `backend-reporteria-linux`.

## Decision

```text
QA_P0_P1_BLOCKERS_FIXED
```
