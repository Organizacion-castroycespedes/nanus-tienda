# Evidencia: recuperación de enlace de proveedor

## Caso controlado

- Venta: `f239f47a-0978-4533-9667-5a72cded3b0c`.
- Documento Manus: `adbf3247-8869-4d23-b96d-9f59dc3d71c0`.
- Documento FactuCore: `1cacf000-93e5-4f31-9efa-368ae13e27ae`.
- Número: `SETP990000007`.
- Bases: `manus_tienda_qa` y `factucore`, esquema `public`.

## Estado antes

FactuCore estaba `ACCEPTED`, con un único intento, un único documento para la referencia externa, y sin mutación pendiente. Manus estaba `PENDING`, con `provider_document_id` nulo y referencia externa exacta.

## Causa

El flujo normal de Manus entra por `ElectronicBillingProcessingService.processDocument()`, llama `issueWithProvider()`, y persiste el resultado en `persistProviderResult()`. La persistencia escribe `provider_document_id`, `provider_status`, CUFE y estado mediante `ElectronicDocumentRepository.updateProviderIdentity()` y `updateStatus()` dentro de la misma transacción local.

La creación FactuCore de este caso ocurrió fuera de ese flujo normal, mediante el harness directo autorizado de la tarea anterior. Por eso FactuCore creó y aceptó el documento, pero Manus nunca recibió/persistió el resultado del proveedor. No hay evidencia de fallo de `persistProviderResult()`; el flujo Manus no fue alcanzado.

## Recuperación segura

El código existente permite `refreshDocumentStatus()` con `provider_document_id` ausente. `FactuCoreProvider.getDocumentStatus()` usa entonces `getStatusByExternalReference()`. El mapper conserva el ID retornado y normaliza `ACCEPTED` a `ACCEPTED`. La persistencia actualiza identidad, estado y limpia error en una transacción.

La prueba determinística confirmó: lookup existente aceptado, cero create, cero XML, cero firma, cero transmisión y cero polling DIAN.

La única recuperación Manus en QA confirmó referencia externa, obtuvo el ID exacto de FactuCore y dejó Manus en `ACCEPTED`. No se modificó FactuCore.

## Estado final

- Manus: `ACCEPTED`.
- Manus `provider_document_id`: `1cacf000-93e5-4f31-9efa-368ae13e27ae`.
- Manus `provider_status`: `ACCEPTED`.
- Manus `last_error`: nulo.
- FactuCore: `ACCEPTED`, un intento, un documento.
- Segundo create: no.
- Segundo envío DIAN: no.
- Reintento, cola, inbox replay y workers: no.

## Validación

- Regresión de recuperación por referencia externa: PASS.
- Suite Billing: `143/143 PASS`.
- Código productivo modificado: no.
- Commit, push y deploy: no.
