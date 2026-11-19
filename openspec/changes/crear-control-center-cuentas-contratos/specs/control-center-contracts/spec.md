## ADDED Requirements

### Requirement: Contrato por tenant con snapshot de condiciones

El sistema SHALL crear contratos para un tenant vinculado activamente a la cuenta comercial, copiando a la versión del contrato los precios de la versión de plan vigente, junto con frecuencia de cobro, día de corte igual al día de la fecha de inicio, fecha fin de prueba, política de prorrateo, snapshot del impuesto (nombre, tasa e inclusión), e ítems (`BASE`, `EXTRA_POS_TERMINAL`, `CUSTOM`).

#### Scenario: Tenant no vinculado a la cuenta

- **WHEN** se crea un contrato para un tenant sin vínculo `ACTIVE` con la cuenta indicada
- **THEN** el sistema SHALL rechazarlo con 422.

#### Scenario: Cambio posterior del catálogo

- **WHEN** se publica una nueva versión de precio después de activar un contrato
- **THEN** los ítems del contrato SHALL conservar sus montos originales.

#### Scenario: Creación reintentada

- **WHEN** se reenvía la creación de un contrato con el mismo `Idempotency-Key`
- **THEN** el sistema SHALL devolver el mismo contrato sin duplicarlo.

#### Scenario: Certificación incluida en el año inicial

- **WHEN** se crea un contrato `INITIAL` anual con la propuesta vigente
- **THEN** la versión 1 SHALL incluir el ítem `CERTIFICATION` con su precio vigente y un descuento igual a ese precio, identificado como incluido en el término inicial.

#### Scenario: Prueba y corte por defecto

- **WHEN** se crea un contrato con fecha de inicio 2026-12-15 y el plan define 1 mes de prueba
- **THEN** el contrato SHALL quedar con `trial_ends_on = 2027-01-15` y `billing_anchor_day = 15`.

#### Scenario: Inicio en día 31

- **WHEN** un contrato inicia el día 31
- **THEN** SHALL guardar `billing_anchor_day = 31` y su política SHALL indicar que en meses más cortos el corte cae en el último día del mes.

#### Scenario: Cambio posterior del impuesto

- **WHEN** cambia la tasa del impuesto en `public.taxes` después de crear el contrato
- **THEN** la versión del contrato SHALL conservar la tasa del snapshot original.

### Requirement: Ciclo de vida del contrato

El sistema SHALL permitir las transiciones `DRAFT→ACTIVE`, `DRAFT→CANCELLED` y `ACTIVE→ENDED`, y SHALL garantizar a nivel de base de datos como máximo un contrato `DRAFT` o `ACTIVE` por tenant.

#### Scenario: Activación concurrente

- **WHEN** dos solicitudes intentan activar contratos para el mismo tenant al mismo tiempo
- **THEN** solo una SHALL tener éxito y la otra SHALL recibir 409.

#### Scenario: Transición inválida

- **WHEN** se intenta activar un contrato `ENDED`
- **THEN** el sistema SHALL rechazarlo con 409.

### Requirement: Enmienda por versión inmutable

El sistema SHALL modificar las condiciones de un contrato `ACTIVE` solo creando una nueva versión con motivo, cerrando la vigencia de la anterior, y SHALL rechazar cualquier modificación directa de versiones o ítems existentes.

#### Scenario: Renovación mensual después del primer año

- **WHEN** el SUPER_ADMIN enmienda un contrato `INITIAL` anual a `RENEWAL` mensual con motivo
- **THEN** el sistema SHALL crear la versión N+1 con el precio `BASE_RENEWAL` mensual vigente y conservar la versión anterior sin cambios.

#### Scenario: Agregar terminal POS adicional

- **WHEN** el SUPER_ADMIN enmienda el contrato para agregar una terminal POS adicional
- **THEN** la nueva versión SHALL incluir el ítem `EXTRA_POS_TERMINAL` con el precio vigente de la frecuencia elegida.

#### Scenario: Edición directa de una versión

- **WHEN** cualquier proceso intenta hacer `UPDATE` de los montos de un `contract_item` existente
- **THEN** PostgreSQL SHALL rechazar la operación.

#### Scenario: Renovación anual con bono de certificación

- **WHEN** el SUPER_ADMIN enmienda un contrato a `RENEWAL` anual
- **THEN** la nueva versión SHALL incluir el ítem `CERTIFICATION` con su precio vigente y un descuento igual a ese precio, identificado como bono de fidelidad.

### Requirement: Auditoría de acciones comerciales

El sistema SHALL auditar toda escritura de cuentas, vínculos, planes y contratos, y SHALL exigir motivo para activar, enmendar, terminar, desvincular, ajustar precio o descuento, modificar la prueba, publicar una versión de precio y retirar un plan.

#### Scenario: Enmienda sin motivo

- **WHEN** se solicita una enmienda sin motivo
- **THEN** el sistema SHALL responder 400 sin crear una versión.
