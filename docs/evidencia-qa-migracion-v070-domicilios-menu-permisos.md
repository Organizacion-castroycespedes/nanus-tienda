# Evidencia QA V070: entregas menu y permisos base

## Objetivo

Formalizar en migración versionada el menú y permisos de `DELIVERIES` para AWS QA y release, sin depender del script local no versionado.

## Por qué se crea `V070__deliveries_menu_permissions_seed.sql`

- Existe un script local en `scripts/database/security/20260620_1730_deliveries_permissions_local_qa.sql` con `localQaOnly` y estados de permisos incompletos para proceso release.
- El script no forma parte de migraciones versionadas.
- En QA/AWS hace falta una migración formal y repetible (`scripts/database/migrations/V070__deliveries_menu_permissions_seed.sql`).

## Reemplazo del script local de QA

`V070__deliveries_menu_permissions_seed.sql` cubre formalmente el alcance del script `20260620_1730_deliveries_permissions_local_qa.sql`, incluyendo:

- `menu_items.key = 'DELIVERIES'` con `route '/{tenant}/deliveries'`.
- `role_menu_permissions` para `USER`, `ADMIN`, `SUPER_USER`, `SUPER_ADMIN`.
- Permisos `actions` definidos con `WRITE` y flags específicos de `DELIVERIES_*`.

## Confirmación no destructiva

- La migración usa `INSERT ... ON CONFLICT` para `menu_items`.
- La migración usa `INSERT ... ON CONFLICT` para `role_menu_permissions`.
- No contiene instrucciones de `DELETE`, no elimina roles y no altera otros módulos.
- No se ejecutó contra PRD.

## Confirmación de visibilidad

- `visible` se establece explícitamente en `TRUE` para `menu_items` `DELIVERIES`.

## Roles cubiertos

- `USER`
- `ADMIN`
- `SUPER_USER`
- `SUPER_ADMIN`

## Consultas de validación

```sql
SELECT tenant_id, key, label, route, visible
FROM public.menu_items
WHERE key = 'DELIVERIES';

SELECT r.nombre AS role_name, mi.key, rmp.access_level, rmp.actions
FROM public.role_menu_permissions rmp
JOIN public.menu_items mi ON mi.id = rmp.menu_item_id
JOIN public.roles r ON r.id = rmp.role_id
WHERE mi.key = 'DELIVERIES'
ORDER BY r.nombre;
```

## Resultado esperado

- `menu_items` para `DELIVERIES` visible en tenants.
- `role_menu_permissions` actualizado para los 4 roles objetivo.
- Script idempotente para re-ejecuciones en QA/release sin duplicados.
