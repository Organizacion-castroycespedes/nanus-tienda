# Checklist desbloqueo QA - Piloto ventas loteadas v2

Estado: pendiente de completar.

Objetivo: reunir la configuracion minima para ejecutar Fase 3.19 sin tocar PRD ni exponer secretos.

Plantilla base: `docs/templates/qa-piloto-ventas-loteadas-v2.env.example`

## 1. Confirmacion de ambiente

| Check | Estado | Evidencia/valor |
| --- | --- | --- |
| QA host definido. | [ ] | `QA_DB_HOST` |
| QA no es PRD. | [ ] | Confirmacion escrita del responsable. |
| DB name no corresponde a produccion. | [ ] | `QA_DB_NAME` revisado. |
| API URL no corresponde a produccion. | [ ] | `QA_API_URL` revisada. |
| PostgreSQL 16 confirmado. | [ ] | Resultado sanitizado de `SELECT version();` |

## 2. Seguridad

| Check | Estado | Evidencia/valor |
| --- | --- | --- |
| Backup probado. | [ ] | `QA_BACKUP_COMMAND` validado. |
| Rollback definido. | [ ] | Flag off + tenant config off + restart. |
| Credenciales no se documentan en texto plano. | [ ] | Usar gestor seguro o variables de entorno privadas. |
| Tokens/JWT no se guardan en evidencia. | [ ] | Evidencia con `<TOKEN>`. |

## 3. Base de datos

| Check | Estado | Evidencia/valor |
| --- | --- | --- |
| Migracion `20260601_inventory_products_lots_phase_1.sql` lista/aplicada. | [ ] | Historial o validacion de tablas. |
| Migracion `20260602_inventory_create_sale_v2.sql` lista/aplicada. | [ ] | Historial o `to_regprocedure`. |
| Rollbacks disponibles. | [ ] | Rollbacks en `scripts/database/migrations/`. |
| `inventory_create_sale` existe. | [ ] | `to_regprocedure(...) = true`. |
| `inventory_create_sale_v2` existe o pendiente de aplicar. | [ ] | Estado documentado. |
| `inventory_invoice_order` existe. | [ ] | `pg_proc` o `to_regprocedure`. |

## 4. Datos funcionales

| Check | Estado | Evidencia/valor |
| --- | --- | --- |
| Tenant piloto identificado. | [ ] | `TENANT_ID_QA` |
| Branch piloto identificado. | [ ] | `BRANCH_ID_QA` |
| Branch control identificado. | [ ] | `CONTROL_BRANCH_ID_QA` |
| Usuario QA con permisos. | [ ] | `QA_USER_EMAIL`, `QA_USER_ROLE_EXPECTED` |
| Producto no loteado. | [ ] | `QA_TEST_PRODUCT_NO_LOT_ID` |
| Producto loteado. | [ ] | `QA_TEST_PRODUCT_LOT_ID` |
| Proveedor. | [ ] | `QA_TEST_SUPPLIER_ID` |
| Metodo de pago. | [ ] | `QA_PAYMENT_METHOD_ID` |
| Caja/terminal/sesion. | [ ] | `QA_CASH_REGISTER_ID`, `QA_TERMINAL_ID`, `QA_POS_SESSION_ID` |

## 5. Operacion

| Check | Estado | Evidencia/valor |
| --- | --- | --- |
| Comando backup validado. | [ ] | `QA_BACKUP_COMMAND` |
| Comando restart validado. | [ ] | `QA_RESTART_COMMAND` |
| Healthcheck definido. | [ ] | `QA_API_HEALTHCHECK_URL` |
| Responsable de aprobar ejecucion QA. | [ ] | Nombre/rol sin credenciales. |

## 6. Criterio de desbloqueo

Para desbloquear Fase 3.19:

- [ ] Todos los campos obligatorios de la plantilla estan completos en un medio seguro.
- [ ] El backup QA fue ejecutado o autorizado con comando validado.
- [ ] El rollback rapido fue revisado.
- [ ] El responsable confirma explicitamente:

```text
AUTORIZADO QA, NO PRD
```

Sin esa frase exacta, no ejecutar Fase 3.19.

## Riesgos vivos

- RIESGO: si QA comparte host/base con PRD, no ejecutar.
- RIESGO: si el backup no es restaurable, no ejecutar.
- RIESGO: si faltan productos/lotes/caja de prueba, los escenarios A-M no seran confiables.
- RIESGO: si los IDs de productos legacy no tienen balances loteados, v2 fallara por diseno.
