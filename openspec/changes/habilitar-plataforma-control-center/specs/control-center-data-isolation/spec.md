## ADDED Requirements

### Requirement: Esquema dedicado

El sistema SHALL persistir los datos del Control Center exclusivamente en el esquema `control_center` de la base de datos del ambiente, sin crear ni duplicar tenants.

#### Scenario: Ambientes independientes

- **WHEN** se aplica la migración en QA y en PRD
- **THEN** cada ambiente SHALL tener su propio esquema `control_center`, sin intercambio de datos entre ambientes.

### Requirement: Usuario de base de datos dedicado

El Control Center SHALL acceder a PostgreSQL con un usuario miembro de `manus_control_center_app`, distinto de los usuarios runtime de la API operativa.

#### Scenario: Usuario operativo intenta leer el esquema

- **WHEN** `manus_user` o `manus_qa_user` consulta una tabla de `control_center`
- **THEN** PostgreSQL SHALL denegar el acceso por falta de privilegios.

#### Scenario: Rol de grupo inexistente

- **WHEN** se aplica la migración en un ambiente sin el rol `manus_control_center_app`
- **THEN** la migración SHALL fallar con `CONTROL_CENTER_ROLE_MISSING` sin dejar cambios parciales.

### Requirement: Lectura mínima de datos operativos

El usuario dedicado SHALL tener únicamente `SELECT` sobre las columnas autorizadas de `public.tenants`, `public.tenants_detalles`, `public.tenant_branches`, `public.pos_terminals` y `public.taxes`, y ningún privilegio de escritura sobre `public`.

#### Scenario: Columnas bancarias del tenant

- **WHEN** el usuario dedicado consulta `public.tenants_detalles.numero_cuenta`
- **THEN** PostgreSQL SHALL denegar la consulta.

#### Scenario: Escritura en tablas operativas

- **WHEN** el usuario dedicado intenta modificar una tabla de `public`
- **THEN** PostgreSQL SHALL denegar la operación.
