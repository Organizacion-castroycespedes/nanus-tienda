# Diagnóstico del límite de transmisión FactuCore

Fecha de revisión: 2026-09-10

## Alcance y seguridad

- Investigación de código y consultas `SELECT` solamente.
- Base FactuCore identificada como `factucore`, esquema `public`, en el entorno QA local autorizado.
- Base Manus identificada como `manus_tienda_qa`, esquema `public`, usuario `manus_user`.
- `FACTUCORE_BACKGROUND_JOBS_ENABLED=false`.
- No se ejecutaron llamadas DIAN, creación, XML, firma, transmisión, polling ni jobs.
- No se modificaron documentos, colas ni datos QA.

## Documento controlado

- FactuCore document ID: `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Número: `SETP990000006`.
- Estado leído: `SIGNED`.
- `sentAt`: ausente.
- `acceptedAt`: ausente.
- `transmission_attempts`: cero filas.
- Evento `TRANSMISSION_REQUESTED`: presente, con payload estructural `queued=true`.
- El documento mantiene un solo registro de proveedor y no presenta duplicado.

## Call graph real

```text
ExternalDocumentsController.transmit
  -> DocumentsService.transmitByApiClient
  -> DocumentsService.transmitWithActor
  -> DocumentsService.queueTransmission
  -> TransmissionDispatchDriver.schedule
  -> (in_process: setTimeout) o (pg_boss: boss.send)
  -> DocumentsService.executeQueuedTransmission
  -> DocumentsService.executeTransmission
  -> TransmissionService.transmitDocument
  -> DocumentTransmissionProvider.transmit
  -> DIAN SOAP transport
  -> transmissionAttempt + document/status persistence
```

`transmitWithActor` no llama DIAN. Primero registra la intención y retorna una respuesta con `queued=true`.

## Driver y flag

El módulo selecciona `TRANSMISSION_DISPATCH_DRIVER`; el valor por defecto es `in_process`. El archivo QA no define un driver alternativo. El driver `in_process` usa un `setTimeout` y no consulta DIAN directamente. El driver `pg_boss` hace `boss.send` y registra el worker con `boss.work`.

`FACTUCORE_BACKGROUND_JOBS_ENABLED=false` detiene la inicialización y el consumo del driver `pg_boss`. No cambia el método `queueTransmission` ni convierte `TRANSMISSION_REQUESTED` en una transmisión real. En esta instancia no se encontró un job en `pgboss.job` ni en `pgboss.job_common` para el documento; por tanto no hay evidencia de un job durable pendiente.

## Evidencia actual y dorada

El documento controlado tiene:

| Evidencia | SETP990000006 | Aceptados dorados |
|---|---:|---:|
| `TRANSMISSION_REQUESTED` | PRESENT | PRESENT |
| Job pg-boss localizable | MISSING | UNKNOWN |
| Ejecución de worker | MISSING | UNKNOWN |
| `TransmissionAttempt` | MISSING | PRESENT |
| Respuesta de transporte | MISSING | PRESENT |
| CUFE/UUID fiscal persistido | PRESENT en FactuCore | PRESENT |
| Estado final | `SIGNED` | `ACCEPTED` |

Los documentos `SETP990000005`, `SETP990000003` y `SETP990000002` tienen intentos de transmisión persistidos. Sus eventos incluyen una intención inicial y eventos posteriores de respuesta. Esto demuestra que un `TRANSMISSION_REQUESTED` aislado no significa que el transporte haya finalizado.

## Semántica de `TRANSMISSION_REQUESTED`

El evento se crea en `queueTransmission`, con título de transmisión programada y `payload.queued=true`. En `executeTransmission` también se crea un evento con el mismo tipo después de obtener la respuesta del proveedor, junto con `TRANSMISSION_RESPONSE_RECEIVED`. Por código, el evento inicial significa solicitud/encolamiento; no prueba envío a DIAN.

## Intento y transporte

`TransmissionAttempt` se inserta después de que `TransmissionService.transmitDocument` retorna. Si el worker no ejecuta, no existe intento. Si el transporte falla antes de retornar, tampoco queda intento. Así, cero intentos prueba que no hubo respuesta de transporte persistida; no prueba por sí solo que ningún paquete salió de FactuCore.

Para `SETP990000006` no existe intento, respuesta, `sentAt` ni acuse DIAN. La conclusión segura es: transmisión DIAN no ejecutada o no demostrable; no debe marcarse como enviada.

## Tracking e idempotencia

El job usa `documentId` como ID y `singletonKey` en pg-boss. La identidad de documento y la `externalReference` protegen la creación duplicada. El `externalTrackingId` se persiste desde `transmissionResult.externalId`, después del transporte; un identificador previo o de correlación no prueba recepción DIAN.

La prevención de un segundo envío existe parcialmente por estado, último intento y clave singleton. No se ejecutó ninguna acción para probarla en vivo.

## Método seguro para la siguiente fase

El núcleo por documento existe internamente como `executeQueuedTransmission(job)` y aplica guardas de tenant, estado y XML firmado antes de llamar `executeTransmission`. La ejecución aislada de ese núcleo no fue realizada en esta tarea. Si no existe job durable, la siguiente fase debe autorizar explícitamente una invocación controlada del núcleo por documento, con contadores y guardas; no debe llamar nuevamente al endpoint público ni activar el worker global.

Clasificación recomendada: `CALL_SINGLE_DOCUMENT_TRANSMISSION_CORE`, pendiente de autorización separada.

## Resultado

- Límite de transmisión: entendido.
- `TRANSMISSION_REQUESTED`: solicitud encolada, no envío confirmado.
- Impacto de aislamiento: confirmado como bloqueo del consumo de jobs cuando se usa pg-boss; la instancia actual además usa por defecto `in_process`, por lo que la ausencia de intento requiere una revisión del fallo/estado del proceso anterior, no una afirmación automática de job pg-boss.
- No se hizo cambio de código.
- No se hizo mutación externa.
