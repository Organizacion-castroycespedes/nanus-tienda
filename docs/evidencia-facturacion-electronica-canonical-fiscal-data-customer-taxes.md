# Evidencia: completitud de datos fiscales canónicos

Fecha: 2026-09-10 UTC  
Rama: `feat/develop/implementando-facturacion-electronica`  
HEAD inicial: `7352ea7`

## Guardas

- QA DB: `manus_tienda_qa`; host `54.242.102.178`; schema `public`.
- Billing runtime: QA local; worker `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- FactuCore health/auth: PASS, pero no hubo llamadas mutantes.
- Candidate `7fa040a9-0703-434d-954c-5f348f2d6544`: antes y después `PENDING`, provider ID `NULL`, provider status `NULL`.
- Segundo PENDING `da862163-c4f3-44c8-92cf-066afc9abcbb`: sin cambios.
- FactuCore create, XML, sign y transmit: `0`.
- Migraciones: `NO`.

## Forensic result

La venta fuente tiene customer y un registro fiscal explícito de tasa cero (`Exento`).
El evento outbox v1 contiene customer, lines, taxes, payments y totals. El inbox
preserva esos campos sin pérdida de transporte. El evento contiene una clasificación
de impuesto de línea con monto cero, pero el arreglo de impuestos documentales es
cero porque el productor anterior solo incluía impuestos cuando `taxAmount > 0`.

El documento histórico no tiene `metadata.electronicBilling`. El servicio actual
ya tenía `buildBillingSnapshotMetadata`, pero no lo usaba al insertar el documento.
Ese era el punto de pérdida del snapshot customer. No se modificó el candidato.

## Root cause

Clasificación primaria: `I. Combination`.

1. `ElectronicBillingService` omitía el helper de snapshot al construir el metadata
   de `electronic_documents`; customer se perdía aunque viajaba por outbox/inbox.
2. `SaleService` descartaba una clasificación fiscal explícita de monto cero; esto
   confundía `Exento` con ausencia de taxes.

El contrato `SALE_COMPLETED_FOR_ELECTRONIC_BILLING` v1 ya soporta customer y taxes.
Decisión: `KEEP V1`; no se agrega DTO FactuCore al API ni se agregan consultas del
Billing Backend a tablas de negocio.

## Fix aplicado

- `ElectronicBillingService` persiste siempre `metadata.electronicBilling.customer`
  y payment desde el comando canónico.
- `SaleService` conserva taxes cuando existe tax identity o rate, incluso con monto
  cero. Un item realmente tax-free, sin identidad ni rate, sigue sin tax snapshot.
- Ambos caminos `createSale()` y `createSaleFromOrderDelivery()` tienen regresión
  para customer y clasificación fiscal.
- Se agregó prueba de persistencia del customer snapshot.
- OpenSpec documenta ownership, decisión v1 y recuperación histórica.

## Recovery

El candidato es `PARTIAL`mente reconstruible: customer existe en inbox, pero la
clasificación fiscal histórica de monto cero no quedó completa en el snapshot
persistido. Recomendación: `NEW CONTROLLED QA SALE`. No reconstruir ni procesar el
candidato en esta fase.

## Validation

- API focused tests: `16 pass, 0 fail`.
- Billing tests: `120 pass, 0 fail`.
- API build: PASS.
- Billing build: PASS.
- OpenSpec relevant strict: PASS.
- OpenSpec all strict: `80 pass, 0 fail`.
- `git diff --check`: PASS.
- Secret/PII leak: NONE observed.
