# Electronic invoice representation

## Requirements

### Requirement: Provider-create intent failures are reserved for dedicated recovery

The background retry scan MUST exclude documents in `TECHNICAL_ERROR` with processing stage `PROVIDER_CREATE_INTENT` and no `provider_document_id`. These documents require reconciliation-first recovery and MUST NOT receive a generic retry lease. Other recoverable `TECHNICAL_ERROR` stages MUST retain their existing retry behavior.

Recovery MUST use the existing per-document PostgreSQL advisory lock as the active-processing ownership signal. A future `last_status_check_at` alone MUST NOT block recovery because that field also stores historical retry/manual-review deferrals.

#### Scenario: Generic retry does not renew an ineligible lease

- **WHEN** the background worker scans technical errors
- **AND** an electronic document is at `PROVIDER_CREATE_INTENT` with no provider document id
- **THEN** the worker does not claim or renew that document
- **AND** the dedicated provider-create-intent recovery action can evaluate it after any existing lease expires

### Requirement: Accepted electronic invoices have a distinct representation
The system SHALL represent an accepted electronic invoice separately from an operational sale receipt.

#### Scenario: Accepted document is rendered
- **WHEN** a persisted electronic document has status `ACCEPTED`
- **THEN** the representation identifies an electronic invoice, uses its canonical fiscal number, and includes CUFE when available
- **AND** the representation includes persisted issuer, customer, sale, payment, tax, and total data

### Requirement: Non-accepted documents cannot claim acceptance
The system SHALL reject construction of an accepted electronic invoice representation for `PENDING`, `PROCESSING`, `REJECTED`, `TECHNICAL_ERROR`, or `CANCELLED` documents.

#### Scenario: Non-accepted document is requested
- **WHEN** a document does not have status `ACCEPTED`
- **THEN** the system returns a business validation error
- **AND** it does not call a provider or change document state

### Requirement: Fiscal metadata is not fabricated
The representation SHALL use only persisted fiscal metadata available from the provider contract.

#### Scenario: Optional provider metadata is absent
- **WHEN** QR or validation timestamp are unavailable in the current contract
- **THEN** the representation omits those fields
- **AND** it does not derive or fabricate replacement values

### Requirement: Initial acceptance persists the authoritative QR
When FactuCore returns an accepted invoice and the authenticated signed XML artifact is available,
the initial acceptance persistence path SHALL extract the exact `sts:QRCode` value and merge it into
`electronic_documents.metadata.electronicBilling.qrPayload` in the same acceptance persistence
operation. Existing QR values SHALL be preserved when identical; a conflicting authoritative value
SHALL fail closed rather than overwrite silently. If the signed XML or QR is unavailable, the
system SHALL leave the field unavailable and SHALL NOT derive it from CUFE or other mutable data.

#### Scenario: Accepted invoice stores signed XML QR

- **WHEN** initial FactuCore processing returns `ACCEPTED` and its signed XML contains one authoritative `sts:QRCode`
- **THEN** the same electronic document is persisted as `ACCEPTED`/terminal with the exact QR value
- **AND** later PDF, preview, and thermal consumers read that persisted value without provider calls

#### Scenario: Accepted invoice has no usable QR artifact

- **WHEN** initial FactuCore processing returns `ACCEPTED` but signed XML is unavailable or has no QR
- **THEN** the document is not assigned a fabricated QR value
- **AND** acceptance is not retransmitted or downgraded solely to manufacture representation data

### Requirement: Reprinting is provider-independent
An accepted representation SHALL be renderable from persisted Manus data without provider retransmission.

#### Scenario: Representation is rendered again
- **WHEN** an accepted representation is rendered more than once
- **THEN** no provider create, transmission, or status polling is performed
- **AND** fiscal metadata remains unchanged

### Requirement: Tenant billing policy controls only the sale trigger
The backend SHALL resolve `electronicBillingEnabled` and `electronicBillingMode` from the tenant
configuration JSON. Missing configuration SHALL default to enabled `AUTOMATIC` to preserve existing tenants.
Both modes SHALL use the same durable outbox pipeline.

#### Scenario: Automatic mode completes a sale
- **WHEN** a confirmed, paid sale is completed in `AUTOMATIC` mode
- **THEN** one idempotent billing outbox request is created
- **AND** the provider is not called directly by the sale operation

#### Scenario: On-demand mode completes a sale
- **WHEN** a confirmed, paid sale is completed in `ON_DEMAND` mode
- **THEN** no automatic billing request is created
- **AND** a later authorized single or batch command may enqueue the same canonical sale event

### Requirement: Manual billing requests are tenant-scoped and idempotent
Manual billing commands SHALL evaluate each sale independently and SHALL never combine multiple sales into one fiscal document.

#### Scenario: A batch contains mixed sales
- **WHEN** an authorized operator submits multiple sale IDs
- **THEN** each sale returns its own eligibility and request result
- **AND** a repeated request reuses the deterministic event identity
- **AND** no provider or transmission call occurs in the command

### Requirement: Manual retry is stage-safe
Manual retry SHALL be available only for recoverable durable states. It SHALL resume or reconcile the
existing electronic document using providerDocumentId first, preserve externalReference and idempotency,
and SHALL never create a replacement electronic document for `ACCEPTED`, `REJECTED`, `CANCELLED`,
`PROCESSING`, or an unreconciled ambiguous state.

#### Scenario: Technical error retry
- **WHEN** an authorized operator requests retry for a recoverable `TECHNICAL_ERROR`
- **THEN** the existing document and business identity are reused
- **AND** reconciliation happens before any provider resend when a provider identity may exist

### Requirement: Sale billing status is a lightweight read model
The sale list SHALL expose persisted billing status through one tenant-scoped batch query without provider calls per sale.

#### Scenario: Billing status is listed
- **WHEN** the POS sale report is loaded
- **THEN** statuses such as `NO_DOCUMENT`, `REQUESTED`, `PENDING`, `PROCESSING`, `ACCEPTED`, and `REJECTED` are mapped for each sale
- **AND** accepted fiscal number, CUFE, and acceptance timestamp are included only when persisted

### Requirement: POS and FE use separate identity sources
POS output SHALL use Manus tenant commercial identity from `tenants_detalles` with controlled
`tenants.nombre` fallback and branding from `tenants.config`. FE output SHALL use an immutable
`fiscalIssuerSnapshot` captured from the FactuCore/DIAN fiscal context for that electronic document;
tenant branding may remain as an optional logo and SHALL NOT replace the fiscal issuer.

#### Scenario: POS company details are available
- **WHEN** a POS ticket is built
- **THEN** the customer-facing header uses `tenants_detalles.razon_social`, NIT/DV, address and contact fields
- **AND** `tenants.nombre` is used only as a controlled fallback when commercial details are absent
- **AND** technical tenant, terminal, device and internal identifiers are not printed

#### Scenario: FE fiscal issuer snapshot is available
- **WHEN** an accepted electronic invoice is built
- **THEN** legal name, NIT/DV, address and contact fields come from its persisted `fiscalIssuerSnapshot`
- **AND** changing Manus tenant commercial data later does not change the historical FE issuer

#### Scenario: Historical FE has no fiscal issuer snapshot
- **WHEN** an accepted historical document lacks `fiscalIssuerSnapshot`
- **THEN** representation fails closed with an explicit unavailable-representation result
- **AND** the system does not substitute mutable tenant commercial identity or mutate the accepted document

#### Scenario: Branding logo is available
- **WHEN** `tenants.config.logo` contains a valid supported data URI
- **THEN** the print projection carries it through the typed ticket contract
- **AND** invalid or unsupported branding fails soft without blocking the ticket

### Requirement: Configuration page hydrates authorized tenant details
An authenticated tenant user SHALL be able to read and hydrate the company and branding forms for the tenant in the current route, subject to the existing tenant authorization rules.

#### Scenario: Tenant-scoped user opens configuration
- **WHEN** an authorized non-`SUPER_ADMIN` user opens the company configuration
- **THEN** the page reads details and config for the authenticated current tenant
- **AND** another tenant remains inaccessible

### Requirement: PDF and thermal output share one semantic printable model
POS and accepted electronic-invoice PDF, preview, and thermal output SHALL use the same persisted semantic fields and section order. Renderers MAY change wrapping, columns, font sizing, and image encoding for the medium, but SHALL NOT add technical metadata or change business values.

#### Scenario: POS and FE representations preserve semantic parity
- **WHEN** the same persisted sale or accepted electronic document is rendered to PDF and thermal output
- **THEN** company, branch, customer, items, taxes, totals, and payments have the same values
- **AND** FE number, CUFE, and authoritative QR are present only for accepted FE output
- **AND** sale UUIDs, tenant UUIDs, device IDs, terminal internals, and cash-session IDs are omitted from customer-facing output

### Requirement: Windows RAW transport preserves large ESC/POS jobs
The Windows RAW printer transport SHALL pass receipt bytes through temporary binary files or equivalent binary-safe IPC, never as command-line payload data.

#### Scenario: Logo and QR make a large print job
- **WHEN** a valid receipt contains raster branding and native QR commands
- **THEN** the transport submits the exact ESC/POS bytes without command-line length dependence
- **AND** temporary payload files are removed after success or failure
- **AND** jobs over the configured safety limit fail with a controlled error
### Requirement: Compact authoritative QR and payment truthfulness

Accepted invoice PDF and thermal renderers MUST use the exact persisted `qrPayload`, render it as a centered compact square QR, and never regenerate it from CUFE. POS and FE payment sections MUST NOT say `Sin pagos registrados` when the authoritative paid aggregate is greater than zero; when no method detail exists they MUST use neutral wording and preserve the paid amount.

#### Scenario: Missing payment detail with paid aggregate

- **WHEN** a sale has `paid > 0` and no authoritative payment breakdown
- **THEN** customer-facing PDF and thermal output use neutral missing-detail wording and do not invent a payment method

## ADDED Requirements

### Requirement: Background processing claims initial electronic documents

The electronic billing inbox consumer SHALL persist a durable `PENDING` electronic document at
`PRE_PROVIDER_CREATE` and SHALL leave provider processing to the enabled background processor.
The processor SHALL atomically lease only documents with status `PENDING` and stage
`PRE_PROVIDER_CREATE` for `processDocument()`. Existing `PROCESSING` documents SHALL continue through
status refresh, and recoverable `TECHNICAL_ERROR` documents SHALL continue through the existing
stage-aware retry path. Provider identity, external reference, advisory document locking and
idempotent state transitions SHALL remain authoritative; `pg_boss` transmission handling begins at
its existing transmission handoff and is not used as an initial-provider-create substitute.

#### Scenario: Initial document is picked up

- **WHEN** an eligible `PENDING` document has processing stage `PRE_PROVIDER_CREATE`
- **THEN** one worker claims it with the existing atomic lease and calls `processDocument()`
- **AND** another worker or later scan cannot claim the leased row concurrently

#### Scenario: Unsupported pending stage is ignored

- **WHEN** a `PENDING` document has any stage other than `PRE_PROVIDER_CREATE`
- **THEN** the background initial-processing query does not claim it
- **AND** it does not invoke provider create or transmission

### Requirement: Provider-create intent recovery is reconciliation-first

The system SHALL expose a dedicated recovery action for an existing electronic document only when
its status is `TECHNICAL_ERROR`, its processing stage is exactly `PROVIDER_CREATE_INTENT`, its
`provider_document_id` is null, and its stable `external_reference` is present. The action SHALL
reconcile by external reference before changing local state and SHALL fail closed for ambiguous
provider responses.

#### Scenario: Provider is confirmed absent

- **WHEN** the authoritative provider lookup returns `404` for the document external reference
- **THEN** the same electronic document is atomically reset to `PENDING` at `PRE_PROVIDER_CREATE`
- **AND** only transient error and lease fields are cleared
- **AND** a recovery event records the previous state and confirmed absence
- **AND** the background processor, not the recovery action, performs provider creation

#### Scenario: Provider exists or lookup is ambiguous

- **WHEN** the provider lookup finds a document or returns a timeout, network error, or server error
- **THEN** a missing provider identity is never replaced by a new provider create without reconciliation
- **AND** an ambiguous response leaves the local technical-error state unchanged
- **AND** a found provider is linked through the existing provider-identity reconciliation path

#### Scenario: Recovery is repeated concurrently

- **WHEN** two recovery actions target the same document
- **THEN** the document advisory lock and conditional state transition allow at most one effective reset
- **AND** the document id and external reference remain unchanged
- **AND** no replacement electronic document is created

#### Scenario: Recovery routes an existing provider document

- **WHEN** an electronic document has `provider_document_id` and requires
  reconciliation after a provider transport failure
- **THEN** the recovery action selects the existing-provider reconciliation path
  while holding the document advisory lock
- **AND** it may resume the existing provider document from a supported staged
  state such as `VALIDATED_INTERNAL` or `SIGNED`
- **AND** it never invokes confirmed-provider-absence recovery or provider create

The confirmed-provider-absence action remains restricted to the exact
pre-provider state with no provider document id and authoritative remote absence.

### Requirement: Operational UI exposes dedicated provider-create recovery

The operational sale detail SHALL expose `Recuperar procesamiento` only from a backend-computed capability for provider-create-intent recovery. The frontend SHALL NOT infer recovery safety from status labels or call generic retry. The action SHALL require confirmation, prevent concurrent duplicate submission, and refresh the persisted sale detail after one response.

#### Scenario: Eligible operator confirms recovery

- **WHEN** the backend capability allows provider-create-intent recovery and the operator has POS write permission
- **THEN** the UI explains that FactuCore reconciliation occurs first and processing may continue toward DIAN
- **AND** confirmation sends exactly one request to the dedicated recovery endpoint
- **AND** the button remains disabled while that request is in flight

#### Scenario: Sale is not eligible

- **WHEN** the backend capability denies dedicated recovery
- **THEN** the recovery button is not rendered regardless of frontend status labels

### Requirement: Provider transport failures do not masquerade as fiscal rejection

The system SHALL classify FactuCore authentication and API-client authorization failures as
`TECHNICAL_ERROR`, not `REJECTED`. A `REJECTED` state SHALL remain reserved for proven provider or
DIAN business/fiscal rejection. HTTP evidence SHALL be retained in the electronic document event,
and a FactuCore `403` SHALL be classified from its sanitized response contract instead of being
treated unconditionally as failed credentials.

#### Scenario: API client authentication fails before provider document creation

- **WHEN** FactuCore returns an authentication or API-client scope failure
- **THEN** the document remains recoverable as `TECHNICAL_ERROR`
- **AND** its current processing stage and stable external reference are preserved
- **AND** no provider document or DIAN submission is inferred

#### Scenario: FactuCore rejects a business readiness rule with HTTP 403

- **WHEN** authenticated FactuCore processing returns a non-authentication `403`
- **THEN** the adapter preserves the sanitized business detail as provider validation evidence
- **AND** it does not label the response as invalid client credentials
- **AND** generic retry is not substituted

### Requirement: FactuCore tax treatment is normalized at the provider boundary

The system SHALL preserve internal line tax facts in the durable Manus event and document model.
The FactuCore adapter SHALL map internal `EXEMPT` to `NOT_APPLICABLE`, preserve `EXCLUDED` and
`TAXED`, omit `taxes` for FactuCore `NOT_APPLICABLE` and `EXCLUDED` lines, and retain `taxes` for
`TAXED` lines. Provider normalization SHALL NOT alter commercial totals.

#### Scenario: Exempt Manus line is sent to FactuCore

- **WHEN** a durable Manus line is `EXEMPT` and contains a zero-value tax fact
- **THEN** the FactuCore request uses `taxTreatment=NOT_APPLICABLE`
- **AND** the serialized provider line omits `taxes`
- **AND** the durable Manus event and document keep their original tax fact

#### Scenario: Excluded Manus line is sent to FactuCore

- **WHEN** a durable Manus line is `EXCLUDED`
- **THEN** the FactuCore request preserves `taxTreatment=EXCLUDED`
- **AND** the serialized provider line omits `taxes`

#### Scenario: Taxed line is sent to FactuCore

- **WHEN** a durable Manus line is explicitly `TAXED`
- **THEN** the FactuCore request preserves `taxTreatment=TAXED`
- **AND** the serialized provider line retains its mapped tax entries
- **AND** a configured consumption component with internal DIAN tax code `36` uses the enclosing `INC` TaxScheme `04` at the provider boundary
- **AND** the durable tax code, rate, base, and amount remain unchanged

Internal fractional tax rates such as `0.19` MUST be normalized to percentage
points such as `19` at the FactuCore/UBL provider boundary. Taxable bases and tax
amounts MUST remain unchanged.

The payment-method master MUST own an explicit electronic-billing flag and a
controlled FactuCore fiscal pair. The supported catalog mappings are `001` to
`paymentMeansCode=10/paymentMeansId=1` (Efectivo), `002` to
`paymentMeansCode=47/paymentMeansId=1` (Transferencia debito bancaria), and
`003` to `paymentMeansCode=49/paymentMeansId=1` (Tarjeta debito). These are
internal catalog identities and MUST NOT be confused with DIAN codes.

The sale snapshot MUST preserve the selected payment method id, stable catalog
identity (`codigo`, name, type, reference requirement), amount, reference and
the configured fiscal pair used at sale completion. Billing MUST use these
snapshotted fiscal fields and MUST NOT re-read mutable `payment_methods`.
Efectivo compatibility remains `10/1`. A non-cash method MAY be transmitted only
when its explicit fiscal pair is enabled and supported. Unknown, disabled or
unsupported methods MUST fail closed before provider creation and MUST retain
their safe catalog identity in the diagnostic. Payment references MUST remain
in the immutable snapshot and MUST be present when required by the catalog.
The Manus-to-FactuCore HTTP request MUST use canonical `payments[]` for a
multi-payment request. Each item may contain only the validated contract
fields `amount`, `reference`, `paymentMeansCode`, `paymentMeansId`, and
`requiresReference`; legacy `amount`, `reference`, `requiresReference`,
`term`, and `dueDate` fields MUST NOT be serialized at the request root or
inside array items. Legacy single-payment requests remain accepted through
the existing singular fiscal fields and are normalized to one payment. A
request that supplies both forms with conflicting fiscal identity MUST fail
closed. FactuCore's whitelist/forbid-non-whitelisted validation remains
enabled, so unsupported properties are rejected before domain processing.
The durable electronic-document billing snapshot MUST persist the complete
ordered payment array so worker restart and provider recovery reuse the same
allocations, references, and fiscal identities.

The DIAN FEV UBL profile permits one or more `cac:PaymentMeans` groups. Each
group MUST contain exactly one `cbc:ID` and one `cbc:PaymentMeansCode`, with
optional due-date and payment-identifier elements. Manus and FactuCore MUST
validate positive allocation amounts and exact decimal sum against the invoice
payable total before provider creation. Allocation amounts and references remain
in the immutable internal snapshot and report model. Because no legal
per-`PaymentMeans` amount element is proven for this profile, amount MUST NOT be
serialized inside `cac:PaymentMeans`; the UBL generator emits one legal group
per normalized payment. Unknown, disabled, invalid, or mixed allocations with
invalid totals MUST fail closed without collapsing methods or changing
external-reference/recovery idempotency.

### Requirement: Fiscal party TaxScheme values are paired and authoritative

The FactuCore XML boundary SHALL serialize `PartyTaxScheme/TaxScheme` only from a verified
DIAN code/name pair. Manus tax regimes such as `ORDINARIO` and person-type labels SHALL NOT be
serialized as `TaxScheme` identifiers. Supported baseline pairs are `01/IVA`, `04/INC`,
`ZA/IVA e INC`, and `ZZ/No aplica`; unknown or divergent pairs SHALL fail closed before XML
generation.

#### Scenario: Manus customer regime is not emitted as a DIAN tax scheme

- **WHEN** an electronic customer carries Manus regime `ORDINARIO` and responsibility `R-99-PN`
- **THEN** the provider boundary emits the repository-authoritative person pair `ZZ/No aplica`
- **AND** it does not emit `ORDINARIO/ORDINARIO`

#### Scenario: TaxScheme pair diverges

- **WHEN** a party has a TaxScheme id and name that do not match the verified pair table
- **THEN** readiness/XML generation fails before provider transmission
- **AND** no replacement or inferred fiscal value is fabricated

### Requirement: Standard product identification requires real master data

Each invoice line SHALL preserve seller identification from the seller SKU and SHALL emit
`StandardItemIdentification` only when product master data supplies a real DIAN-supported code.
The platform SHALL NOT use a database UUID or an internal scheme such as `MANUS` as a standard
product identifier. Supported mappings include `001/UNSPSC` with agency `10`, `010/GTIN` with
agency `9`, `020/Partida Arancelarias` with agency `195`, and `999` only for a documented
contributor-adopted standard without `schemeAgencyID`.

#### Scenario: Product has no verified standard code

- **WHEN** a product has only its internal Manus UUID and SKU
- **THEN** the event does not present the UUID as a DIAN standard identifier
- **AND** readiness reports a product master-data gap before transmission

#### Scenario: Product has a verified standard code

- **WHEN** product master data contains a supported code and matching scheme metadata
- **THEN** the XML emits the matching `StandardItemIdentification`
- **AND** the scheme id, scheme name, agency id, and item code remain paired
