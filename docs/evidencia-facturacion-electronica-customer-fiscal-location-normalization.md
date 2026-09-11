# Evidencia: normalización de ubicación fiscal del cliente

Fecha: 2026-09-11

## Hallazgo

- Sale controlada: `3c585eac-2a2a-4a35-a64d-346e07114c57`.
- Su cliente canónico tenía `country_code`, `department_code` y `municipality_code` vacíos.
- La sucursal de la venta está respaldada por el catálogo local como Colombia, Atlántico (`08`) y Barranquilla (`08001`).
- La ubicación fue corregida una vez mediante `PATCH /api/electronic-invoicing/customers/:id`.
- El cliente ahora tiene códigos consistentes: `CO`, `08`, `08001`.

## Propagación observada

| Capa | departmentCode | municipalityCode |
|---|---|---|
| Cliente canónico antes | faltante | faltante |
| Outbox inmutable | faltante | faltante |
| Inbox inmutable | faltante | faltante |
| Documento Manus inmutable | faltante | faltante |
| Cliente canónico después | presente | presente |

La primera pérdida fue el dato canónico ausente. Los snapshots existentes no se modificaron.

## Seguridad e invariantes

- Sale: no modificada.
- Outbox: no modificada.
- Inbox: no modificada.
- Documento electrónico: no modificado y permanece `PENDING`.
- FactuCore create/XML/sign/transmit: `0`.
- DIAN calls: `0`.
- Documento rechazado anterior: no tocado.
- Workers: deshabilitados.

## Validación

- Customer/location tests: PASS.
- Billing suite: `142/142 PASS`.
- API build: PASS.
- Billing build: PASS.
- Payment normalization: PASS (`CASH` → `10`/`1`).

## Próximo paso

No reutilizar la venta ni sus snapshots incompletos. Crear una nueva venta solo en otra tarea, después de confirmar la ubicación fiscal completa.
