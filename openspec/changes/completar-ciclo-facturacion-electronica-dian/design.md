# Diseño

Los formularios mantienen `countryCode`, `departmentCode` y `municipalityCode` como estado interno. Los controles editables son únicamente `País`, `Departamento` y `Municipio`, respaldados por los catálogos existentes.

La selección de país limpia departamento y municipio; la selección de departamento limpia municipio. Al hidratar una edición, los códigos canónicos seleccionan automáticamente las entidades del catálogo.

El backend valida que la combinación de códigos exista en la jerarquía activa `paises -> departamentos -> municipios`. Para Colombia exige los tres códigos. La validación ocurre antes de persistir y antes de cualquier uso fiscal.

Los campos técnicos fiscales permanecen internos o de solo lectura según su naturaleza. `Consultar DIAN mock` continúa siendo una herramienta de desarrollo y no se convierte en una operación DIAN productiva.

## Issuance policy and fiscal issuer snapshot

The backend resolves `tenants.config.electronicBillingEnabled` and
`tenants.config.electronicBillingMode`; missing keys preserve enabled `AUTOMATIC` behavior.
Automatic and manual issuance use the same durable outbox identity. Operational retry is stage-aware
and reconciles before resend.

For new accepted documents, processing downloads the provider signed XML and stores a sanitized,
immutable `electronicBilling.fiscalIssuerSnapshot` in `electronic_documents.metadata`. FE output uses
that snapshot. POS output keeps Manus commercial identity. Tenant logo is branding only. Historical
documents without a snapshot are not mutated and fiscal representation fails closed.

The same single signed-XML download on initial acceptance extracts the authoritative `sts:QRCode`
and stores it as `electronicBilling.qrPayload`. Existing equal values are idempotent; conflicting
values fail closed. Missing XML or QR remains unavailable and never falls back to CUFE or a generated URL.

## Closure audit status

The current delivery has evidence for AUTOMATIC billing, mixed payments, QR persistence,
PDF/thermal representation, recovery/resume and duplicate-send prevention. ON_DEMAND end-to-end
certification and unattended/global production certification remain pending. POS output keeps
commercial identity; FE output keeps the persisted fiscal issuer snapshot.

## Contrato FactuCore-Manus

FactuCore expone en su estado de documento el identificador fiscal `uuid` como `cufe` para facturas, además de `status`, `statusDetail`, `fullNumber`, `acceptedAt` y `rejectedAt`. El último intento puede aportar `responseCode`, `responseMessage` y `externalTrackingId`; estos se normalizan como código, mensaje y `trackingId` de respuesta del proveedor.

Manus persiste `provider_document_id`, `provider_status`, `provider_status_detail`, `cufe`, `accepted_at` y `rejected_at`. El código, mensaje y tracking adicionales se conservan bajo `metadata.providerResponse`, sin copiar credenciales ni el payload bruto.

La reconciliación usa solo lecturas de estado por identificador o referencia externa. Es idempotente, conserva metadatos no nulos existentes y no crea, firma, genera XML ni transmite.

La normalización tributaria conserva en el evento y en la persistencia de Manus los hechos fiscales
internos de cada línea. La adaptación específica de FactuCore convierte `EXEMPT` en
`NOT_APPLICABLE`, conserva `EXCLUDED` y `TAXED`, y omite la colección `taxes` únicamente para
los tratamientos FactuCore sin impuesto (`NOT_APPLICABLE` y `EXCLUDED`). Las líneas `TAXED`
conservan su colección de impuestos, incluso cuando una tasa cero sea una clasificación explícita
del dominio. Así se cumple el contrato de FactuCore sin perder evidencia fiscal interna ni cambiar
los totales comerciales.

El regimen comercial del adquirente no es `PartyTaxScheme`. El adaptador convierte los casos
conocidos de Manus (`ORDINARIO`, `R-99-PN` y tipos de persona) a una pareja DIAN verificada,
normalmente `ZZ/No aplica` para persona natural, y rechaza valores desconocidos. FactuCore vuelve
a validar la pareja antes de generar XML para impedir divergencias por otros consumidores.

La identificacion estandar del producto requiere dato maestro real. El UUID interno de producto
y el esquema `MANUS` no son codigo UNSPSC, GTIN ni partida arancelaria. El flujo actual deja esos
campos vacios y reporta un gap de producto hasta que exista un codigo verificado; no se agrega un
placeholder ni se reescribe una factura historica.

No hay campo probado para `validatedAt` en el estado actual de FactuCore. El QR autoritativo ya se persiste desde el XML firmado aceptado y alimenta las representaciones sin llamadas al proveedor. La certificación ON_DEMAND y la certificación productiva desatendida/global siguen pendientes; el flujo AUTOMATIC, la representación POS/FE, la impresión y la recuperación ya tienen evidencia de QA.
