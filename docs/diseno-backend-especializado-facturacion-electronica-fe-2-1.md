# Diseno backend especializado facturacion electronica - FE-2.1

## Resumen ejecutivo

FE-2 implemento correctamente clientes fiscales, catalogo de tipos de documento y consumidor final dentro de `api/`. Esa decision se mantiene porque `customers.id` ya es el identificador canonico usado por POS, ventas, pedidos y reportes.

La vision estrategica requiere un backend especializado para facturacion electronica. Ese nuevo servicio no debe reemplazar el modulo actual de clientes ni mover POS. Debe nacer como un bounded context separado para el ciclo de vida del documento electronico: generacion XML/UBL, CUFE, envio a DIAN o proveedor tecnologico, estados, reintentos, logs tecnicos, certificados, archivos, webhooks y eventos de aceptacion o rechazo.

FE-2.1R aclara una responsabilidad adicional: `backend-facturacion-electronica/` tambien sera la capa especializada de consulta, normalizacion y sincronizacion fiscal de terceros. Esto incluye clientes/adquirientes y proveedores. Las tablas operativas `customers` y `suppliers` siguen viviendo en `api/` y en la base principal; el backend FE no crea tablas paralelas como fuente principal.

Decision principal: `api/` queda como sistema de registro operativo de venta, cliente, proveedor, compras, pagos, sucursal y preparacion facturable. `backend-facturacion-electronica/` sera el sistema de registro del documento electronico y su estado tecnico-fiscal, y la capa de lookup/sync fiscal provider-agnostic para terceros.

## Decision arquitectonica

Se adopta una arquitectura distribuida gradual:

1. `api/` conserva clientes fiscales, proveedores, consumidor final, ventas, pedidos, compras, pagos, inventario y endpoints operativos para POS/Orders/Purchases.
2. `backend-facturacion-electronica/` nace como servicio especializado para documentos electronicos, comunicacion DIAN/proveedor y consulta/sync fiscal de terceros.
3. La primera integracion recomendada es HTTP interno entre `api/` y backend FE, con idempotencia y respuesta de estado controlada.
4. La evolucion futura debe migrar a eventos con outbox/event bus cuando existan mayor volumen, reintentos automaticos y necesidad de desacoplar latencia del POS o compras.

FE-2 queda justificado como modulo de clientes fiscales en `api/` porque la identidad del adquiriente pertenece al flujo comercial y debe seguir alimentando `/api/customers`, `sales.customer_id`, `orders.customer_id` y consumidor final tenant-aware. La misma regla aplica para proveedores: `suppliers` sigue siendo tabla operativa de compras e inventario, y backend FE solo coordina lookup/sync fiscal.

## Analisis de lo existente

### `api/src/modules/electronic-invoicing`

El modulo FE actual contiene:

- `customers`: endpoints y reglas fiscales sobre la tabla canonica `customers`.
- `document-types`: lectura del catalogo `dian_document_types`.
- consumidor final por tenant con `GET /api/electronic-invoicing/customers/default` y `POST /api/electronic-invoicing/customers/default/ensure`.
- reglas de `fiscalEmail` opcional, documento normalizado, `fiscalStatus` e `isFinalConsumer`.

Este modulo no genera documentos electronicos, no consume DIAN real, no crea XML/UBL y no modifica POS.

### Ventas y pedidos

El modulo operativo de ventas usa datos comerciales:

- `tenantId`
- `branchId` desde contexto POS o caja
- `customerId`
- `orderId`
- items de venta
- totales, impuestos, descuentos y estado
- pagos asociados

Pedidos mantiene relacion con `customerId`, tenant y sucursal, y puede convertirse en venta interna. Ese flujo sigue siendo comercial. No debe moverse al backend FE.

### Pagos y metodos de pago

Finanzas y caja manejan:

- metodos de pago
- pagos
- sesiones de caja
- cajas registradoras
- movimientos de caja
- scope por tenant y sucursal

Estos datos son fuente para construir el snapshot fiscal de una factura, pero la conciliacion operativa de caja debe seguir en `api/`.

### Tenants y sucursales

`tenants` representa el cliente SaaS. `tenants_detalles` contiene datos fiscales de la compania del tenant. `tenant_branches` contiene sucursales/establecimientos.

La sucursal de una factura sale del contexto de venta, no del cliente. El consumidor final sigue siendo unico por tenant.

### Proveedores y compras

`suppliers` vive en `InventoryModule` junto a clientes operativos. El controller actual expone `/api/suppliers` y el modelo guarda `tenantId`, `name`, `documentNumber`, `phone`, `email`, `address`, ubicacion e `isActive`.

Compras e inventario usan `supplierId` como referencia operativa. Por eso `suppliers` no debe moverse al backend FE ni duplicarse como fuente principal. El backend FE puede consultar fuentes fiscales externas y solicitar a `api/` crear o actualizar un proveedor cuando el flujo fiscal o de compras lo requiera.

## Responsabilidades

| Area | `api/` | `backend-facturacion-electronica/` |
| --- | --- | --- |
| Clientes fiscales | Si. CRUD fiscal sobre `customers`. | Solo lectura/sync si necesita snapshot. |
| Proveedores fiscales | Si. CRUD operativo sobre `suppliers`; campos fiscales futuros por evolucion aditiva. | Consulta, normaliza y solicita upsert fiscal en `api/`. |
| Consumidor final | Si. Unico por tenant. | Lo usa como adquiriente cuando aplique. |
| Ventas POS | Si. Creacion, pagos, inventario, caja. | No. Recibe snapshot facturable. |
| Pedidos | Si. Creacion, estados y conversion operativa. | No. Recibe solicitud si deriva en documento FE. |
| Compras | Si. Creacion, proveedor, recepcion, inventario y pagos a proveedor. | No. Puede enriquecer proveedor fiscalmente. |
| Relacion venta-cliente | Si. `sales.customer_id` y `orders.customer_id`. | Referencia por ids y snapshot. |
| Relacion compra-proveedor | Si. `purchases.supplier_id`. | Referencia por ids y snapshot si aplica. |
| Preparacion facturable | Si. Determina si la venta requiere FE y arma payload. | Valida snapshot y crea documento electronico. |
| Endpoints POS/Orders | Si. | No. |
| Documentos electronicos | No como owner. Solo consulta estado. | Si. Owner de facturas, notas y eventos. |
| XML/UBL | No. | Si. |
| CUFE/CUDE | No. | Si. |
| DIAN/proveedor | No real en `api/`. | Si, via adapters. |
| Certificados | No. | Si, por tenant y ambiente. |
| Configuracion FE | Solo datos comerciales basicos si existen. | Si, resoluciones, prefijos, ambiente, proveedor. |
| Envio de facturas | No. | Si. |
| Reintentos | No. | Si. |
| Estados FE | Consulta y muestra. | Owner y fuente canonica. |
| Logs tecnicos | No raw DIAN. | Si, con privacidad y cifrado si aplica. |
| XML/PDF | No como owner. | Si, almacenamiento seguro y referencias. |
| Webhooks | No inicialmente. | Si. |
| Aceptacion/rechazo | Consulta. | Owner de eventos. |
| Notas credito/debito | No inicialmente. | Si en fases futuras. |
| Lookup fiscal terceros | Expone comandos internos controlados para crear/actualizar `customers` y `suppliers`. | Owner de consulta externa, normalizacion, decision de sync e idempotencia. |

## Arquitectura propuesta

```text
[POS / Orders / Admin]
        |
        v
      api/
        |  clientes, ventas, pedidos, pagos, inventario
        |  prepara snapshot facturable
        |
        | HTTP interno FE-2.6
        v
backend-facturacion-electronica/
        |  documento electronico, XML/UBL, CUFE, proveedor, estado
        |  lookup/sync fiscal customers/suppliers
        |
        v
[DIAN o proveedor tecnologico]
```

`api/` debe seguir respondiendo a los usuarios operativos. El backend FE puede procesar de forma asincrona controlada para no bloquear POS con latencia de DIAN/proveedor.

El contrato entre servicios debe ser un snapshot facturable, no una consulta libre a tablas operativas. Ese snapshot debe incluir version, tenant, venta, cliente, sucursal, items, impuestos, descuentos, pagos relevantes y totales calculados. Asi el documento electronico queda reproducible aunque luego cambie el cliente o la venta.

Para sincronizacion fiscal, el contrato entre servicios debe ser un comando interno de upsert, no escritura directa del backend FE sobre tablas operativas. `backend-facturacion-electronica/` normaliza datos y llama a `api/` para crear o actualizar `customers` o `suppliers` con reglas tenant-aware, auditoria y validaciones del dominio operativo.

## Responsabilidad de consulta fiscal de terceros

`backend-facturacion-electronica/` sera responsable de consultar fuentes fiscales externas o internas controladas, normalizar la respuesta y coordinar sincronizacion con `api/`.

Terceros cubiertos:

- customers/adquirientes para venta y facturacion.
- suppliers/proveedores para compras, inventario y posible soporte fiscal futuro.

Fuentes posibles:

- `MOCK_LOCAL` para pruebas y preview.
- DIAN GetAcquirer para adquirientes/clientes cuando aplique.
- proveedor tecnologico.
- fuente manual validada por usuario.
- consulta RUT u otra fuente aprobada en fase futura.

Reglas:

1. `api/` conserva `customers` y `suppliers` como tablas operativas canonicas.
2. Backend FE no crea tablas paralelas de clientes/proveedores como fuente principal.
3. Backend FE puede mantener logs, snapshots y resultados normalizados, pero el registro operativo vive en `api/`.
4. Toda sincronizacion debe ser idempotente por `tenantId + partyType + documentType + documentNumberNormalized`.
5. No se guarda raw response completo en primera version.
6. Solo se guarda resumen seguro: `status`, `statusCode`, `message`, `provider`, `lookupAt`, `requestHash`, `responseSummary`, `syncAction`, `targetType`, `targetId`.
7. La actualizacion de datos existentes debe respetar campos manuales y politica de sobrescritura aprobada.

## Customers sync

Backend FE debe poder ejecutar lookup fiscal de cliente/adquiriente y luego sincronizar contra `customers`.

Flujo cuando existe customer:

1. Usuario o proceso solicita lookup con `tenantId`, `documentTypeCode` y `documentNumber`.
2. Backend FE normaliza el documento y calcula idempotency key.
3. Backend FE consulta fuente configurada.
4. Backend FE compara respuesta normalizada contra `customers`.
5. Si existe customer en el tenant, backend FE solicita a `api/` actualizar solo campos fiscales permitidos.
6. `api/` aplica validaciones, tenant scope, auditoria y reglas de no sobrescritura.
7. Backend FE registra log de lookup y sync con `syncAction = UPDATED` o `NOOP`.

Flujo cuando no existe customer:

1. Backend FE consulta y normaliza datos fiscales.
2. Backend FE solicita a `api/` crear customer en `customers`.
3. `api/` crea registro compatible con `/api/customers` y campos fiscales disponibles.
4. Backend FE registra `syncAction = CREATED` y conserva referencia `customerId`.

Campos candidatos para sync de customer:

- `name`
- `documentTypeCode`
- `documentNumber`
- `documentNumberNormalized`
- `verificationDigit`
- `legalName`
- `fiscalEmail`
- `address` o ubicacion fiscal si existe en el modelo
- `dianLastLookupAt`
- `dianLastLookupStatus`
- `fiscalStatus`

## Suppliers sync

Backend FE debe poder ejecutar lookup fiscal de proveedor y sincronizar contra `suppliers`.

Flujo cuando existe supplier:

1. Usuario o proceso de compras solicita lookup con `tenantId`, `documentTypeCode` y `documentNumber`.
2. Backend FE consulta fuente provider-agnostic aprobada.
3. Backend FE normaliza respuesta y busca supplier por tenant + documento normalizado.
4. Si existe supplier, backend FE solicita a `api/` actualizar datos fiscales permitidos.
5. `api/` mantiene reglas operativas de `suppliers`, auditoria y compatibilidad con compras.
6. Backend FE registra `syncAction = UPDATED` o `NOOP`.

Flujo cuando no existe supplier:

1. Backend FE consulta fuente fiscal o recibe datos manuales normalizados.
2. Backend FE solicita a `api/` crear supplier en `suppliers`.
3. `api/` crea proveedor operativo compatible con compras e inventario.
4. Backend FE registra `syncAction = CREATED` y conserva referencia `supplierId`.

Campos candidatos para sync de supplier:

- `name`
- `documentTypeCode` futuro
- `documentNumber`
- `documentNumberNormalized` futuro
- `verificationDigit` futuro
- `legalName` futuro
- `fiscalEmail` futuro
- `email`
- `phone`
- `address`
- ubicacion fiscal futura
- `fiscalStatus` futuro

Nota: `suppliers` aun no tiene las mismas columnas fiscales de `customers`. La fase FE-2.3 debe disenar evolucion aditiva equivalente o un contrato minimo que no rompa compras.

## Provider-agnostic lookup

El lookup fiscal debe depender de una abstraccion, no de DIAN directo.

Contrato conceptual:

```text
FiscalPartyLookupInput
  tenantId
  partyType: CUSTOMER | SUPPLIER
  documentTypeCode
  documentNumber
  verificationDigit?
  sourcePreference?: MOCK_LOCAL | DIAN_GET_ACQUIRER | TECHNOLOGY_PROVIDER | MANUAL | RUT

FiscalPartyLookupResult
  status: FOUND | NOT_FOUND | ERROR | SKIPPED
  provider
  statusCode
  message
  lookupAt
  requestHash
  normalizedParty
  responseSummary
```

Para customers, GetAcquirer es una fuente candidata. Para suppliers, el adapter debe quedar abierto porque la fuente puede ser proveedor tecnologico, RUT, captura manual validada u otra fuente aprobada.

## Relacion con GetAcquirer

La guia DIAN de consumo de Web Services describe GetAcquirer como servicio para completar informacion de adquirientes de factura electronica y usa `identificationType` e `identificationNumber` como datos de request.

Implicacion de diseno:

- GetAcquirer aplica principalmente a customers/adquirientes.
- El backend FE debe mapear `documentTypeCode` a `identificationType`.
- El backend FE debe mapear `documentNumberNormalized` a `identificationNumber`.
- La respuesta debe normalizarse antes de tocar `customers`.
- No debe asumirse que GetAcquirer resuelve suppliers.
- Suppliers quedan bajo lookup provider-agnostic separado.

Referencia: [DIAN - Guia Herramienta para el Consumo de Web Services](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf).

## Idempotencia

Toda consulta y sincronizacion fiscal debe ser idempotente.

Clave recomendada:

```text
tenantId:partyType:documentTypeCode:documentNumberNormalized
```

Reglas:

1. Repetir el mismo lookup no debe crear duplicados.
2. Repetir un sync exitoso debe devolver el mismo `customerId` o `supplierId`.
3. Si hay una operacion en curso para la misma clave, debe responder `PENDING` o reutilizar el intento.
4. Si cambia la fuente o el payload normalizado, debe registrarse nuevo log, pero no duplicar tercero.
5. Los comandos internos a `api/` deben soportar idempotency key y correlation id.
6. Conflictos por documento duplicado deben resolverse antes de crear registros nuevos.

## Comunicacion entre servicios

### Opcion A: HTTP interno desde `api/`

`api/` llama a `backend-facturacion-electronica/` cuando una venta queda lista para facturar.

| Criterio | Evaluacion |
| --- | --- |
| Simplicidad | Alta. Facil de implementar y depurar. |
| Consistencia | Media-alta con idempotencia y estado `PENDING`. |
| Trazabilidad | Alta si se guarda `requestId`, `saleId`, `tenantId` y respuesta. |
| Reintentos | Medios. Requiere job o endpoint retry en backend FE. |
| Complejidad | Baja-media. |
| Despliegue | Simple, pero exige URL interna y auth servicio-a-servicio. |

Recomendacion para primera version: usar HTTP interno con idempotency key `tenantId:saleId:documentType`. Puede responder `201 CREATED` si genera de inmediato o `202 ACCEPTED` si deja proceso pendiente.

### Opcion B: evento publicado por `api/`

`api/` publica `SaleReadyForElectronicInvoicing` y backend FE consume.

| Criterio | Evaluacion |
| --- | --- |
| Simplicidad | Media-baja. Requiere broker/outbox. |
| Consistencia | Alta si se usa transactional outbox. |
| Trazabilidad | Alta con correlation id. |
| Reintentos | Alta. Natural para colas. |
| Complejidad | Alta para primera entrega. |
| Despliegue | Mas piezas operativas. |

Recomendacion futura: adoptar event-driven cuando ya exista backend FE estable, alto volumen, jobs de reintento y necesidad de desacoplar POS.

### Opcion C: backend FE consulta ventas listas

Backend FE consulta periodicamente ventas marcadas como listas.

| Criterio | Evaluacion |
| --- | --- |
| Simplicidad | Media. Evita llamada directa inicial. |
| Consistencia | Media. Riesgo de polling atrasado y ventanas raras. |
| Trazabilidad | Media. Requiere tabla de cola o flags claros. |
| Reintentos | Media. Depende del poller. |
| Complejidad | Media. Puede acoplar backend FE a schema de `api/`. |
| Despliegue | Simple, pero aumenta dependencia de base compartida o endpoint de consulta. |

No recomendado como primera opcion si implica que backend FE lea tablas internas de `api/`. Puede usarse solo si `api/` expone un endpoint interno de ventas facturables.

## Recomendacion inicial

Para FE-2.6:

1. `api/` crea o finaliza la venta.
2. `api/` determina si requiere factura electronica.
3. `api/` arma snapshot facturable.
4. `api/` llama HTTP interno a `backend-facturacion-electronica/`.
5. Backend FE responde con `electronicInvoiceId`, `status`, `requestId` y `retryable`.
6. `api/` guarda o consulta el estado minimo para mostrarlo al usuario.
7. Backend FE continua con jobs/reintentos si el envio no termina de inmediato.

Para version futura:

- agregar outbox en `api/`;
- publicar eventos de venta facturable;
- consumir en backend FE;
- mantener HTTP solo para consultas, comandos manuales y reintentos administrativos.

## Estructura propuesta del nuevo backend

```text
backend-facturacion-electronica/
  src/
    modules/
      invoices/
      dian/
      providers/
      certificates/
      customers-sync/
      suppliers-sync/
      documents/
      events/
      retries/
      health/
    common/
    config/
```

### Modulos

| Modulo | Responsabilidad |
| --- | --- |
| `invoices` | Orquestar factura electronica, estados, CUFE/CUDE y snapshot. |
| `dian` | Contratos y normalizacion especifica DIAN. |
| `providers` | Adapters provider-agnostic: `MOCK_LOCAL`, proveedor tecnologico, DIAN directo si se aprueba. |
| `certificates` | Certificados, passwords, vigencia y almacenamiento seguro por tenant. |
| `customers-sync` | Sincronizacion o snapshots de adquiriente desde `api/`, sin ser owner de `customers`. |
| `suppliers-sync` | Sincronizacion fiscal de proveedores hacia `api/`, sin ser owner de `suppliers`. |
| `documents` | XML/UBL, PDF, archivos, storage y hashes. |
| `events` | Eventos FE, webhooks, aceptacion/rechazo, correlation ids. |
| `retries` | Jobs, backoff, reintentos, dead-letter logico. |
| `health` | Health checks, readiness, version y dependencias. |
| `common` | Guards internos, logging, errores, idempotencia, tracing. |
| `config` | Variables de entorno, provider config, ambientes. |

## Modelo conceptual

Estas entidades son conceptuales. No se crean migraciones en FE-2.1.

| Entidad | Proposito |
| --- | --- |
| `electronic_invoices` | Cabecera canonica del documento electronico: tenant, sale id, customer id, branch id, tipo, numero, CUFE/CUDE, estado y totales. |
| `electronic_invoice_items` | Lineas del documento con producto, cantidad, precio, unidad, impuestos y snapshot descriptivo. |
| `electronic_invoice_taxes` | Impuestos por linea o cabecera, base, porcentaje, valor y codigo fiscal. |
| `electronic_invoice_discounts` | Descuentos por linea o cabecera, razon, base y valor. |
| `electronic_invoice_events` | Eventos de ciclo de vida: created, generated, sent, accepted, rejected, retried, cancelled. |
| `electronic_invoice_provider_logs` | Logs tecnicos resumidos por provider, status code, mensaje, hash y correlation id. Raw response solo cifrado o storage seguro si se aprueba. |
| `electronic_invoice_files` | Referencias a XML, PDF, zip, attached document, hashes, storage key y metadata. |
| `electronic_invoice_settings` | Configuracion por tenant: ambiente, provider, resolucion, prefijo, modo mock/real y reglas de emision. |
| `electronic_invoice_certificates` | Certificados por tenant, vigencia, storage seguro, fingerprints y estado. |
| `fiscal_party_lookup_logs` | Logs seguros de consultas y sincronizaciones de customers/suppliers, sin raw response completo. |

## Flujos principales

### Venta POS a factura electronica

1. Venta POS se completa en `api/`.
2. `api/` valida tenant, sucursal, cliente, items, pagos y totales.
3. `api/` determina si la venta requiere factura electronica.
4. Si no hay cliente identificado, `api/` usa consumidor final tenant-aware.
5. `api/` arma snapshot facturable.
6. `api/` envia solicitud HTTP interna o deja venta marcada para futura emision.
7. Backend FE crea `electronic_invoice` en estado inicial.
8. Backend FE genera XML/UBL y CUFE.
9. Backend FE envia a DIAN/proveedor.
10. Backend FE guarda estado, eventos, logs tecnicos y archivos.
11. `api/` consulta estado para mostrarlo al usuario.
12. `backend-reporteria` puede leer estados via endpoint futuro o consumir un read model aprobado.

### Pedido a factura electronica

1. Pedido se confirma o se convierte en venta desde `api/`.
2. `api/` conserva la logica comercial de pedidos.
3. Cuando existe venta facturable, sigue el mismo flujo POS a backend FE.

### Reintento

1. Backend FE detecta error retryable de DIAN/proveedor.
2. `retries` agenda nuevo intento con backoff.
3. Cada intento registra evento y log tecnico resumido.
4. Si excede politica, estado queda `FAILED` o `REQUIRES_ATTENTION`.
5. `api/` solo muestra estado y accion operativa permitida.

### Webhook proveedor

1. Proveedor notifica cambio de estado al backend FE.
2. Backend FE valida firma/token/origen del webhook.
3. Backend FE actualiza estado y guarda evento.
4. `api/` consulta estado actualizado o recibe evento futuro.

## Que no se mueve todavia

No mover en FE-2.1 ni en el primer scaffolding:

- `customers` actuales.
- consumidor final en `api/`.
- POS.
- creacion de venta.
- pedidos.
- pagos.
- inventario.
- pricing.
- caja y metodos de pago.
- reporteria actual.
- endpoints `/api/customers`.
- funciones SQL operativas de venta o pedido.

## Fases propuestas

| Fase | Alcance |
| --- | --- |
| FE-2.1 | Diseno arquitectura backend especializado facturacion electronica. |
| FE-2.1R | Ajuste de diseno: backend FE como lookup/sync fiscal de customers y suppliers. |
| FE-2.2 | Prueba API local clientes FE actuales. |
| FE-2.3 | Diseno sync fiscal customers/suppliers, contratos internos e idempotencia. |
| FE-2.4 | Scaffolding `backend-facturacion-electronica/` sin logica DIAN real. |
| FE-2.5 | Adapter mock fiscal lookup. |
| FE-2.6 | Integracion backend FE -> `api` para upsert customer/supplier. |
| FE-2.7 | Integracion GetAcquirer real para customers. |
| FE-2.8 | Estrategia proveedor fiscal para suppliers. |

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Doble escritura entre `api/` y backend FE | Estados inconsistentes. | Idempotency key, correlation id y owner claro por entidad. |
| Duplicar facturas por reintento | Riesgo fiscal alto. | Unicidad por tenant, sale id y tipo de documento en backend FE. |
| Latencia DIAN/proveedor afecta POS | Mala experiencia en caja. | Procesamiento asincrono y estado `PENDING`. |
| Backend FE lee schema interno de `api/` | Acoplamiento fuerte. | Usar snapshot facturable versionado. |
| Certificados mal protegidos | Riesgo legal y de seguridad. | Storage seguro, cifrado, fingerprints y acceso minimo. |
| Raw response DIAN expuesto | Riesgo privacidad. | Guardar resumen operativo; raw solo cifrado o storage seguro si se aprueba. |
| Catalogos y reglas DIAN cambian | Rechazos o documentos invalidos. | Catalogos versionables y fuente vigente confirmada. |
| Reporteria se acopla a tablas FE | Fragilidad futura. | Endpoint/read model dedicado. |
| Tenant isolation incompleto | Fuga de datos. | Auth servicio-a-servicio y filtros obligatorios por tenant. |
| Sync fiscal sobrescribe datos manuales buenos | Perdida de informacion operativa. | Politica de campos permitidos, preview, auditoria before/after y confirmacion cuando aplique. |
| Crear suppliers duplicados por documento | Compras partidas entre proveedores duplicados. | Idempotencia y busqueda por tenant + documento normalizado antes de crear. |
| GetAcquirer se usa para suppliers sin soporte confirmado | Datos incompletos o error funcional. | Mantener suppliers provider-agnostic y no asumir GetAcquirer para proveedores. |

## Decisiones abiertas

1. Definir mecanismo exacto de auth servicio-a-servicio entre `api/` y backend FE.
2. Definir si backend FE tendra base de datos propia o schema dedicado en la misma instancia para primera version.
3. Definir storage de XML/PDF: filesystem local, S3 compatible, bucket privado u otro.
4. Definir proveedor tecnologico o DIAN directo para FE-2.7.
5. Definir manejo seguro de certificados y rotacion.
6. Definir contrato versionado del snapshot facturable.
7. Definir politica de reintentos, dead-letter y alertas.
8. Definir retencion de logs tecnicos y archivos.
9. Definir si `backend-reporteria` consume endpoint FE o read model.
10. Definir evento futuro y broker: outbox PostgreSQL, cola dedicada o bus externo.
11. Definir contrato de upsert interno para `customers`.
12. Definir contrato de upsert interno para `suppliers`.
13. Definir si `suppliers` recibira columnas fiscales equivalentes a `customers`.
14. Definir fuente fiscal aprobada para proveedores.
15. Definir politica de sobrescritura de datos manuales por fuente externa.

## Criterios para pasar a FE-2.2

1. Este diseno esta aprobado por producto/arquitectura.
2. OpenSpec valida en modo strict.
3. Se confirma que FE-2 actual se mantiene como modulo de clientes fiscales en `api/`.
4. Se confirma que no se moveran POS, ventas, pedidos, pagos, inventario ni pricing.
5. Se define nombre final del servicio y estrategia minima de configuracion.
6. Se define si el scaffolding inicial tendra base propia o solo health/config.
7. Se define el contrato minimo de health/readiness.
8. Se aprueba que backend FE sea capa de lookup/sync fiscal de customers y suppliers.
9. Se aprueba que `customers` y `suppliers` sigan como tablas operativas canonicas en `api/`.

## Guardrails FE-2.1

- No crear carpetas de backend nuevo.
- No modificar codigo funcional.
- No crear migraciones.
- No crear endpoints.
- No tocar frontend.
- No tocar `backend-reporteria`.
- No tocar SQL.
- No tocar PRD ni servidor remoto.
- No hacer commit.
