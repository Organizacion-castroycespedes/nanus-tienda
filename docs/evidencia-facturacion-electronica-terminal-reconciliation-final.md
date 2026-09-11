# Evidencia: cierre de reconciliación terminal

## Alcance

Se verificó el estado terminal del documento existente y se ejecutó una sola reconciliación Manus. No se creó documento, no se transmitió, no se consultó DIAN y no se alteró el documento FactuCore.

## Pipeline verificado

El GET autenticado QA a `/api/v1/external/documents/:id/status` respondió HTTP 200 con estado `REJECTED`. El servicio Manus usó el mismo identificador de proveedor, obtuvo estado canónico `REJECTED` y persistió la reconciliación terminal.

## Resultado

- Documento Manus: `af28bfb8-cbf2-437a-988a-f534374bd6e9`.
- Documento FactuCore: `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- FactuCore: `REJECTED`.
- Manus después de reconciliar: `REJECTED`.
- `provider_document_id` preservado.
- CUFE de Manus no quedó expuesto por el resultado sanitizado; no se modificó.
- Conteo de intentos de transmisión: 1.
- Conteo de documentos del proveedor: 1.

## Seguridad

Se mantuvieron deshabilitados los workers FactuCore y Manus. PG-BOSS permaneció quiescente. No hubo CREATE, XML, SIGN, TRANSMIT, polling DIAN, retry ni redispatch.

## Pago futuro

La normalización `CASH -> paymentMeansCode "10" / paymentMeansId "1"` permanece cubierta por pruebas. El documento rechazado no es reutilizable ni retransmisible.
