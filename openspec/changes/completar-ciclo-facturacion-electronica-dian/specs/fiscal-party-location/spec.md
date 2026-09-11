# Ubicación fiscal de terceros

## ADDED Requirements

### Requirement: FactuCore fiscal response normalization
The billing integration SHALL expose only proven FactuCore fiscal response fields through a normalized provider contract.

#### Scenario: Accepted response preserves fiscal identity
- **WHEN** FactuCore returns an accepted document status with `uuid`, document number, response code, response message, or tracking identifier
- **THEN** the provider adapter SHALL map the available values without exposing raw credentials or raw provider payloads

#### Scenario: Reconciliation persists terminal metadata
- **WHEN** an accepted or rejected status is reconciled
- **THEN** Manus SHALL persist the provider identity, canonical status, CUFE when available, terminal timestamp, and safe provider response metadata

#### Scenario: Reconciliation is non-mutating at provider
- **WHEN** an existing document status is refreshed
- **THEN** the operation SHALL issue no provider create, XML generation, signing, or transmission call

### Requirement: Fiscal response data remains honest
The integration SHALL classify unavailable fields such as validation timestamp and QR data as unavailable rather than inventing values.

#### Scenario: Unavailable metadata remains absent
- **WHEN** FactuCore does not expose a fiscal field in its status contract
- **THEN** Manus SHALL leave that field unavailable and SHALL NOT derive it from an unrelated identifier or raw payload

### Requirement: Selectores legibles son la fuente de edición
Los usuarios normales SHALL seleccionar la ubicación fiscal mediante `País`, `Departamento` y `Municipio`. El formulario MUST NOT exponer campos editables independientes para `countryCode`, `departmentCode` o `municipalityCode`.

#### Scenario: Usuario selecciona ubicación
- **WHEN** el usuario elige país, departamento y municipio
- **THEN** el formulario conserva los códigos del catálogo sin mostrar editores técnicos

### Requirement: Persistir códigos canónicos
El sistema SHALL persistir los códigos correspondientes a las entidades seleccionadas y SHALL hidratar los selectores desde esos códigos al editar.

#### Scenario: Editar tercero existente
- **WHEN** el tercero tiene `CO`, `08` y `08001`
- **THEN** los selectores muestran Colombia, Atlántico y Barranquilla

### Requirement: Cascada consistente
Cambiar país SHALL limpiar selecciones descendientes inválidas. Cambiar departamento SHALL limpiar el municipio seleccionado.

#### Scenario: Cambiar departamento
- **WHEN** el usuario cambia de departamento
- **THEN** el municipio seleccionado y su código se limpian

### Requirement: Validación jerárquica server-side
El backend SHALL rechazar una combinación cuyo departamento no pertenezca al país o cuyo municipio no pertenezca al departamento. Para Colombia, país, departamento y municipio son obligatorios.

#### Scenario: Jerarquía inválida
- **WHEN** se envía un municipio que no pertenece al departamento
- **THEN** la API rechaza la solicitud antes de persistir
