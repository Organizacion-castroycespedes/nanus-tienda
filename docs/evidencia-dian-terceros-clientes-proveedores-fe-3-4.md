# Evidencia FE-3.4 POS quick customer fiscal form

## Alcance implementado

Se agrego en POS un flujo rapido para cliente fiscal:

- buscar cliente existente cargado en POS;
- seleccionar cliente existente para la venta;
- crear cliente fiscal rapido;
- consultar mock fiscal;
- seleccionar campos confirmados;
- aplicar lookup mock sobre cliente existente;
- crear cliente y aplicar lookup mock;
- seleccionar automaticamente el `customerId` para la venta.

## UX POS

En el selector de cliente del POS aparece la accion `Cliente fiscal`.

El modal `Cliente fiscal rapido` tiene dos zonas:

- `Buscar cliente`: filtra clientes por nombre, documento, email o telefono y permite usar el cliente en la venta.
- `Datos rapidos` + `Mock DIAN`: permite digitar documento, consultar mock, revisar preview y confirmar campos.

El boton `Consumidor Final` sigue disponible en el selector. La venta no queda bloqueada si el usuario no abre el flujo fiscal.

## No overwrite

Los campos devueltos por mock se muestran como checkboxes.

El frontend envia `fieldsToApply` solo con campos confirmados.

Para cliente existente, los campos visibles con valor manual no quedan preseleccionados por defecto.

## Mock falla o esta desactivado

Si lookup mock devuelve `SKIPPED`, `NOT_FOUND` o falla, el modal muestra estado y permite crear cliente manual con los datos digitados.

## Contrato backend minimo

Se amplio `RequirePermission` para aceptar varios `menuKey`.

Los endpoints necesarios de customers fiscales aceptan permiso de `ELECTRONIC_INVOICING_CUSTOMERS` o `POS`:

- `POST /api/electronic-invoicing/customers`
- `POST /api/electronic-invoicing/customers/lookup`
- `POST /api/electronic-invoicing/customers/:id/apply-lookup`

Esto evita que el cajero POS quede bloqueado si no tiene el menu fiscal separado.

## Servicios frontend

Nuevo servicio:

- `web/modules/electronic-invoicing/services/customer.service.ts`

Funciones:

- `lookupElectronicInvoicingCustomer`
- `createElectronicInvoicingCustomer`
- `applyElectronicInvoicingCustomerLookup`

## Validaciones ejecutadas

```powershell
cd web
npm.cmd run lint
npm.cmd run build

cd api
npm.cmd run build
npx.cmd tsx --test src/common/guards/permissions.guard.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.controller.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts
```

Resultados:

- Web lint: pass con warnings existentes no relacionados.
- Web build: pass con warnings existentes no relacionados.
- API build: pass.
- API tests especificos: 32 pass, 0 fail.

## Fuera de alcance confirmado

- No SOAP real.
- No certificados.
- No SQL.
- No pricing.
- No Orders.
- No facturacion electronica real.
- No PRD.
- No remoto.
- No commit.

## Riesgos

- El modal depende de que `DIAN_THIRD_PARTY_LOOKUP_ENABLED=true` y `DIAN_THIRD_PARTY_LOOKUP_MODE=mock` esten activos para preview mock.
- El refresh posterior usa `/customers`; si ese catalogo falla, POS conserva el cliente creado por fallback local.
- No se hizo prueba visual con sesion POS real abierta en navegador.
