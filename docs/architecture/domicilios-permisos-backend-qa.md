# Domicilios - Evidencia QA permisos backend

Fecha: 2026-06-20

## Alcance validado

- Fase 6A permisos backend.
- Sin frontend.
- Sin caja.
- Sin facturacion.
- Sin pedidos, ventas ni inventario.
- Sin Prisma.
- Sin aplicacion en produccion.

## Cambios validados

- `MENU_KEYS.DELIVERIES`.
- Acciones backend `DELIVERIES_*`.
- `DeliveriesController` protegido con `JwtAuthGuard` y `PermissionsGuard`.
- `@RequirePermission` por endpoint.
- SQL local/QA idempotente para `menu_items` y `role_menu_permissions`.
- Endpoint `GET /api/deliveries/reports/summary` como placeholder protegido.

## SQL local/QA

Archivo:

```text
scripts/database/security/20260620_1730_deliveries_permissions_local_qa.sql
```

Validacion ejecutada:

```text
psql ... -v ON_ERROR_STOP=1 -X -q
```

Modo:

```text
COMMIT reemplazado por ROLLBACK para validar sintaxis y referencias sin persistir cambios.
```

Resultado:

```text
PASS
```

Aplicado en produccion:

```text
NO
```

Aplicado local con commit:

```text
NO
```

## Tests backend

Tests enfocados:

```text
npx.cmd tsx --test src/modules/deliveries/*.spec.ts src/modules/deliveries/**/*.spec.ts src/common/guards/permissions.guard.spec.ts
```

Resultado:

```text
36 tests, 36 pass
```

Suite completa:

```text
npx.cmd tsx --test src/**/*.spec.ts
```

Resultado:

```text
491 tests, 490 pass, 1 skipped
```

Build:

```text
npm.cmd run build
```

Resultado:

```text
PASS
```

## OpenSpec

```text
openspec.cmd validate gestionar-domicilios-clientes-pedidos-facturacion-caja --type change --strict
openspec.cmd validate --all --strict
```

Resultado:

```text
PASS
32 passed, 0 failed
```

## Git

```text
git diff --check
```

Resultado:

```text
PASS con warnings CRLF solamente
```
