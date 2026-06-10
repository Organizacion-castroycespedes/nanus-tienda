# Evidencia FE-3.4-QA POS cliente fiscal mock

## Objetivo

Validar localmente el flujo rapido de cliente fiscal desde POS.

## Entorno local observado

- Web local: `http://localhost:3000`.
- API local: `http://localhost:4020`.
- POS URL usada: `http://localhost:3000/default/pos`.
- API version usada: `http://localhost:4020/api/system/version`.

## Resultado de smoke

| Check | Estado | Evidencia |
| --- | --- | --- |
| POS abre | PASS parcial | `GET http://localhost:3000/default/pos` respondio `200`; HTML cargo chunk `app/[tenant]/pos/page.js`. |
| API local responde | PASS | `GET http://localhost:4020/api/system/version` respondio `200` con `{"version":"0.0.1"}`. |
| Modal `Cliente fiscal` abre | NO EJECUTADO | Browser automatizado fallo antes de abrir tab por `windows sandbox failed: spawn setup refresh`. Source confirma boton y modal. |
| Busqueda cliente funciona | NO EJECUTADO | Requiere click-smoke autenticado en POS. Source confirma input de busqueda y filtro local. |
| Mock DIAN lookup funciona | NO EJECUTADO en UI | Requiere click-smoke autenticado. Source confirma llamada `lookupElectronicInvoicingCustomer`. |
| Aplicar campos seleccionados funciona | NO EJECUTADO en UI | Requiere click-smoke autenticado. Source confirma llamada `applyElectronicInvoicingCustomerLookup`. |
| Crear cliente rapido funciona | NO EJECUTADO en UI | Requiere click-smoke autenticado. Source confirma llamada `createElectronicInvoicingCustomer`. |
| Cliente queda seleccionado en POS | NO EJECUTADO en UI | Requiere click-smoke autenticado. Source confirma `setSelectedCustomerId(customer.id)`. |
| Consumidor Final sigue disponible | NO EJECUTADO en UI | Source confirma boton `Consumidor Final` y fallback existente. |

## Evidencia estatica verificada

Se verificaron referencias en source:

- `web/modules/pos/components/PosScreen.tsx`
  - `Cliente fiscal`
  - `Consumidor Final`
  - `setSelectedCustomerId(customer.id)`
- `web/modules/pos/components/QuickFiscalCustomerModal.tsx`
  - `Cliente fiscal rapido`
  - `Mock DIAN`
  - `Aplicar a existente`
  - `Crear y usar`
- `web/modules/electronic-invoicing/services/customer.service.ts`
  - `lookupElectronicInvoicingCustomer`
  - `createElectronicInvoicingCustomer`
  - `applyElectronicInvoicingCustomerLookup`

## Bloqueo QA interactivo

El browser automatizado del entorno no pudo iniciar:

```text
windows sandbox failed: spawn setup refresh
```

No hay `playwright` ni `@playwright/test` instalado en `web/node_modules`, asi que no se ejecuto fallback local con Playwright.

## Validaciones ejecutadas

```powershell
cd web
npm.cmd run build

cd api
npm.cmd run build
```

Resultados:

- Web build: pass, con warnings existentes no relacionados.
- API build: pass.

## Fuera de alcance confirmado

- No SOAP real.
- No certificados.
- No SQL.
- No PRD.
- No remoto.
- No commit.
- No cambios funcionales.

## Riesgos

- Falta smoke interactivo real con sesion POS autenticada.
- No se confirmo visualmente modal, busqueda, lookup, apply, create ni seleccion final en navegador.
- Requiere repetir QA con browser disponible y usuario POS con permisos.
