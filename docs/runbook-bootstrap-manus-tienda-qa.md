# Runbook Bootstrap DB QA - `manus_tienda_qa`

Estado: plan documentado, no ejecutado.

## Objetivo

Crear una base QA aislada llamada `manus_tienda_qa` desde cero, sin migrar datos operativos desde `manus_tienda`, usando estructura, migraciones y seeds minimos del repositorio.

## Decision

- Crear DB nueva: `manus_tienda_qa`.
- No usar `manus_tienda` para QA de despliegue MVP.
- No copiar datos operativos.
- Usar usuario existente `manus_user` solo si el owner operativo lo aprueba.
- Preferir usuario dedicado `manus_qa_user` si se quiere aislamiento adicional.

## Precondiciones

- Backup/snapshot QA listo segun MVP-00.4.
- PostgreSQL accesible.
- `psql`, `pg_dump`, `pg_restore` disponibles.
- Archivo externo no versionado con variables QA.
- Aprobacion humana explicita para crear DB.
- Confirmar que `DB_NAME=manus_tienda_qa`.

## Archivo env externo

Crear fuera del repo o en ubicacion ignorada por git.

Ejemplo de nombres, sin valores reales:

```env
CONFIRM_CREATE_QA_DB=YES
DB_HOST=
DB_PORT=5432
DB_NAME=manus_tienda_qa
DB_USER=manus_qa_user
DB_PASSWORD=
DB_ADMIN_USER=
DB_ADMIN_PASSWORD=
ENVIRONMENT=qa
SEED_SUPER_ADMIN_EMAIL=
SEED_SUPER_ADMIN_PASSWORD=
SEED_SUPER_ADMIN_FIRST_NAME=
SEED_SUPER_ADMIN_LAST_NAME=
RUN_OPTIONAL_QA_FIXTURES=NO
```

Reglas:

- No guardar secretos en OpenSpec.
- No guardar secretos en docs.
- No commitear el archivo env real.
- `DB_NAME` debe terminar en `_qa`.
- Este runbook se restringe a `manus_tienda_qa`.

## Orden propuesto

1. Validar snapshot/backup del servidor si aplica.
2. Validar espacio con `df -h`.
3. Validar archivo env externo.
4. Crear rol si no existe.
5. Crear DB `manus_tienda_qa` si no existe.
6. Crear `public.migrations_history`.
7. Aplicar schema base y modulos historicos con `migrate_prd.sh`.
8. Aplicar migraciones incrementales en `scripts/database/migrations/`, incluyendo `V053` y `V054`.
9. Aplicar seed minimo de consumidor final.
10. Validar `migrations_history`.
11. Validar tenant/sucursal.
12. Validar roles.
13. Validar menu y permisos.
14. Validar usuarios QA.
15. Validar terminal POS default y settings MOCK.
16. Ejecutar smoke SQL.

## Script orquestador seguro

Script preparado:

```bash
bash scripts/database/bootstrap-manus-tienda-qa.sh /secure/path/manus_tienda_qa.env
```

El script:

- exige `CONFIRM_CREATE_QA_DB=YES`;
- rechaza `DB_NAME` que no termine en `_qa`;
- rechaza cualquier DB distinta a `manus_tienda_qa`;
- no contiene passwords;
- lee config desde archivo externo;
- no ejecuta `DROP DATABASE`;
- no toca `manus_tienda`;
- llama `migrate_prd.sh` para schema/migraciones/seeds minimos;
- registra logs en `scripts/database/logs/`;
- permite fixtures opcionales solo con `RUN_OPTIONAL_QA_FIXTURES=YES`.

## Seeds minimos

`migrate_prd.sh` aplica el set minimo controlado para bootstrap desde cero:

- `migrations_history`
- `tenants`
- `tenant_branches`
- `roles`
- `menu_items`
- `role_menu_permissions`
- usuario `SUPER_ADMIN` configurado por env
- usuarios demo operativos si el script base los mantiene
- cliente `CONSUMIDOR FINAL`
- ventas/pagos/caja base
- modulos productos/compras/pedidos/finanzas
- migraciones incrementales
- `V053` modelo formal de productos pesables
- `V054` terminal POS y settings MOCK

## Seeds opcionales

Para QA funcional con POS y catalogo demo, evaluar aparte:

- `scripts/database/products/run_all.sh`
- `RUN_OPTIONAL_QA_FIXTURES=YES`

No usar fixtures opcionales si el objetivo es DB limpia minima.

## Validaciones SQL

Smoke SQL sugerido:

```sql
SELECT current_database(), current_user;

SELECT version, success, details
FROM public.migrations_history
ORDER BY applied_at DESC
LIMIT 20;

SELECT COUNT(*) FROM public.tenants;
SELECT COUNT(*) FROM public.tenant_branches;
SELECT COUNT(*) FROM public.roles;
SELECT COUNT(*) FROM public.menu_items;
SELECT COUNT(*) FROM public.role_menu_permissions;
SELECT COUNT(*) FROM public.users;

SELECT to_regclass('public.pos_terminals');
SELECT to_regclass('public.pos_terminal_peripheral_settings');
```

Validar usuario QA:

```sql
SELECT email, estado
FROM public.users
WHERE email IN ('<SUPER_ADMIN_QA_EMAIL>', '<ADMIN_QA_EMAIL>', '<USER_QA_EMAIL>');
```

Validar terminal default:

```sql
SELECT code, name, mode, active
FROM public.pos_terminals
WHERE code = 'local-terminal';
```

## Rollback

Si bootstrap falla antes de usar la DB:

- No ejecutar `DROP DATABASE` automaticamente.
- Documentar error.
- Revisar `migrations_history`.
- Crear una DB nueva con sufijo de intento si se requiere.
- Borrar DB fallida solo con aprobacion humana explicita y comando manual revisado.

Si ya hay datos QA utiles:

- Restaurar desde dump/snapshot.
- No intentar rollback manual parcial salvo script revisado.

## Riesgos

- `migrate_prd.sh` tiene nombre PRD pero es el runner mas completo de bootstrap desde cero.
- Seeds demo pueden no ser deseados para QA limpia.
- `manus_user` puede compartir permisos con otra DB; preferir `manus_qa_user`.
- Sin backup/snapshot previo no hay rollback aceptable.
- No se debe tocar `manus_tienda`.

## Siguiente paso

Ejecutar una fase futura autorizada para crear `manus_tienda_qa` en QA AWS, despues de backup/snapshot real.
