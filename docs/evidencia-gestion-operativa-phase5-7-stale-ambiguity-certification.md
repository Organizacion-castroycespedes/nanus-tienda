# Evidencia - Gestion Operativa Phase 5.7

## Resultado

Se cerro un hueco de seguridad: `retryDocument()` ya no crea un documento
cuando el lookup por `external_reference` devuelve `NOT_FOUND` sin evidencia
durable de que la mutacion provider nunca comenzo.

El retry API y la UI siguen diferidos.

## Evidencia persistente actual

| Etapa | Evidencia actual | Confiable para reintento |
|---|---|---:|
| Antes de provider create | `status`, `provider_document_id`, `external_reference` | No por si sola |
| Provider create intentado | error y evento, si fueron persistidos | Parcial |
| Provider create exitoso | `provider_document_id` o lookup externo | Si se recupera |
| XML / firma | no hay etapa persistida separada | No |
| Transmision iniciada | `sent_at` no prueba el instante de inicio | No |
| Transmision desconocida | no hay estado persistido separado | No |

La ausencia de `provider_document_id` no prueba ausencia de una solicitud
externa. El modelo actual no representa de forma separada
`OUTCOME_UNKNOWN` para transmision.

## Regla aplicada

1. Procesamiento normal puede emitir un documento nuevo.
2. Recuperacion con provider existente reconcilia primero.
3. Retry tecnico sin prueba pre-provider aprobada falla cerrado.
4. `NOT_FOUND` despues de una operacion potencialmente ambigua no crea ni
   transmite.
5. `ACCEPTED`, rechazo fiscal final y `CANCELLED` no regresan de estado.

El cambio esta en:

`backend-facturacion-electronica/src/modules/electronic-billing/services/electronic-billing-processing.service.ts`

## Mock persistente

Las pruebas usan estado del provider conservado entre llamadas:

- timeout despues de persistir provider: recupera por referencia y mantiene
  un solo create;
- timeout sin provider encontrado: no ejecuta create;
- crash local despues de create: recupera el link sin crear de nuevo.

No se usaron FactuCore live ni DIAN.

## Pruebas

- Focused Billing: `24/24 PASS` despues del cambio.
- Suite Billing completa: `152 PASS, 5 SKIPPED` en la ejecucion actual.
- PostgreSQL real Phase 5.5: `5/5 PASS`, cuatro sesiones independientes.
- API regression: `21/21 PASS` baseline.
- Billing build: `PASS`.
- API build: `PASS`.
- `git diff --check`: `PASS`.

Los cinco skips son integraciones locales que requieren la base disposable
`manus_billing_concurrency_test` en `localhost:55432`. No son fallos de
producto.

## Casos no certificables aun

- crash antes de provider create con prueba durable positiva;
- crash antes de transmit;
- timeout de transmit con estado `ACCEPTED`, `REJECTED`, `PROCESSING`,
  `PENDING`, `NOT_FOUND` o provider caido en una interfaz separada;
- carrera refresh/stale integrada con dos conexiones y el flujo completo.

La causa es contractual: el provider actual expone `issueInvoice()` como una
operacion agregada. No separa create, XML, firma y transmision. No se agrega
migracion especulativa.

## Estado final

- `PRE-CREATE PERSISTENCE PROOF`: `INSUFFICIENT`.
- `CREATE ATTEMPT DURABLE MARKER`: `NO`.
- `TRANSMISSION ATTEMPT DURABLE MARKER`: `NO`.
- `CURRENT PERSISTENCE MODEL`: `INSUFFICIENT` para certificar ambiguedad de
  transmision.
- `DB MIGRATION`: `NONE` aplicada.
- `SAFE RETRY CONTRACT`: `PARTIAL`.
- `RETRY API`: `DEFERRED`.
- `RETRY UI`: `DEFERRED`.

## Seguridad

- Remote QA: `NO`.
- PROD: `NO`.
- Live FactuCore mutations: `0`.
- DIAN calls: `0`.
- QA business mutations: `0`.
- No secrets, headers, hashes ni dumps.
