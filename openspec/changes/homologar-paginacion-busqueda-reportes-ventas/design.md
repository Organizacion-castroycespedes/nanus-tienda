## Architecture

`Pagination` recibe estado controlado (`page`, `pageSize`, `totalItems`) y
callbacks. El componente calcula páginas visibles, muestra rango y conserva
compatibilidad con consumidores que solo manejan anterior/siguiente.

Los reportes existentes mantienen su estrategia actual client-side. No se
agrega una segunda ventana sobre datos ya paginados. `operations/sales` mantiene
su paginación server-side con `page`, `limit` y `total`.

## Operational sales search

`useOperationalSales` tendrá filtros draft y applied. Montar, editar o limpiar
draft no llama al API. Buscar copia draft a applied, reinicia página y hace una
solicitud. Cambiar página u orden usa solo applied. Un request id/AbortController
evita que una respuesta vieja reemplace una nueva.

## Operational report boundary

El reporte debe recibir filtros y orden aplicados, resolver el mismo alcance
operativo en backend, contar antes de leer, leer en lotes estables, imponer un
límite explícito y generar PDF/XLSX con los motores existentes. El cliente no
debe solicitar todas las páginas. El contrato no acepta tenant, sucursal, rol o
turno privilegiado enviado libremente por el cliente.

La inspección confirmó que el endpoint POS y `report_resolve_pos_scope` no
cumplen esa paridad de alcance. También confirmó que `backend-reporteria` no
tiene un canal interno autenticado para recibir el alcance operativo ni conoce
`cashSessionId`/`requiresCurrentShift` de `OperationalSaleScopeService`.

La API operativa no tiene motores PDF/XLSX y `backend-reporteria` usa otro
contrato de seguridad. Crear un endpoint público en reportería, reenviar el JWT
del navegador o aceptar tenant/sucursal/rol/turno en el body permitiría ampliar
el alcance. Por eso la exportación queda BLOCKED en esta iteración. Alternativa
segura futura: contrato interno API→reportería con autenticación de servicio,
payload firmado y alcance resuelto por API, o generación documental dentro de
la API con dependencias aprobadas.

## Actions first

Se reutiliza la capacidad de columna de acciones de `DataTable` para colocar la
columna existente primero. Los elementos, permisos, callbacks y estados siguen
en cada módulo. Ventas operativas solo usa la navegación existente a detalle.

## Confirmed current architecture

- `api/src/modules/operational-sales/operational-sales.controller.ts` protege
  `GET /operations/sales` con `JwtAuthGuard`, `RolesGuard`,
  `PermissionsGuard` y permiso `POS/READ`.
- `OperationalSalesService.list` normaliza el DTO, llama a
  `OperationalSaleScopeService.resolveQueryScope` y luego a
  `OperationalSalesRepository.findMany`.
- `OperationalSaleScopeService` resuelve tenant, ramas autorizadas y, para
  `USER`, exactamente una sesión `OPEN` del usuario. El repositorio aplica esos
  predicados junto con filtros y ordenación determinista.
- `backend-reporteria` valida JWT con `JWT_SECRET` y `ReportAuthzGuard`. Su
  `ReportUser` solo contiene `id`, `tenantId`, `branchId`, `roles` y `email`;
  no contiene `cashSessionId`, `requiresCurrentShift` ni el scope resuelto por
  la API.
- `/reports/pos-sales` usa `SalesReportAdapter` y
  `report_resolve_pos_scope`. No es contrato operativo compatible.
- `DocumentExportService`, `PdfmakeEngine` y `exceljs` existen en
  `backend-reporteria`. La API no declara PDF/XLSX en `package.json`.
- `api/.env.example` declara `REPORTS_API_BASE_URL`, pero no hay cliente API que
  lo use para ventas operativas. `API_INTERNAL_TOKEN` está conectado al
  `BillingIntegrationClient`, no a reportería.
- Los despliegues empaquetan API y reportería como binarios separados. No hay
  canal interno autenticado existente entre ambos que pueda reutilizarse.

## Proposed target contract (not implemented)

La opción recomendada es API como autoridad de alcance y reportería como
generador documental mediante un canal interno privado.

### Request flow

1. El navegador llama a `GET /operations/sales/report?format=pdf|xlsx` en API
   con su JWT normal y solo filtros funcionales de la búsqueda aplicada.
2. API ejecuta de nuevo guards, permisos y
   `OperationalSaleScopeService.resolveQueryScope` en cada solicitud. Nunca
   acepta tenant, sucursal, usuario, rol o turno como autoridad del navegador.
3. API crea una autorización interna de vida corta, firmada con una clave
   exclusiva API↔reportería. El emisor es `manus-api`; el destinatario es
   `backend-reporteria`; incluye `jti`, `iat`, `exp` máximo 60 segundos, actor,
   scope resuelto, hash de filtros y `requestId`.
4. API lee datos con los mismos predicados del repositorio, en snapshot
   `REPEATABLE READ`, con conteo, lotes de 1.000 y máximo 100.000. API envía a
   reportería solo el dataset autorizado y branding resuelto.
5. ReporterÃ­a autentica el canal con secreto de servicio separado, verifica
   firma, emisor, audiencia, expiración, `jti` no reutilizado y esquema estricto.
   No acepta JWT del navegador.
6. ReporterÃ­a valida el payload firmado y genera PDF/XLSX con sus motores. No
   consulta ventas ni puede ampliar alcance. Devuelve bytes y metadatos.
7. API devuelve el stream al navegador. Token vencido, digest inválido, lote
   incompleto o límite excedido deniega con error claro.

### Proposed typed contract

```ts
type OperationalSalesExportRequest = {
  format: "pdf" | "xlsx";
  filters: Pick<OperationalSalesFilters,
    "dateFrom" | "dateTo" | "status" | "paymentStatus" |
    "paymentMethod" | "customerId" | "documentNumber" |
    "electronicBillingStatus">;
  sortBy: "createdAt" | "total" | "status";
  sortDirection: "ASC" | "DESC";
};

type OperationalSalesExportAuthorization = {
  issuer: "manus-api";
  audience: "backend-reporteria";
  requestId: string;
  jti: string;
  issuedAt: string;
  expiresAt: string;
  actor: { id: string; roles: string[] };
  scope: {
    tenantId?: string;
    allTenants: boolean;
    branchIds?: string[];
    cashSessionId?: string;
    userId?: string;
    requiresCurrentShift: boolean;
  };
  scopeDigest: string;
  queryDigest: string;
};

type OperationalSalesExportPayload = {
  authorization: OperationalSalesExportAuthorization;
  query: OperationalSalesExportRequest;
  totalRows: number;
  rows: OperationalSaleListItem[];
  branding: PrintableCompanyHeader;
};
```

The internal HTTP route and exact environment variable names are proposed, not
confirmed. Suggested names are `REPORTS_API_BASE_URL` for the internal base URL
and a new dedicated `REPORTERIA_INTERNAL_TOKEN` or asymmetric key pair.
`API_INTERNAL_TOKEN` must not be silently reused because it belongs to billing.

### Security rules

- Re-resolve permission and current shift for every export. A closed or changed
  shift invalidates the request, even if the list was previously displayed.
- `USER` receives only its current open cash session and user id. `ADMIN` and
  `SUPER_USER` receive only authorized tenant branches. `SUPER_ADMIN` follows
  the existing `AccessControlService` policy.
- Scope and query digests bind the payload. ReporterÃ­a rejects mismatched
  filters, rows, audience, issuer, role claims, tenant, branch or session.
- Service credentials stay in deployment secret storage, never frontend env,
  query strings, logs or documents. Use key rotation and separate QA/prod keys.
- Use a replay cache keyed by `jti`, private network binding where available,
  body-size limits and timeouts.
- Do not call billing providers, refresh documents or alter DIAN state. Preserve
  `AMBIGUOUS` and provider states as data.
- Audit request id, actor id, format, count, outcome and reason without logging
  JWTs, service tokens, CUFE or full customer data.

## Alternative: generate inside API

This is simpler for security because scope and DB snapshot stay in one service.
It is rejected for now because `api/package.json` has no `pdfmake` or `exceljs`,
adding and packaging both engines increases binary/deployment coupling, and
branding templates would be duplicated. It becomes preferable if an internal
service channel cannot be provisioned or if export volume requires avoiding row
transport.

## Implementation phases

1. Add dedicated service authentication and secret/key configuration in both
   services, with rotation, audience, replay and timeout tests.
2. Add API export orchestration reusing normalization, scope and repository
   predicates. Add stable batched export and branding query.
3. Add reportería internal renderer route accepting only the signed payload and
   reusing `PdfmakeEngine`, `ExcelJS`, branding conventions and new operational
   templates. Keep `/reports/pos-sales` untouched.
4. Add API/frontend adapters and enable `PdfPreviewModal` only after end-to-end
   security and document tests pass.
5. Run isolation, concurrency, limit, PDF/XLSX validity, responsive and deploy
   smoke tests. This design execution does not implement these phases.

## Current implementation stop

La inspección confirmó que no existe en `api/database`,
`scripts/database/migrations`, `api/src` o `backend-reporteria/src` una tabla,
Redis, `ioredis`, store distribuido o nonce store para consumir `jti` de forma
atómica. `sale_creation_idempotency` existe, pero su clave y ciclo de vida son
exclusivos de creación de ventas; reutilizarlo mezclaría dominios.

La implementación se detiene antes de crear endpoints, firma, transporte o
botón habilitado. Una caché local no garantiza unicidad entre múltiples
procesos/binarios. La siguiente fase necesita aprobar y desplegar una tabla
durable de autorizaciones consumidas con restricción única transaccional, o un
servicio distribuido equivalente.

## Final implementation: independent operational report

The blocked API-to-reporteria signed-payload design was not used. Scope parity
is resolved from the existing validated browser JWT plus the same PostgreSQL
data used by the operational module. `backend-reporteria` now has a separate
`/reports/operational-sales` route. It does not call `report_resolve_pos_scope`,
does not use `/reports/pos-sales`, and does not accept tenant, role, user, cash
session, or privileged scope from the browser.

The route guard verifies JWT signature, requires `sub`, `tenant_id`, and
`session_id`, verifies active `auth_sessions`, and passes only JWT identity and
roles to the scope service. The scope service checks POS READ/WRITE permission
from PostgreSQL. For `USER`, it validates `x-pos-session-id` against JWT user
and tenant, active terminal and branch, then requires exactly one current OPEN
`cash_sessions` row opened by that user. Requested branch, user, and cash
session can only narrow the resolved scope. Administrative roles receive only
active authorized branches inside the JWT tenant. A changed or closed session
is denied again at export time.

The independent SQL adapter copies operational list predicates and stable
ordering (`created_at|total|status`, then `s.id DESC`). `DocumentExportService`
performs `REPEATABLE READ READ ONLY`, count, 1,000-row batches and the existing
100,000-row hard limit. Electronic-document states, including `AMBIGUOUS`,
remain data. PDF and XLSX use existing engines and branding with a new
operational template. No migration, replay store, billing call, DIAN call, or
POS report contract changed.

The frontend sends only the last applied filters and ordering, includes the
validated POS-session header, previews PDF with `PdfPreviewModal`, and downloads
XLSX from the same independent route. Reporte stays disabled until Buscar ran.

## Operational PDF visual QA correction

The operational template now reuses the complete `PrintableCompanyHeader`
returned by `SalesReportAdapter.getPrintableCompany`, including `logo`. It
uses the same PNG/JPEG base64 and SVG base64 handling as the POS template, with
an empty visual fallback when no logo is configured.

The A4 landscape content width is `785.89pt` after 28pt left and right
margins. The eight fixed column widths are `[58, 72, 170, 105, 72, 58, 170,
80]pt`, totaling `785pt`. The table keeps `headerRows: 1`,
`dontBreakRows: true`, and `keepWithHeaderRows: 1`. The template tests cover
long names, `TECHNICAL_ERROR`, long document numbers, large monetary values,
logo support, fallback branding, and PDF generation.

Structural PDF checks pass. Image rendering of first, middle, and last pages
remains pending because Poppler/PDF rendering tools are not installed in this
environment.

## Operational PDF clipping correction

QA identified the exact pdfmake 0.2.10 cause: `lightHorizontalLines` reserves
8pt left and 8pt right padding for the internal columns. With eight columns,
that is 112pt in addition to the declared widths. The previous declared sum
therefore did not describe the exterior table width.

The operational template now uses an explicit layout: 1pt left/right cell
padding, zero vertical line width, and the existing horizontal separator
behavior. Widths are `[54, 68, 160, 98, 68, 54, 165, 88]pt`, sum `755pt`.
Effective width is `755 + (8 * 2 * 1) = 771pt`, below the `785.89pt` useful
width with safety margin. The eight columns and all data remain present.

The regression test now checks effective width including pdfmake padding, not
only the declared width sum. XLSX remains unchanged. The QA value `23` in the
Documento column was not changed: source inspection confirms the report uses
`electronic_documents.full_number`, falling back to `prefix + number`, while
missing documents map to null. Confirming whether `23` is legitimate requires
the QA database row-level comparison; no SQL or shared mapping was altered.

## Final QA closure: Documento 23

The historical `Documento=23` report was rechecked against the QA database and
the XLSX package representation. The value was a false positive from reading
an ExcelJS `sharedStrings` index as if it were the cell value. It was not a
fiscal document number.

Read-only QA evidence: 265 sales, 148 associated electronic documents, 117
sales without a document, and zero rows where the adapter-equivalent value
`COALESCE(full_number, prefix + number)` equals `23`. The database also has
zero `number = 23`, zero `full_number = '23'`, zero duplicate sale-document
associations, and zero tenant mismatches. The verified XLSX contains no
literal fiscal `23` values after resolving shared strings. No code, SQL,
mapping, data, or XLSX behavior was changed for this incident.

Current certification remains split: automated backend, scope, batching,
PDF/XLSX generation, lint and build evidence is recorded separately from
browser responsive QA and authorized role-based E2E. Those remain pending when
the required browser, QA users and live sessions are unavailable.

## Cross-report action menu lifecycle

`RowActionsMenu` is the shared source of truth for report row menus. Every
selection now executes `closeMenu()` before invoking the existing callback,
including both the `items` API and the `children` API used by POS, Clientes,
Pedidos, Compras and Caja. This is a state-lifecycle correction only: action
labels, callbacks, permissions, navigation, downloads, printing and modal
behavior remain owned by each module.

Closing first also applies to asynchronous callbacks and thrown errors. The
portal is unmounted before a PDF preview or another modal can open, so closing
that modal cannot resurrect the prior menu. Escape, outside click, keyboard
navigation and Inventory consumers remain unchanged.

Caja Cierres now opts into the same first-column action presentation already
used by Caja Arqueos. No cash operation was added or removed.

## Final manual QA record

The user reported MANUAL QA PASS for the two visual defects addressed in the
latest iteration: action menus close before their selected operation and do
not remain above PDF viewers or other modals; Caja Cierres and Caja Arqueos
show Actions as the first table column. This is supplied QA evidence. Role
authorization E2E, responsive viewport coverage and live filter/export parity
remain separate pending checks when browser, QA users and sessions are
available.
