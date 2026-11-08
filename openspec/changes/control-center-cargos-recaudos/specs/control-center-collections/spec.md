## ADDED Requirements

### Requirement: Registro de pagos

El sistema SHALL permitir al SUPER_ADMIN registrar un recaudo de una cuenta comercial con fecha, valor positivo, medio de pago, referencia, notas y comprobante opcional, y SHALL rechazar como duplicado un recaudo confirmado con la misma cuenta, medio y referencia.

#### Scenario: Medio de pago inactivo o de crédito

- **WHEN** se registra un pago con un medio inactivo, de tipo `CREDIT` o de otro tenant distinto al tenant plataforma
- **THEN** el sistema SHALL responder 422 sin crear el recaudo.

#### Scenario: Pago con comprobante

- **WHEN** el SUPER_ADMIN registra una transferencia con un comprobante PDF válido de menos de 5 MB
- **THEN** el sistema SHALL guardar el archivo de forma privada y solo SHALL permitir descargarlo por un endpoint del Control Center.

#### Scenario: Archivo no permitido

- **WHEN** el comprobante es un ejecutable renombrado como PDF
- **THEN** el sistema SHALL rechazarlo por no coincidir la firma del archivo.

#### Scenario: Referencia duplicada

- **WHEN** se registra un segundo recaudo confirmado con la misma cuenta, medio y referencia
- **THEN** el sistema SHALL responder 409.

#### Scenario: Reintento con la misma llave

- **WHEN** se reenvía el registro con el mismo `Idempotency-Key`
- **THEN** el sistema SHALL devolver el mismo recaudo sin duplicarlo.

### Requirement: Medios de pago del catálogo de MANUS

El sistema SHALL tomar los medios de pago de `public.payment_methods` del tenant plataforma y las entidades financieras de `public.financial_institutions`, SHALL exigir referencia o entidad cuando el medio lo indique y SHALL guardar en el recaudo un snapshot del código y nombre del medio y de la entidad.

#### Scenario: Medio que exige entidad financiera

- **WHEN** se registra un pago con un medio con `requires_financial_institution` sin indicar entidad
- **THEN** el sistema SHALL responder 400.

#### Scenario: Medio que exige referencia

- **WHEN** se registra un pago con un medio con `requires_reference` sin referencia
- **THEN** el sistema SHALL responder 400.

#### Scenario: Cambio posterior del catálogo

- **WHEN** se renombra un medio de pago después de registrar un recaudo
- **THEN** el recaudo SHALL seguir mostrando el nombre con que se registró.

### Requirement: Aplicación de pagos a cargos

El sistema SHALL aplicar un recaudo a uno o varios cargos de la misma cuenta, de forma manual o automática del vencimiento más antiguo al más nuevo, permitiendo pagos parciales y saldo a favor, y SHALL garantizar en base de datos que ningún cargo reciba más que su total ni ningún recaudo aplique más que su valor.

#### Scenario: Pago parcial

- **WHEN** se aplican $400.000 a un cargo de $850.000
- **THEN** el cargo SHALL quedar `PARTIALLY_PAID` con saldo $450.000.

#### Scenario: Pago que cubre dos cargos

- **WHEN** un recaudo de $1.200.000 se aplica automáticamente a dos cargos abiertos de $850.000 y $350.000
- **THEN** ambos cargos SHALL quedar `PAID`.

#### Scenario: Sobreaplicación concurrente

- **WHEN** dos operaciones simultáneas intentan aplicar pagos que juntos superan el total de un cargo
- **THEN** solo una SHALL confirmarse y la otra SHALL rechazarse.

#### Scenario: Cargo de otra cuenta

- **WHEN** se intenta aplicar un recaudo a un cargo de otra cuenta comercial
- **THEN** el sistema SHALL rechazarlo con 422.

### Requirement: Reversos y anulaciones de recaudos

El sistema SHALL permitir revertir una aplicación o anular un recaudo solo con motivo de al menos 10 caracteres, SHALL recalcular el estado de los cargos afectados en la misma transacción y SHALL conservar el historial.

#### Scenario: Anular un recaudo aplicado

- **WHEN** el SUPER_ADMIN anula con motivo un recaudo aplicado a un cargo
- **THEN** sus aplicaciones SHALL quedar revertidas y el cargo SHALL volver a `OPEN` o `PARTIALLY_PAID` según corresponda.
