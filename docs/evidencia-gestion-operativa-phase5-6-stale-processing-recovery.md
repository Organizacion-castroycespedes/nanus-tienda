# Evidencia — Gestión Operativa Phase 5.6

## State model

| Estado stale | Acción segura | Crear provider | Transmitir | Reconciliar | Revisión manual |
|---|---|---:|---:|---:|---:|
| `STALE_BEFORE_PROVIDER_CREATE` | continuar solo con evidencia pre-provider | Sí, máximo una vez | Solo por flujo normal probado | Sí | No |
| `STALE_PROVIDER_CREATE_AMBIGUOUS` | consultar por referencia externa | No antes de lookup | No | Sí | Sí si no se resuelve |
| `STALE_PROVIDER_LINK_MISSING_BUT_EXTERNAL_EXISTS` | recuperar vínculo y estado | No | No inmediato | Sí | No |
| `STALE_PROVIDER_LINKED_PRE_TRANSMIT` | leer estado existente | No | No sin evidencia de cero intentos | Sí | Sí |
| `STALE_TRANSMISSION_AMBIGUOUS` | `RECONCILE_FIRST` | No | No | Sí | Sí |
| `STALE_PROVIDER_ACCEPTED` | persistir `ACCEPTED` | No | No | Sí | No |
| `STALE_PROVIDER_REJECTED` | persistir rechazo final | No | No | Sí | No |
| `STALE_UNKNOWN` | fail closed | No | No | No | Sí |

## Recovery real local

Se ejecutaron provider mocks contra el `ElectronicBillingProcessingService`:

- stale con provider `ACCEPTED`: reconciliación, CUFE/estado preservados,
  cero create y cero retry.
- stale con provider `REJECTED`: rechazo final, cero create y cero retry.
- vínculo ausente con `external_reference`: vínculo recuperado, cero create.
- provider no encontrado: falla segura, cero create.
- respuesta stale no regresa documento `ACCEPTED` a `PROCESSING`.

Resultado de servicio: `21/21 PASS`.

## PostgreSQL

La prueba local Phase 5.5 verificó cinco casos reales con conexiones
independientes: lock del mismo documento, lock del servicio en 10 iteraciones,
paralelismo entre documentos/tenants, liberación por desconexión y claim de
lease vencido. Resultado: `5/5 PASS`.

El worker detecta stale cuando `last_status_check_at` es `NULL` o menor/igual
que `dueBefore`, y extiende el lease con `leaseMs`. No existe heartbeat.

## Límite de certificación

No se ejecutó provider live, DIAN ni documento fiscal real. Los casos de crash
después de create, link y transmit se cubren con política y mocks unitarios,
pero falta una prueba integrada que combine fila PostgreSQL real, persistencia
fallida y provider mock persistente. Por eso retry API/UI siguen diferidos.

## Invariantes

- FactuCore live mutations: `0`.
- DIAN calls: `0`.
- QA business mutations: `0`.
- Segundo provider por `external_reference`: bloqueado por lookup previo.
- Transmisión ambigua: nunca retransmitir sin reconciliar.
- `ACCEPTED`, rechazo final y `CANCELLED`: no regresan a procesamiento.

## Próximo paso

Construir un harness integrado con base PostgreSQL disposable y provider mock
persistente para simular fallas de persistencia exactamente después de create,
link y transmit. No exponer retry hasta cerrar esos casos.
