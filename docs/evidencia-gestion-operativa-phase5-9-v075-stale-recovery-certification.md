# Evidencia Gestión Operativa — Phase 5.9

## Alcance

Se corrigió el bootstrap local y se ejecutó la cadena completa hasta `V075` contra una base PostgreSQL local y desechable. Esa ejecución fue anterior a la renumeración del procesamiento electrónico a V076. No se usaron QA remoto, producción, documentos fiscales reales, FactuCore real ni DIAN.

## Entorno y guardas

- Host: `localhost` / `127.0.0.1`.
- Puerto: `55432`.
- Base: `manus_billing_concurrency_test`.
- Usuario: local de pruebas, no persistido en el repositorio.
- PostgreSQL: clúster temporal en `%TEMP%`.
- Causa `V071`: el seed `V054` crea terminales con IDs generados y modo `MOCK`; `V071` exigía IDs fijos y modo `HYBRID`. La migración también esperaba un `TERM-001` con ID fijo.
- Tipo de corrección: bootstrap local de pruebas. No se modificó `V071` ni su semántica de producción.
- `scripts/database/tests/phase59_v071_local_bootstrap.sql` crea el puente sintético requerido antes de ejecutar la migración pendiente.
- El runner completo terminó correctamente con `V071`, `V072`, `V073`, `V074` y el procesamiento electrónico registrado como `V075` en ese momento. Antes de QA, el archivo fue renumerado a `V076__electronic_billing_processing_stage.sql`; no se reescribe el historial local de aquella ejecución.

## V076 (antes V075 en la ejecución local)

La migración es aditiva e idempotente. Agrega:

- `electronic_documents.processing_stage TEXT NOT NULL DEFAULT 'UNKNOWN'`.
- `electronic_documents.processing_stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- `chk_electronic_documents_processing_stage` con los ocho valores permitidos.

Una segunda ejecución terminó sin error y no duplicó columnas ni constraint.

La prueba de constraint rechazó un valor fuera del conjunto permitido. El default `UNKNOWN` es fail-closed.

## Backfill

Se usaron únicamente cinco filas sintéticas locales:

| Estado | Evidencia | Resultado |
|---|---|---|
| `ACCEPTED` | estado terminal | `COMPLETED` |
| `CANCELLED` | estado terminal | `COMPLETED` |
| `REJECTED` | `rejected_at` presente | `COMPLETED` |
| `PROCESSING` | `provider_document_id` presente | `RECONCILIATION_REQUIRED` |
| `PENDING` | sin vínculo ni prueba histórica | `UNKNOWN` |

Las filas sintéticas fueron eliminadas después de la prueba.

## Modelo y recuperación

El código existente define estos stages en `backend-facturacion-electronica/src/modules/electronic-billing/contracts/processing-state.ts`:

`PRE_PROVIDER_CREATE`, `PROVIDER_CREATE_INTENT`, `PROVIDER_LINKED`, `PRE_TRANSMIT`, `TRANSMISSION_INTENT`, `RECONCILIATION_REQUIRED`, `COMPLETED`, `UNKNOWN`.

El servicio persiste intentos antes de los caminos externos y conserva recuperación por `external_reference`. Los terminales mantienen guardia monotónica. El advisory lock PostgreSQL sigue resolviendo concurrencia; el stage aporta evidencia durable tras un crash.

## Pruebas ejecutadas

- PostgreSQL real, dos o más sesiones independientes: `5/5 PASS` en `test/electronic-billing.postgres-concurrency.integration.spec.ts`.
- Cinco repeticiones del bloque real: `5/5` rondas sin fallos; cada ronda `5/5` pruebas.
- Pruebas de procesamiento/recovery con mocks deterministas: `24/24 PASS`.
- Suite Billing completa: `157/157 PASS`.
- V076 constraint y backfill sintético: PASS.
- Build Billing: PASS.
- Build API: PASS.
- OpenSpec all strict: `90 passed, 1 failed`.

## Resultado de seguridad

No hubo llamadas live a FactuCore ni DIAN. No hubo mutaciones de negocio QA. No se expuso retry API/UI. No se hicieron commits, push ni deploy.

La migración y el backfill quedaron verificados. La certificación completa de crash-before-create, create ambiguity, crash-before-transmit y ambiguous transmission usando el flujo de servicios reales sigue pendiente: las pruebas reales disponibles cubren locks/concurrencia, mientras las pruebas de recovery usan mocks de servicio y no una fixture PostgreSQL completa del aggregate Billing.

## Pendiente

- Integrar una fixture PostgreSQL completa con los servicios Billing para los checkpoints de crash y el provider mock persistente.
- Ejecutar con PostgreSQL real los checkpoints de crash y el provider mock persistente.
- Mantener retry API/UI diferidos hasta cerrar esa evidencia.

## Fallo heredado

OpenSpec conserva el fallo no relacionado `corregir-handoff-agent-local-perifericos-electron`.
