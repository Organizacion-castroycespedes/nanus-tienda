# operational-management Specification

## Purpose

Definir consulta operativa de ventas con scope backend multi-tenant y referencia segura al estado de facturacion electronica.

## Requirements

### Requirement: Tenant isolation
Toda consulta MUST usar el tenant derivado del JWT o el contexto global autorizado existente. Un actor MUST NOT acceder a una venta de otro tenant.

#### Scenario: Cross-tenant sale
- **WHEN** un actor consulta una venta de otro tenant
- **THEN** el backend responde `403` o `404` segun la convencion vigente

### Requirement: Branch and shift scope
`USER` MUST ver solo ventas del branch/contexto y turno `OPEN` actual. `ADMIN` puede consultar su branch autorizada sin turno abierto. `SUPER_USER` puede consultar branches autorizadas del tenant.

#### Scenario: Operational user views current shift
- **WHEN** `USER` consulta ventas con una sesion `OPEN` valida
- **THEN** solo recibe ventas de ese tenant, branch y turno

#### Scenario: Admin without open shift
- **WHEN** `ADMIN` consulta su branch autorizada sin caja abierta
- **THEN** recibe ventas administrativas de esa branch

#### Scenario: Previous shift
- **WHEN** `USER` intenta consultar una venta de turno anterior
- **THEN** el backend deniega el acceso

### Requirement: Backend enforcement
Los repositorios MUST recibir un scope calculado, no filtros de seguridad provenientes directamente del cliente.

#### Scenario: Manipulated branch filter
- **WHEN** un actor cambia `branchId` en URL, query o body
- **THEN** el backend valida la pertenencia y no amplia el scope

### Requirement: Operational sales list and detail
La API MUST soportar lista paginada, sorting y filtros de fecha, status, usuario, branch, cash session, pago, estado FE, numero fiscal y cliente.

#### Scenario: Paginated query
- **WHEN** el operador solicita una pagina
- **THEN** el servidor devuelve solo esa pagina y metadatos de total

### Requirement: Electronic billing visibility
Gestion Operativa MUST mostrar estado FE, numero fiscal, CUFE y errores normalizados cuando existan, pero no duplica el dominio FE ni expone secretos, SOAP o credenciales.

#### Scenario: DIAN rejected sale
- **WHEN** el detalle tiene estado FE `REJECTED`
- **THEN** muestra rechazo accionable y no ofrece retransmision terminal

### Requirement: Safe frontend adaptation
Web y Electron MAY adaptar navegacion y presentacion, pero los guards, permisos, tenant y scope MUST validarse en backend.

#### Scenario: Authorized global context
- **WHEN** `SUPER_ADMIN` usa un contexto global permitido
- **THEN** opera segun la politica global existente y no por un bypass nuevo

### Requirement: Audit and prohibited deletion
Acciones operativas autorizadas MUST usar la auditoria existente. La eliminacion de ventas fiscales MUST NOT ofrecerse como operacion normal.

#### Scenario: Fiscal sale deletion
- **WHEN** un usuario intenta borrar una venta fiscal
- **THEN** la operacion no esta disponible o es rechazada

### Requirement: Safe electronic billing status refresh
Gestión Operativa MUST use an electronic-billing read/reconciliation contract
that only queries an existing provider document and reconciles safe persisted
metadata. It MUST NOT create, process, sign, transmit or retry a document.

#### Scenario: Existing provider status
- **WHEN** un actor autorizado actualiza el estado de una venta con documento
  electrónico existente
- **THEN** el backend consulta únicamente el estado del proveedor y devuelve
  la proyección FE actualizada

#### Scenario: Missing provider document
- **WHEN** no existe identidad de proveedor y la búsqueda por referencia no
  encuentra un documento
- **THEN** el backend devuelve `PROVIDER_DOCUMENT_NOT_FOUND` sin crear ni
  transmitir un documento

#### Scenario: Terminal document refresh
- **WHEN** un documento `ACCEPTED` o `REJECTED` se actualiza
- **THEN** conserva su semántica terminal y no se ejecuta retry ni transmisión
### Requirement: Conservative stale recovery
Stale processing recovery MUST reconcile an existing provider document by
provider identity or `external_reference` before any provider creation.
Missing provider identity or a `NOT_FOUND` response MUST NOT prove that no
provider mutation occurred.

#### Scenario: Ambiguous create timeout
- **WHEN** provider creation may have persisted but Manus has no provider link
- **THEN** recovery looks up `external_reference` first and never creates a second document

#### Scenario: Create timeout not found
- **WHEN** provider creation may have happened and recovery returns `NOT_FOUND`
- **THEN** recovery fails closed without creating or transmitting

### Requirement: Transmission ambiguity is reconcile-first
The electronic billing domain MUST reconcile provider state before retrying a
document whose transmission outcome is unknown. Operational recovery MUST NOT
blindly retransmit an ambiguous or terminal document.

#### Scenario: Ambiguous transmission
- **WHEN** transmission may have reached the provider but local outcome was not persisted
- **THEN** recovery requires reconciliation/manual review and sends no second transmission

### Requirement: Terminal statuses are monotonic
Stale recovery MUST NOT overwrite `ACCEPTED`, final `REJECTED`, or `CANCELLED`
with a non-terminal status.

#### Scenario: Older stale response
- **WHEN** recovery receives an older `PROCESSING` response for a terminal document
- **THEN** the persisted terminal status remains unchanged

### Requirement: Durable processing stage
The electronic billing domain MUST persist a processing stage separate from
the canonical document status. New documents MUST begin at
`PRE_PROVIDER_CREATE`; `PROVIDER_CREATE_INTENT` and `TRANSMISSION_INTENT` MUST
be persisted before their respective external calls. Existing ambiguous rows
MUST be backfilled conservatively as `UNKNOWN`, `RECONCILIATION_REQUIRED`, or
`COMPLETED` only when durable evidence proves that classification.

#### Scenario: Create intent before provider call
- **WHEN** processing is about to call provider creation
- **THEN** the document first persists `PROVIDER_CREATE_INTENT`

#### Scenario: Transmission intent before transmit
- **WHEN** processing is about to transmit an existing provider document
- **THEN** the document first persists `TRANSMISSION_INTENT`

#### Scenario: Unknown historical stage
- **WHEN** an existing row has no durable evidence of its processing stage
- **THEN** it is `UNKNOWN`, not retryable, and requires reconciliation/manual review

#### Scenario: Ambiguous transmission recovery
- **WHEN** `TRANSMISSION_INTENT` exists without a persisted terminal result
- **THEN** recovery reconciles provider state first and never blindly transmits
