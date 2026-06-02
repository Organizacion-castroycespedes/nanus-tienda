# Delta spec: dian-third-party-lookup

## ADDED Requirements

### Requirement: Lookup fiscal provider-agnostic de terceros

El sistema SHALL permitir consultar terceros fiscales mediante una capa provider-agnostic sin modificar automaticamente `customers` ni `suppliers`.

#### Scenario: Preview de tercero fiscal sin persistir

- GIVEN un usuario autenticado con permiso fiscal
- WHEN solicita preview con `partyType`, `documentTypeCode` y `documentNumber`
- THEN el sistema SHALL consultar el provider configurado
- AND SHALL devolver datos normalizados
- AND SHALL NOT modificar `customers` ni `suppliers`.

#### Scenario: Integracion desactivada

- GIVEN la consulta externa esta desactivada por configuracion
- WHEN el usuario solicita lookup fiscal
- THEN el sistema SHALL devolver estado `DISABLED` o equivalente
- AND SHALL permitir registro manual.

#### Scenario: Modo mock local

- GIVEN el provider configurado es `MOCK_LOCAL`
- WHEN se solicita preview
- THEN el sistema SHALL devolver respuesta controlada local
- AND SHALL NOT realizar llamadas externas.

### Requirement: POS mantiene Consumidor Final como fallback

El sistema SHALL permitir que POS venda con Consumidor Final cuando no hay cliente fiscal identificado.

#### Scenario: Venta POS con consumidor final

- GIVEN POS no tiene cliente nominal seleccionado
- WHEN el flujo necesita un `customerId`
- THEN el sistema SHALL usar el consumidor final activo del tenant cuando exista
- AND SHALL permitir venta sin `fiscalEmail`.

#### Scenario: Cliente rapido fiscal en POS

- GIVEN el cajero necesita factura electronica nominada
- WHEN crea un cliente rapido fiscal
- THEN el sistema SHALL permitir consultar fuente fiscal en preview
- AND SHALL guardar un `customerId` canonico en `customers`
- AND SHALL seleccionar ese `customerId` para la venta.

#### Scenario: DIAN falla durante POS

- GIVEN la consulta fiscal falla o esta apagada
- WHEN el cajero sigue la venta
- THEN el sistema SHALL permitir guardar manualmente o usar Consumidor Final
- AND SHALL NOT bloquear el core de venta POS.

### Requirement: Customers fiscales con confirmacion de cambios

El sistema SHALL permitir crear y editar customers fiscales sin sobrescribir datos manuales sin confirmacion.

#### Scenario: Crear customer fiscal manual

- GIVEN un usuario autorizado crea un customer fiscal
- WHEN envia datos fiscales validos
- THEN el sistema SHALL crear o actualizar un registro en `customers`
- AND SHALL devolver el `customerId` canonico.

#### Scenario: Preview DIAN difiere de dato manual

- GIVEN un customer tiene `legalName = "ACME"`
- AND la fuente fiscal devuelve `legalName = "ACME SAS"`
- WHEN el usuario ejecuta preview
- THEN el sistema SHALL devolver un diff de campo
- AND SHALL mantener el valor manual hasta confirmacion.

#### Scenario: Aplicar campos seleccionados

- GIVEN existe un preview fiscal
- WHEN el usuario aplica con estrategia por campo
- THEN el sistema SHALL actualizar solo campos confirmados
- AND SHALL conservar los campos marcados como manuales.

### Requirement: Suppliers fiscales provider-agnostic

El sistema SHALL permitir lookup fiscal de suppliers sin asumir GetAcquirer como fuente unica.

#### Scenario: Supplier usa fuente aprobada distinta a GetAcquirer

- GIVEN un usuario consulta un supplier
- WHEN la fuente configurada no es DIAN GetAcquirer
- THEN el sistema SHALL consultar el adapter provider-agnostic aprobado
- AND SHALL devolver preview sin persistir.

#### Scenario: GetAcquirer no aplica a supplier

- GIVEN el provider configurado es `DIAN_DIRECT`
- WHEN se consulta `partyType = "SUPPLIER"`
- THEN el sistema SHALL devolver `UNSUPPORTED_PARTY_TYPE` o estado equivalente
- AND SHALL permitir registro manual.

#### Scenario: Supplier y customer comparten identidad fiscal

- GIVEN existe un customer con una identidad fiscal
- WHEN se crea o consulta un supplier con la misma identidad fiscal
- THEN el sistema SHALL advertir la relacion cruzada
- AND SHALL NOT fusionar registros automaticamente.

### Requirement: Idempotencia por identidad fiscal

El sistema SHALL evitar duplicados por tenant, tipo de tercero, tipo documento y numero normalizado.

#### Scenario: Reintento de lookup

- GIVEN ya existe un lookup para la misma identidad fiscal
- WHEN se repite la consulta
- THEN el sistema SHALL reutilizar o relacionar el intento con la misma clave idempotente
- AND SHALL NOT crear duplicados.

#### Scenario: Reintento de sync customer

- GIVEN un customer ya fue creado por sync fiscal
- WHEN se repite el sync con la misma identidad fiscal
- THEN el sistema SHALL devolver el mismo `customerId`
- AND SHALL registrar `SKIP`, `NOOP` o `UPDATE` segun cambios permitidos.

#### Scenario: Reintento de sync supplier

- GIVEN un supplier ya fue creado por sync fiscal
- WHEN se repite el sync con la misma identidad fiscal
- THEN el sistema SHALL devolver el mismo `supplierId`
- AND SHALL registrar `SKIP`, `NOOP` o `UPDATE` segun cambios permitidos.

### Requirement: GetAcquirer futuro para adquirientes

El sistema SHALL preparar GetAcquirer para customers/adquirientes con `identificationType` e `identificationNumber`.

#### Scenario: Mapping request GetAcquirer

- GIVEN se consulta un customer con `documentTypeCode` y `documentNumberNormalized`
- WHEN se usa `DIAN_DIRECT`
- THEN el sistema SHALL mapear `documentTypeCode` a `identificationType`
- AND SHALL mapear `documentNumberNormalized` a `identificationNumber`.

#### Scenario: Ambiente habilitacion

- GIVEN `DIAN_ENVIRONMENT = "HABILITACION"`
- WHEN una fase autorizada active llamadas externas
- THEN el sistema SHALL usar certificado y endpoint de habilitacion aprobados
- AND SHALL registrar solo resumen seguro.

#### Scenario: Ambiente produccion bloqueado por defecto

- GIVEN `DIAN_ENVIRONMENT = "PRODUCCION"`
- WHEN no existe aprobacion explicita para llamadas externas
- THEN el sistema SHALL bloquear el consumo real
- AND SHALL permitir volver a `MOCK_LOCAL`.

### Requirement: Logs seguros de lookup fiscal

El sistema SHALL registrar trazabilidad segura de lookup y sync sin exponer secretos ni raw SOAP por defecto.

#### Scenario: Resumen operativo

- GIVEN un lookup termina con cualquier resultado
- WHEN se registra trazabilidad
- THEN el sistema SHALL guardar `provider`, `lookupStatus`, `statusCode`, `message`, `lookupAt`, `requestHash`, `responseSummary` y `correlationId`
- AND SHALL NOT guardar raw SOAP por defecto.

#### Scenario: Secretos protegidos

- GIVEN existe certificado, password o token interno
- WHEN ocurre error de lookup
- THEN el sistema SHALL NOT registrar esos secretos en logs, auditoria ni respuesta API.

### Requirement: Datos fiscales requeridos solo cuando aplica factura electronica nominada

El sistema SHALL permitir terceros incompletos fiscalmente mientras no se requiera factura electronica nominada.

#### Scenario: Customer sin email fiscal

- GIVEN un customer no tiene `fiscalEmail`
- WHEN se guarda como cliente operativo o fiscal incompleto
- THEN el sistema SHALL permitir guardar
- AND una fase de emision electronica futura SHALL bloquear factura nominada si el email requerido falta.

#### Scenario: Supplier incompleto fiscalmente

- GIVEN un supplier no tiene todos los campos fiscales
- WHEN se usa para compras operativas
- THEN el sistema SHALL NOT bloquear compras en esta fase.

### Requirement: Tenant y branch correctos

El sistema SHALL usar tenant desde JWT/contexto autenticado y branch desde contexto POS o flujo operativo, no desde el tercero fiscal.

#### Scenario: Tenant desde JWT

- GIVEN un usuario autenticado de un tenant
- WHEN consulta o guarda un tercero fiscal
- THEN el sistema SHALL usar el tenant efectivo del JWT o contexto validado
- AND SHALL ignorar `tenantId` de body para usuarios no globales.

#### Scenario: Branch desde POS

- GIVEN POS crea una venta con un `customerId`
- WHEN se registra la venta
- THEN el sistema SHALL usar branch de la sesion POS
- AND SHALL NOT guardar branch como identidad fiscal del tercero.

## Riesgos

RIESGO: Exigir datos fiscales en POS puede bloquear ventas rapidas.

RIESGO: Sin idempotencia se pueden duplicar customers y suppliers.

RIESGO: GetAcquirer para suppliers puede ser una fuente incorrecta.

RIESGO: Raw SOAP o secretos en logs expone datos sensibles.

RIESGO: Catalogos DIAN desactualizados pueden validar documentos mal.

## Preguntas abiertas

PREGUNTA ABIERTA: Que fuente fiscal se aprueba para suppliers?

PREGUNTA ABIERTA: Que valores fiscales exactos tendra Consumidor Final?

PREGUNTA ABIERTA: Que politica de DV se aprueba?

PREGUNTA ABIERTA: Que retencion aplica a logs de lookup?

PREGUNTA ABIERTA: Cuando se justifica crear `fiscal_parties` comun?
