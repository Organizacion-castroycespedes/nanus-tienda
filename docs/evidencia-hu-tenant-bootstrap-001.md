# Evidencia HU-TENANT-BOOTSTRAP-001

Estado: implementación LOCAL verificada y QA manual LOCAL en PASS (propietario, 2026-11-11). QA pendiente. PRD no autorizado.

## Base

- Rama base: `origin/develop` 3426fc53 (último ref conocido; el `git fetch` no estuvo disponible desde el entorno de trabajo).
- Esquema LOCAL reconstruido con `scripts/database/migrate_prd.sh` en PostgreSQL 16.15 (misma versión que QA) más los ajustes locales descritos en "Hallazgos del esquema".

## Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `tsc -p api/tsconfig.json --noEmit` | OK |
| Build de la API (`tsc`, salida fuera del repositorio) | OK |
| Specs de `api/src/modules/tenants` y `platform-tenant.guard` | 29/29 OK |
| Integración real `tenant-bootstrap.integration.spec.ts` (base desechable, usuario runtime `manus_user`) | 6/6 OK |
| Pruebas de mutación sobre la integración (copiar `PLATFORM_ONLY`, vincular entidad privada, copiar tarifas vencidas, ignorar ambigüedad) | 4/4 detectadas |
| Suite completa de specs de la API | 1067/1076 OK; 7 fallos y 2 omitidos idénticos en la base sin cambios (no relacionados) |
| `openspec validate --strict` | No ejecutado: CLI no disponible en el entorno |
| QA manual LOCAL (alta desde la UI y verificación de la empresa nueva) | PASS, reportado por el propietario el 2026-11-11 |

Las specs se compilaron con `tsc` y se ejecutaron con `node --test` porque `tsx` (esbuild nativo de Windows) no corre en Linux y el registro npm no era accesible.

## Cómo ejecutar la integración en LOCAL o QA desechable

```bash
createdb -T manus_local manus_bootstrap_test   # nombre con "test": la prueba se niega a correr si no
cd api
TENANT_BOOTSTRAP_TEST_DATABASE_URL=postgres://manus_user:***@localhost:5432/manus_bootstrap_test \
  npx tsx --test src/modules/tenants/tenant-bootstrap.integration.spec.ts
dropdb manus_bootstrap_test
```

La prueba agrega casos borde al tenant plataforma de esa base. Nunca apuntarla a QA o PRD reales.

## Hallazgos del esquema (no corregidos en esta HU)

1. La cadena de migraciones no se puede reproducir desde cero:
   - `V071` exige IDs de terminal aprobados (se usó `scripts/database/tests/phase59_v071_local_bootstrap.sql`);
   - `V081` se registra a sí misma con checksum `v081-tenant-slug-backfill`, que el runner rechaza en una segunda pasada;
   - `V092` exige la columna que crea `V098`;
   - `V099` usa UUID de impuestos que solo existen en PRD;
   - `V103`, `V104` y `V110` fallan en una base nueva (no afectan las tablas de esta HU).
2. El catálogo fiscal de PRD tiene impuestos de licor duplicados ("incluido"/"no incluido") creados fuera del repositorio. Por eso los grupos ambiguos no se copian.
3. Las FK de `menu_items.parent_id` y `role_menu_permissions.menu_item_id` no exigen el mismo tenant.

## QA manual

1. Respaldo o snapshot de QA y `TENANT_BOOTSTRAP_ENABLED=true`.
2. Como SUPER_ADMIN del tenant plataforma: Configuración → Crear tenant. Esperado: éxito y `bootstrap.status = COMPLETED` en la respuesta.
3. En QA (solo lectura), comparar conteos del tenant nuevo frente al plataforma: menús (sin `CONTROL_CENTER`), permisos, unidades, impuestos, tarifas vigentes, métodos de pago; un consumidor final sin correo ni dirección; evento `TENANT_BOOTSTRAP_COMPLETED`.
4. Revisar `bootstrap.manual` (impuestos ambiguos o sin clasificar) con el propietario.
5. Como SUPER_ADMIN de otro tenant, ADMIN y USER: crear tenant. Esperado: 403.
6. Crear el primer usuario y la sucursal de la empresa nueva, iniciar sesión y verificar menú, POS con consumidor final, impuestos y métodos de pago.
7. Con `TENANT_BOOTSTRAP_ENABLED=false`: el alta crea solo el tenant.
