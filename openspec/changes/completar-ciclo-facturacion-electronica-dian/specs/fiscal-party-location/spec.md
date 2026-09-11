# Ubicación fiscal de terceros

## ADDED Requirements

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
