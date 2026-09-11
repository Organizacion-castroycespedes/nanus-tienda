# Evidencia: retry único y captura de `failedChecks`

## Resultado de seguridad

- Se ejecutaron los guards read-only antes de la recuperación.
- QA billing runtime: `manus_tienda_qa`.
- Manus worker: deshabilitado.
- FactuCore background jobs: deshabilitados; pg-boss sin actividad automática observada.
- FactuCore authenticated GET: HTTP 200.
- External reference: HTTP 404 (`NOT FOUND`).

## Recuperación controlada

Se hizo una sola invocación del servicio productivo `ElectronicBillingProcessingService.retryDocument(...)` para el documento autorizado. La invocación fue bloqueada por la política productiva porque el documento real estaba en `REJECTED`, mientras `retryDocument` acepta `TECHNICAL_ERROR`; no se ejecutó ningún provider POST.

La decisión fue segura: no se modificó el estado con SQL, no se creó documento, no se generó XML, no se firmó y no se transmitió.

## Estado proveedor

- FactuCore create: 0 llamadas en esta fase.
- Generate XML: 0.
- Sign: 0.
- Transmit: 0.
- Documentos FactuCore para la referencia externa: 0.
- Documento Manus: sin nuevo procesamiento y sin `provider_document_id`.

## Validaciones

- `FactuCoreClient` conserva `providerCode`, paths y razones de `failedChecks`.
- La prueba de cliente valida paths concretos y redacción.
- La prueba de procesamiento valida el resumen seguro de paths.
- Billing suite: 137/137 PASS.
- FactuCore filter test: PASS.
- Billing build: PASS.
- FactuCore build: PASS.
- OpenSpec all strict: 80/80 PASS.
- Secret leak: NONE.

## Conclusión

La captura estructurada está lista. El retry E2E queda `NOT REACHED` en esta fase porque el estado persistido no es elegible para `retryDocument`; no se debe forzar ni repetir la operación. Workers permanecen deshabilitados.
