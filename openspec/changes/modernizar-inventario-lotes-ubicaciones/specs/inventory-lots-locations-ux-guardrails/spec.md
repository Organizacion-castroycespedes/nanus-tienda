## ADDED Requirements

### Requirement: Fase 1 sin cambios de stock y con contrato solo aditivo
La Fase 1 de modernización de lotes y ubicaciones SHALL NOT crear, modificar ni reservar saldos de inventario y SHALL limitar los cambios de contrato a los campos aditivos `productName` y `productSku` de los listados de lotes y saldos y al endpoint de solo lectura `GET /inventory/lots/:lotId/traceability`.

#### Scenario: Revisión del diff de Fase 1
- **WHEN** se revisa el diff de la Fase 1
- **THEN** no contiene cambios en `scripts/database/`, migraciones, guards, decoradores de permisos ni `role_menu_permissions`, y en `api/` solo cambian los repositorios, entidades, el servicio y controlador de lotes y sus pruebas declarados en el diseño

#### Scenario: Campos existentes intactos
- **WHEN** se compara la respuesta de `GET /inventory/lots` antes y después de la Fase 1B
- **THEN** todos los campos previos conservan nombre, tipo y valor

#### Scenario: Llamadas de red de Lotes
- **WHEN** se usa la vista de lotes y su modal
- **THEN** solo se emiten solicitudes `GET`

### Requirement: Aislamiento por tenant y sucursal preservado
La vista SHALL NOT enviar `tenantId` distinto del de la sesión y SHALL respetar el alcance de sucursal del rol.

#### Scenario: Usuario operativo
- **WHEN** un `USER` de la sucursal B1 consulta lotes o ubicaciones
- **THEN** todas las solicitudes usan B1 como sucursal

### Requirement: Separación explícita de la fase transaccional
Seriales, jerarquía de almacenes, reservas, traslados, garantías, conteos, resolución de discrepancias y bloqueo o cancelación de lotes SHALL quedar fuera de la Fase 1 y SHALL requerir un OpenSpec propio aprobado.

#### Scenario: Solicitud de capacidad transaccional
- **WHEN** durante la Fase 1 se pide habilitar bloqueo de lotes desde la UI
- **THEN** la tarea se registra como Fase 2 y no se implementa en este cambio
