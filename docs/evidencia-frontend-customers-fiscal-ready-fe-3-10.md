# Evidencia FE-3.10 - Frontend customers fiscal-ready

Fecha: 2026-06-03  
Rama: `feat/frontend-customers-fiscal-ready-fe-3-10`

## Alcance ejecutado

- Se actualizo el listado `/[tenant]/customers` para mezclar catalogo legacy `/customers` con datos fiscales de `/electronic-invoicing/customers`.
- Se agrego badge de estado fiscal con los estados operativos:
  - `Validado DIAN`
  - `Pendiente`
  - `Manual`
  - `Consumidor Final`
- Se extendio `CustomerForm` con datos fiscales:
  - `dianIdentificationType`
  - `identificationNumber`
  - `verificationDigit`
  - `legalName`
  - `tradeName`
  - `invoiceEmail`
  - `phone`
  - `address`
  - `countryCode`
  - `departmentCode`
  - `municipalityCode`
  - `personType`
  - `taxRegime`
  - `taxResponsibilities`
  - `fiscalDataSource`
  - `isDianValidated`
  - `fiscalStatus`
- Se agrego boton `Consultar DIAN` usando el lookup mock existente de customers.
- Se muestra preview seguro con provider, estado, codigo, mensaje y campos normalizados.
- Se permite seleccionar campos del preview y aplicarlos.
- Se bloquea overwrite de datos manuales hasta marcar confirmacion explicita.
- En edicion, aplicar preview usa `POST /electronic-invoicing/customers/:id/apply-lookup`.
- En creacion, aplicar preview solo actualiza formulario antes de guardar.
- Se protege `Consumidor Final`:
  - boton eliminar deshabilitado en listado;
  - intento de delete retorna mensaje de proteccion;
  - checkbox `Cliente activo` queda bloqueado en formulario.

## Archivos modificados

- `web/app/[tenant]/customers/page.tsx`
- `web/modules/inventory/components/CustomerForm.tsx`
- `web/modules/electronic-invoicing/services/customer.service.ts`
- `web/modules/inventory/services/customer.service.ts`
- `openspec/changes/dian-terceros-clientes-proveedores-fe-3/tasks.md`

## Validaciones

| Comando | Resultado |
| --- | --- |
| `cd web && npm.cmd run lint` | PASS con warnings existentes fuera del alcance |
| `cd web && npm.cmd run build` | PASS con warnings existentes fuera del alcance |
| `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict` | PASS |
| `git diff --check` | PASS |

## Fuera de alcance confirmado

- No DIAN real.
- No certificados P12/PFX.
- No backend.
- No SQL.
- No POS venta.
- No pricing.
- No Orders.
- No PRD.
- No remoto.
- No commit.

## Riesgos

- El modulo customers ahora consume datos fiscales desde `electronic-invoicing/customers`; usuarios sin permiso fiscal pueden ver solo catalogo basico con warning.
- La creacion usa endpoint fiscal y luego actualiza datos legacy de contacto/ubicacion; si la segunda llamada falla, el cliente fiscal puede quedar creado sin ubicacion comercial legacy.
- No hubo smoke visual con API local autenticada en esta ejecucion; la evidencia es build/lint y revision de contrato frontend.
