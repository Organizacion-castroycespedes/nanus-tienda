# Evidencia: propagación de `failedChecks` de FactuCore

## Alcance

- Fase sin provider POST.
- Documento controlado no procesado.
- FactuCore background jobs y Manus billing worker permanecen deshabilitados.
- No hubo migraciones ni mutaciones de proveedor.

## Contrato FactuCore

El `HttpExceptionFilter` responde, para readiness DIAN, con los campos seguros:

```text
statusCode
message
code = DIAN_READINESS_VALIDATION
failedChecks[] = { entity, path, reason }
```

Los paths y razones no contienen valores de configuración, credenciales ni datos completos del cliente.

## Punto de pérdida

Antes del cambio, `FactuCoreClient.extractFactuCoreValidationDetails()` recorría `message`, `detail`, `children`, `errors`, `details` y `response`, pero no recorría `failedChecks`. Por eso el filtro podía preservar el detalle y el cliente lo convertía en un error genérico sin paths exactos.

## Corrección

- El cliente recorre `failedChecks` y `reason`.
- Cuando existe `failedChecks`, usa esa colección como fuente principal y no mezcla el mensaje genérico superior.
- `FactuCoreValidationError` conserva `validationDetails` y el `providerCode` seguro.
- El código de clasificación continúa siendo `FACTUCORE_VALIDATION`; `DIAN_READINESS_VALIDATION` queda como código del proveedor.
- La salida queda acotada a 20 detalles y 300 caracteres por razón; el mensaje compuesto queda acotado a 2000 caracteres.
- Se omiten claves sensibles y se redactan valores con forma de secreto.
- No se conserva el request ni el candidate completo.

## Propagación verificada

La prueba de cliente valida paths concretos (`customer.cityName` y `lines[0].taxes[0].rate`), razones, código de proveedor, límite y redacción. La prueba de procesamiento valida que los paths llegan al error de procesamiento y al resumen seguro persistible en `last_error_message`.

## Validación

- FactuCore focused filter test: PASS.
- FactuCore build: PASS.
- Billing suite: 137/137 PASS.
- Targeted client/provider/processing suite: 40/40 PASS.
- OpenSpec all strict: 80/80 PASS.
- Provider POST adicional: 0.
- Generate XML, sign, transmit: 0.
- Documento controlado: sin cambios; `provider_document_id` permanece NULL.
- FactuCore provider document count: 0.
- Secret leak: NONE.
- PII leak: NONE.

## Resultado

La observabilidad estructurada queda disponible desde la respuesta HTTP hasta `FactuCoreClient`, `FactuCoreProvider`, `ProcessingService` y el resumen del harness, sin agregar migraciones y sin ejecutar recuperación real.
