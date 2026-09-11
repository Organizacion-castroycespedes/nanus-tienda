# Evidencia: transmisión DIAN controlada de SETP990000007

## Alcance

- Sale autorizada: `f239f47a-0978-4533-9667-5a72cded3b0c`.
- Documento Manus: `adbf3247-8869-4d23-b96d-9f59dc3d71c0`.
- Documento FactuCore: `1cacf000-93e5-4f31-9efa-368ae13e27ae`.
- Entorno: FactuCore `development` con `DIAN_ENVIRONMENT=habilitacion`.
- No se procesaron otros documentos.

## Precondiciones

- FactuCore estaba en `SIGNED`.
- Existía un único documento para la referencia externa.
- `TransmissionAttempt` era `0`.
- El artefacto firmado era legible y no vacío.
- Preflight de transmisión: listo.
- XML verificado estructuralmente: `PaymentMeans/ID=1`, `PaymentMeansCode=10`, departamento `08`, municipio `08001`.
- Trabajadores globales permanecieron deshabilitados; PG-BOSS permaneció quiescente.

## Envío único

- Método: `DocumentsService.executeTransmission()` interno, con actor QA y documento en allowlist exacta.
- Invocaciones: `1`.
- Cliente DIAN ingresó: sí.
- Solicitud saliente inició: sí.
- Respuesta recibida: sí.
- Endpoint público y cola: no usados.
- Resultado persistido: `ACCEPTED`.
- Código de respuesta persistido: `100`.
- Identificador externo: presente.
- El mensaje técnico persistido fue sanitizado; no se registran XML, SOAP, credenciales ni tokens.

## Persistencia posterior

- FactuCore: `ACCEPTED`.
- Intentos: `1`.
- `sentAt`: presente.
- `acceptedAt`: presente.
- `rejectedAt`: ausente.
- Conteo del documento por referencia externa: `1`.
- Duplicado: no.
- Evento `TRANSMISSION_REQUESTED`: pasó de `0` a `1`; corresponde a la auditoría posterior de la transmisión y no programó un segundo envío.
- GET autenticado de estado FactuCore: `1`; devolvió `ACCEPTED` para el mismo documento.

## Reconciliación Manus

No se ejecutó reconciliación (`0`). La fila Manus indicada por el usuario, en la base QA activa, estaba `PENDING` y no tenía `provider_document_id`. El guard de reconciliación falló de forma segura; no se intentó forzar una actualización sin identidad del proveedor.

Esto deja pendiente la sincronización terminal Manus. No se hizo retry ni segundo envío. El documento FactuCore permanece aceptado y con un solo intento.

## Invariantes

- Crear: `0`.
- Generar XML: `0`.
- Firmar: `0`.
- Transmisiones directas: `1`.
- Poll DIAN: `0`.
- Otros documentos procesados: `0`.
- Commit, push y deploy: no realizados.
