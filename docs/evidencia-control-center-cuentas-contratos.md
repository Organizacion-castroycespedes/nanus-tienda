# Evidencia: MANUS Control Center, fase 1 (cuentas, planes y contratos)

OpenSpec: `crear-control-center-cuentas-contratos` · Rama: `feature/develop/control-center-cuentas-contratos` · Fecha: 2026-11-08

## Alcance

- Migración `V112__control_center_accounts_contracts.sql` y su rollback protegido.
- API: directorio de tenants, cuentas comerciales y vínculos, planes con versiones de precio, contratos (vista previa, creación idempotente, activación, enmienda, terminación y cancelación).
- Web: pestañas Resumen, Tenants, Cuentas, Planes y Contratos, más la ficha del contrato, con el design system de MANUS.

## Validación automatizada (Windows, Node 24.21.0)

| Verificación | Resultado |
|---|---|
| `openspec validate crear-control-center-cuentas-contratos --strict` | Válido |
| Gobernanza STRICT equivalente a CI | `REPOSITORY_GATE_STATUS=PASS` |
| API `tsc --noEmit` | OK |
| API pruebas del módulo `control-center` | 102/102 |
| API suite completa | OK (exit 0) |
| Web lint | Sin advertencias ni errores |
| Web pruebas `access.spec.ts` y `format.spec.ts` | 9/9 |
| Web `tsc --noEmit` | Sin errores nuevos (26 preexistentes en `*.spec.ts` ajenos) |
| Contrato SQL V111 + V112 | OK |

## Reglas verificadas en PostgreSQL real

V112 se aplicó directamente sobre la base local `manus_prd_local_test` (mismo criterio que V111; sin runner gobernado ni `migrations_history`). SHA-256: `4aed947f8eefc15e439ea8fd90a576eca8e808874c96e773070020bdfd3f56f8`.

Con el rol dedicado `manus_cc_local`, en una transacción revertida, se verificaron **25/25** reglas:

- NIT duplicado rechazado (`uq_cc_accounts_tax_id`).
- Consentimiento de WhatsApp sin teléfono rechazado.
- Un tenant con dos cuentas activas rechazado (`uq_cc_account_tenants_active_tenant`).
- Tenant inexistente rechazado (FK `RESTRICT`).
- Segunda versión de precio abierta rechazada.
- Componentes e ítems sin `UPDATE` (42501).
- Edición de versiones rechazada por trigger.
- Segundo contrato abierto del tenant rechazado (`uq_cc_contracts_open_per_tenant`).
- Descuento mayor al valor rechazado.
- Vigencia que solo se cierra una vez.
- `DELETE` denegado.
- FK diferida de la versión vigente.

Nota: la secuencia `contract_number_seq` avanzó una vez durante esa prueba (las secuencias no se revierten), por eso el primer contrato real es `MCC-2026-00002`.

## QA manual operativa (propietario, navegador)

API del worktree en el puerto 4120 y web en el 3100, con el SUPER_ADMIN del tenant plataforma. Resultado reportado: **sin fallas**.

Evidencia leída de la base (solo lectura, rol dedicado):

| Dato | Valor |
|---|---|
| Cuentas comerciales | 1 |
| Vínculos activos | 1 |
| Planes / versiones de precio | 1 / 1 |
| Contratos | 1 (`MCC-2026-00002`, `ACTIVE`, inicio 2026-11-08) |
| Versiones del contrato | 2 |
| Ítems | 6 |
| Eventos de auditoría | 8 |

Versiones del contrato:

| Versión | Condición | Frecuencia | Corte | Prueba hasta | IVA |
|---|---|---|---|---|---|
| 1 | Término inicial | Anual | Día 8 | 2027-11-08 (prueba modificada con motivo) | 19% incluido |
| 2 | Renovación | Mensual | Día 8 | 2027-11-08 | 19% incluido |

Certificación DIAN ($119.000/año):

| Versión | Descuento | Bono |
|---|---|---|
| 1 (inicial anual) | $119.000 | `INCLUIDA_TERMINO_INICIAL` |
| 2 (renovación mensual) | $0 | Cobrada aparte |

Auditoría por acción: `ACCOUNT_CREATED`, `TENANT_LINKED`, `PLAN_CREATED` (sin motivo, no críticas); `PLAN_PRICE_VERSION_PUBLISHED`, `CONTRACT_CREATED`, `CONTRACT_TRIAL_MODIFIED`, `CONTRACT_ACTIVATED` y `CONTRACT_AMENDED` (todas con motivo).

## Pendiente

- Aplicar V111 y V112 con el runner oficial en QA (`manus_tienda_qa`) y verificar readiness `READY` con un usuario operativo no privilegiado.
