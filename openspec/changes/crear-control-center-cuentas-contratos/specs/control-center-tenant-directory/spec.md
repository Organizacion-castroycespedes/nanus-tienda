## ADDED Requirements

### Requirement: Directorio de tenants existentes

El sistema SHALL permitir al SUPER_ADMIN del tenant plataforma consultar, en solo lectura, los tenants existentes con su razón social, NIT, estado, número de sucursales activas, número de terminales POS activas y el estado de su vínculo comercial y su contrato vigente, sin crear ni modificar tenants.

#### Scenario: Consulta paginada

- **WHEN** el SUPER_ADMIN solicita el directorio con búsqueda por nombre o NIT
- **THEN** el sistema SHALL devolver como máximo 50 tenants por página, excluyendo el tenant plataforma.

#### Scenario: Terminales contratadas frente a activas

- **WHEN** un tenant tiene un contrato `ACTIVE` y más terminales POS activas que las contratadas
- **THEN** el sistema SHALL marcarlo como `EXCEEDED` sin bloquear ninguna operación del tenant.

#### Scenario: Tenant sin vínculo

- **WHEN** un tenant no tiene cuenta comercial activa
- **THEN** el sistema SHALL indicarlo como `UNLINKED`.
