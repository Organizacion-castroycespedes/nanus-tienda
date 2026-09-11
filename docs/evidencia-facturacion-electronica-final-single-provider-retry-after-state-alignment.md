# Evidencia: retry único tras alinear la máquina de estados

## Guards

- QA database: `manus_tienda_qa`.
- Manus worker: disabled.
- FactuCore background jobs: disabled.
- FactuCore health: PASS.
- Authenticated GET: PASS.
- External reference preflight: `NOT FOUND`.
- Tenant mapping and provider context: PASS.

## Retry controlado

Se ejecutó exactamente una invocación de `ElectronicBillingProcessingService.retryDocument(...)` para el documento autorizado. El flujo llegó a FactuCore create y recibió HTTP 400.

Resultado sanitizado:

```text
code: DIAN_READINESS_VALIDATION
failedChecks:
- cityName: adquirente sin ciudad configurada
- departmentCode: adquirente sin código de departamento configurado
- departmentName: adquirente sin departamento configurado
- countryName: adquirente sin país configurado
```

No se muestran valores reales. El resumen quedó persistido de forma acotada en `last_error_message`.

## Provider calls

- Create: 1.
- Generate XML: 0.
- Sign: 0.
- Transmit: 0.
- Provider documents for the external reference: 0.
- Duplicate provider document: NO.

El create falló antes de crear un documento remoto. No hubo segundo create ni retry adicional.

## Manus state

- Status final: `REJECTED`.
- `provider_document_id`: NULL.
- `provider_status`: NULL.
- `last_error_code`: `FACTUCORE_VALIDATION`.
- `last_error_message`: contiene el resumen seguro de los cuatro checks.

La auditoría del documento conserva la nueva tentativa individual; existen eventos históricos de fases anteriores, no generados por este intento.

## Resultado

La máquina de estados permitió correctamente el caso pre-provider. El payload todavía falla una validación interna DIAN de FactuCore relacionada con ubicación del adquirente. Esta fase termina sin parchear ni reintentar otra vez. Workers permanecen deshabilitados.
