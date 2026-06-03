# Evidencia FE-3.11 - Frontend suppliers fiscal-ready

Fecha: 2026-06-03

## Alcance ejecutado

- Se agrego servicio frontend para `/electronic-invoicing/suppliers`.
- Se actualizo el listado `/[tenant]/suppliers` para mezclar catalogo legacy `/suppliers` con datos fiscales de `/electronic-invoicing/suppliers`.
- Se agrego badge de estado fiscal:
  - `Validado fiscal`
  - `Pendiente`
  - `Manual`
  - `Fallido`
- Se extendio `SupplierForm` con datos fiscales:
  - `dianIdentificationType`
  - `identificationNumber`
  - `verificationDigit`
  - `legalName`
  - `tradeName`
  - `invoiceEmail`
  - `countryCode`
  - `departmentCode`
  - `municipalityCode`
  - `personType`
  - `taxRegime`
  - `taxResponsibilities`
  - `fiscalDataSource`
  - `fiscalStatus`
  - `isDianValidated`
- Se agrego boton `Consultar datos fiscales mock` usando provider-agnostic supplier lookup.
- Se muestra preview seguro con estado, provider, codigo, cantidad de campos y mensaje.
- Se permite seleccionar campos del preview y aplicar solo esos campos.
- Se bloquea overwrite de datos manuales hasta confirmacion explicita.
- En edicion, aplicar preview usa `POST /electronic-invoicing/suppliers/:id/apply-lookup`.
- En creacion, aplicar preview actualiza el formulario antes de guardar.
- Se excluyo `DIAN_DIRECT` de las opciones de suppliers para no activar GetAcquirer real en proveedores.

## Archivos modificados

- `web/app/[tenant]/suppliers/page.tsx`
- `web/modules/inventory/components/SupplierForm.tsx`
- `web/modules/inventory/services/supplier.service.ts`
- `web/modules/electronic-invoicing/services/supplier.service.ts`
- `openspec/changes/dian-terceros-clientes-proveedores-fe-3/tasks.md`

## Validaciones

| Comando | Resultado |
| --- | --- |
| `cd web && npm.cmd run lint` | PASS con warnings existentes fuera del alcance |
| `cd web && npm.cmd run build` | PASS con warnings existentes fuera del alcance |
| `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict` | PASS |
| `git diff --check` | PASS |

## Fuera de alcance confirmado

- No GetAcquirer real para suppliers.
- No SOAP real.
- No certificados P12/PFX.
- No backend salvo bug minimo.
- No SQL.
- No POS.
- No pricing.
- No Orders.
- No PRD.
- No remoto.
- No commit.

## Riesgos

- Usuarios sin permiso `ELECTRONIC_INVOICING_SUPPLIERS` pueden ver solo catalogo legacy y warning fiscal.
- La creacion usa endpoint fiscal y luego actualiza datos legacy de contacto/ubicacion; si la segunda llamada falla, el proveedor puede quedar creado sin ubicacion comercial legacy.
- No hubo smoke visual autenticado en esta ejecucion; la evidencia principal es lint/build y contrato frontend.
