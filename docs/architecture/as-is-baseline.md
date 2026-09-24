# Línea base AS-IS Manus POS

## Identificación

| Campo | Valor |
|---|---|
| Repositorio | `Organizacion-castroycespedes/nanus-tienda` |
| Commit auditado | `3dd5098f428e23daf31c750d638c0adb2fa8676a` |
| Rama | `feat/develop/actualizar-documentacion-manus-pos` |
| Fecha de referencia | 2026-09-23 |
| Alcance | Código, configuración, SQL, documentación y OpenSpec versionados |
| Validación externa | No se consultaron bases activas, infraestructura ni hardware |

## Lectura de estados

- **Implementado:** existe código funcional identificable.
- **Configurado:** existe manifest, variable o topología declarada.
- **Probado:** existe test o evidencia versionada; no implica producción.
- **Simulado:** usa mock, fixture o adapter conceptual.
- **Pendiente:** hay código o especificación, pero falta completar o validar.
- **Futuro:** el propio componente lo declara fuera de alcance.
- **No verificado:** requiere ambiente, base o hardware externo.

## Resumen AS-IS

Manus POS es una plataforma SaaS multi-tenant con frontend Next.js, API NestJS y PostgreSQL. La API posee módulos de autenticación, RBAC, tenants, sucursales, terminales, inventario, ventas, compras, pedidos, domicilios, finanzas, precios, facturación e integración outbox.

Hay tres servicios NestJS separados además del frontend:

1. `api/` como owner operativo.
2. `backend-reporteria/` para consultas y exportación de reportes.
3. `backend-facturacion-electronica/` como bounded context fiscal.

`backend-perifericos/` es un agente local independiente. `desktop/electron/` es un shell online que carga la web y llama al agente mediante HTTP loopback desde el proceso principal de Electron.

No se certifica operación offline, DIAN productivo, auto-update, firma de instaladores ni hardware físico en producción.

## Fuentes principales

- `api/src/modules/app.module.ts`
- `api/src/main.ts`
- `api/src/common/guards/jwt-auth.guard.ts`
- `docker-compose.yml`
- `scripts/database/run_migrations.sh`
- `scripts/database/migrate_prd.sh`
- `scripts/database/migrations/`
- `database/manus_tienda_qa.sql`
- `desktop/electron/agent-client.ts`
- `backend-perifericos/src/main.ts`
- `backend-facturacion-electronica/README.md`
- `backend-reporteria/README.md`

## Matriz de evidencias

| Hecho documentado | Referencia | Estado |
|---|---|---|
| Prefijo global de API | `api/src/main.ts:97` | Confirmado |
| Puerto por defecto de API | `api/src/main.ts:160` | Confirmado |
| Módulos principales importados | `api/src/modules/app.module.ts:24-45` | Confirmado |
| JWT y sesión activa | `api/src/common/guards/jwt-auth.guard.ts:58-100` | Confirmado |
| API → reportería | `docker-compose.yml:30` | Declarado |
| API → facturación | `docker-compose.yml:31` | Declarado |
| Facturación → API | `docker-compose.yml:93-94` | Declarado/configurado |
| Runner versionado y directorio | `scripts/database/run_migrations.sh:13,39-50,88-91` | Confirmado |
| Runner productivo | `scripts/database/migrate_prd.sh:13,125-147,504` | Confirmado |
| Migración V087 | `scripts/database/migrations/V087__report_product_inventory.sql:1-4` | Confirmado |
| Electron → Agent | `desktop/electron/agent-client.ts:14-15,99-123` | Confirmado |
| Loopback permitido | `desktop/electron/config.ts:78-92` | Confirmado |
| Agent escucha configuración | `backend-perifericos/src/main.ts:20-50` | Confirmado |
| Endpoints de dispositivos | `backend-perifericos/src/modules/devices/devices.controller.ts:10-36` | Confirmado |

## Hallazgos corregidos

La auditoría inicial concluyó que no existía un runner automatizado y que el DDL operativo solo estaba en `api/database/`. La inspección B1 corrige esto:

- Existe `scripts/database/run_migrations.sh`.
- Existe `scripts/database/migrate_prd.sh`.
- Existe `scripts/database/migrate.sh` para la familia numerada base.
- Se registra estado en `public.migrations_history`, incluyendo checksum.
- Existe `scripts/database/migrations/V087__report_product_inventory.sql`.
- El DDL está distribuido entre `scripts/database/`, `api/database/` y SQL funcionales.

La incertidumbre restante es el estado aplicado en cada ambiente, porque esta fase no consulta bases activas.
