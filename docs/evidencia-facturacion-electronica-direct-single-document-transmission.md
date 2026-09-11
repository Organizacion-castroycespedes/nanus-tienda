# Transmisión directa de un documento FactuCore

Fecha: 2026-09-10

## Resultado

- Documento permitido: `33b68113-0737-4492-9bf4-ccbe84ccb58c` (`SETP990000006`).
- Guardas QA, rotación de credencial, conexión DB, health y GET autenticado: PASS.
- Artefacto firmado: presente y validado por preflight.
- Método único invocado: `DocumentsService.executeTransmission()`.
- La invocación terminó antes de leer el artefacto firmado porque el harness usó por error el `storageRoot` relativo al directorio Manus.
- Error seguro: `ENOENT` para el archivo local del XML firmado.
- Cliente DIAN: no alcanzado.
- Request DIAN: no iniciado.
- Response DIAN: no recibido.
- No se creó `TransmissionAttempt`.

## Invariantes posteriores

- Estado FactuCore: `SIGNED`.
- `TransmissionAttempt`: `0`.
- Evento `TRANSMISSION_REQUESTED`: sin evento nuevo; permanece el existente.
- Documento de provider: `1`.
- Duplicado: no.
- No hubo XML nuevo, firma nueva, polling, queue, endpoint público ni reconciliación Manus.
- Workers permanecen deshabilitados y pg-boss permanece quiescente.

## Seguridad

- Credencial QA rotada y conexión posterior validada.
- No se imprimieron secretos, headers ni payloads.
- No se tocó PROD.

## Decisión

La transmisión controlada no está completa. La única invocación permitida se consumió en un fallo de configuración del harness. No se hará una segunda invocación en esta tarea. Corregir el `storageRoot` del harness requiere una autorización separada y una nueva ventana controlada.
## Harness Fix + CUFE Provenance

- Controlled provider document: `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Runtime storage configuration uses `STORAGE_ROOT`, then `STORAGE_LOCAL_PATH`, then the relative default `storage`.
- The production runtime resolves the default under `D:/Profe/Factucore/backend/storage`.
- Correct runtime artifact resolution passed without regenerating the signed XML. The signed artifact was present, readable, non-empty, and linked to the controlled document.
- The previous harness failed because its working directory was `D:/Profe/manus-tienda`, so relative `storage` resolved in the wrong repository.
- The document UUID/CUFE is persisted during XML generation from the DIAN document-key calculation. It does not prove DIAN acceptance and does not require a DIAN response.
- The earlier missing-CUFE reports referred to a different reporting path; the FactuCore document UUID is currently present.
- Read-only transmission preflight passed: signed artifact, issuer, resolution, DIAN configuration, software configuration, status, and zero prior attempts.
- Direct-send authorization was not completed. Source inspection proves `DocumentsService.executeTransmission()` creates a new `TRANSMISSION_REQUESTED` event after a provider response. The task required that event count remain unchanged, so the send was blocked rather than bypassing the invariant.
- Provider calls: create 0, XML 0, sign 0, transmit 0, status poll 0.
- Validation: `git diff --check` completed without whitespace errors. Requested npm-based FactuCore tests/build could not start because the sandbox could not access the configured `npm.cmd` path; no provider-facing test was run.

## Transmission Event Contract

- `TRANSMISSION_REQUESTED` is an overloaded audit event, not a unique transmission-request key.
- `queueTransmission()` creates it when scheduling a public request.
- `executeTransmission()` creates it after a provider response, together with `TRANSMISSION_RESPONSE_RECEIVED`.
- `executeRefreshStatusCore()` also creates it for status refreshes.
- Therefore multiple events are legitimate lifecycle/audit entries. Event count is not used as the idempotency guard; attempt/status/provider identity are the relevant guards.
- A second audit event alone does not send to DIAN. A second `executeTransmission()` invocation does send because the current method has no event-count guard and calls the provider before writing its event.
- The controlled send remains blocked because the task requires the event count to remain unchanged; no production code was changed.
- Event contract was later confirmed: the prior count invariant was too strict. One guarded direct `executeTransmission()` invocation was then performed for the controlled provider document. The provider returned sanitized fiscal rejection code `99`; FactuCore persisted one `REJECTED` transmission attempt and the second lifecycle audit event. No second invocation was made.
- Manus status reconciliation was invoked once after the provider state changed. The provider lookup still reported nonterminal `SIGNED`, so Manus remained `PROCESSING`; no retry or retransmission followed.
- Final provider identity remained one document with no duplicate. Outbox remained intentionally `PENDING` and was not redispatched.
- Final call counts: create 0, XML 0, sign 0, transmit 1, status poll 0, queue schedule 0.
