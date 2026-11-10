## ADDED Requirements

### Requirement: Aviso de cobro publicado para el tenant

El sistema SHALL publicar en `public.tenant_billing_notices` un aviso activo por cada cargo con saldo en etapa de recordatorio, con número de cargo, etapa, vencimiento, saldo y período, y SHALL resolverlo cuando el cargo quede pagado o anulado.

#### Scenario: Cambio de etapa

- **WHEN** un cargo pasa de `UPCOMING` a `OVERDUE_1`
- **THEN** su aviso activo SHALL actualizarse con la nueva etapa y el saldo vigente, sin crear un segundo aviso activo.

#### Scenario: Pago total

- **WHEN** se aplica un pago que deja el cargo `PAID`
- **THEN** el aviso SHALL quedar resuelto en la misma transacción.

#### Scenario: Escritura restringida

- **WHEN** la API operativa intenta modificar `public.tenant_billing_notices`
- **THEN** PostgreSQL SHALL rechazar la operación porque solo tiene permiso de lectura.

### Requirement: Banner para administradores del tenant cliente

El sistema SHALL mostrar en el dashboard de MANUS del tenant cliente sus avisos activos solo a usuarios `ADMIN`, `SUPER_USER` o `SUPER_ADMIN` de ese tenant, y SHALL limitar la consulta al tenant del usuario autenticado.

#### Scenario: Administrador con pago vencido

- **WHEN** un ADMIN del tenant entra al dashboard y su tenant tiene un cargo con 7 días de mora
- **THEN** el sistema SHALL mostrar un banner de peligro con el número de cargo, el saldo y los días de mora.

#### Scenario: Usuario sin rol administrativo

- **WHEN** un usuario `USER` consulta los avisos
- **THEN** el sistema SHALL responder 403 y el dashboard no SHALL mostrar el banner.

#### Scenario: Otro tenant

- **WHEN** un administrador consulta los avisos
- **THEN** el sistema SHALL devolver solo los avisos de su propio tenant.

#### Scenario: Falla del endpoint

- **WHEN** la consulta de avisos falla
- **THEN** el dashboard SHALL cargar normalmente sin banner.
