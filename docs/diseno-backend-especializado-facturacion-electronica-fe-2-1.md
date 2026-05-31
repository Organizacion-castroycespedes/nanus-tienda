# Diseno backend especializado facturacion electronica - FE-2.1

## Resumen ejecutivo

FE-2 implemento correctamente clientes fiscales, catalogo de tipos de documento y consumidor final dentro de `api/`. Esa decision se mantiene porque `customers.id` ya es el identificador canonico usado por POS, ventas, pedidos y reportes.

La vision estrategica requiere un backend especializado para facturacion electronica. Ese nuevo servicio no debe reemplazar el modulo actual de clientes ni mover POS. Debe nacer como un bounded context separado para el ciclo de vida del documento electronico: generacion XML/UBL, CUFE, envio a DIAN o proveedor tecnologico, estados, reintentos, logs tecnicos, certificados, archivos, webhooks y eventos de aceptacion o rechazo.

Decision principal: `api/` queda como sistema de registro operativo de venta, cliente, pagos, sucursal y preparacion facturable. `backend-facturacion-electronica/` sera el sistema de registro del documento electronico y su estado tecnico-fiscal.

## Decision arquitectonica

Se adopta una arquitectura distribuida gradual:

1. `api/` conserva clientes fiscales, consumidor final, ventas, pedidos, pagos, inventario y endpoints operativos para POS/Orders.
2. `backend-facturacion-electronica/` nace como servicio especializado para documentos electronicos y comunicacion DIAN/proveedor.
3. La primera integracion recomendada es HTTP interno desde `api/` hacia el backend FE, con idempotencia y respuesta de estado controlada.
4. La evolucion futura debe migrar a eventos con outbox/event bus cuando existan mayor volumen, reintentos automaticos y necesidad de desacoplar latencia del POS.

FE-2 queda justificado como modulo de clientes fiscales en `api/` porque la identidad del adquiriente pertenece al flujo comercial y debe seguir alimentando `/api/customers`, `sales.customer_id`, `orders.customer_id` y consumidor final tenant-aware.

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

## Responsabilidades

| Area | `api/` | `backend-facturacion-electronica/` |
| --- | --- | --- |
| Clientes fiscales | Si. CRUD fiscal sobre `customers`. | Solo lectura/sync si necesita snapshot. |
| Consumidor final | Si. Unico por tenant. | Lo usa como adquiriente cuando aplique. |
| Ventas POS | Si. Creacion, pagos, inventario, caja. | No. Recibe snapshot facturable. |
| Pedidos | Si. Creacion, estados y conversion operativa. | No. Recibe solicitud si deriva en documento FE. |
| Relacion venta-cliente | Si. `sales.customer_id` y `orders.customer_id`. | Referencia por ids y snapshot. |
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
        |
        v
[DIAN o proveedor tecnologico]
```

`api/` debe seguir respondiendo a los usuarios operativos. El backend FE puede procesar de forma asincrona controlada para no bloquear POS con latencia de DIAN/proveedor.

El contrato entre servicios debe ser un snapshot facturable, no una consulta libre a tablas operativas. Ese snapshot debe incluir version, tenant, venta, cliente, sucursal, items, impuestos, descuentos, pagos relevantes y totales calculados. Asi el documento electronico queda reproducible aunque luego cambie el cliente o la venta.

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
| FE-2.2 | Scaffolding `backend-facturacion-electronica/` sin logica DIAN real. |
| FE-2.3 | Health/config, variables base, logging, version y readiness. |
| FE-2.4 | Modelo de documentos electronicos y migraciones propias del servicio. |
| FE-2.5 | Mock provider para generacion y estados controlados. |
| FE-2.6 | Integracion `api/` a backend FE por HTTP interno con idempotencia. |
| FE-2.7 | Integracion DIAN/proveedor real, certificados y ambientes. |
| FE-2.8 | Frontend estado FE para POS/ventas/clientes. |
| FE-2.9 | Reportes FE y consumo seguro desde `backend-reporteria` o endpoint dedicado. |

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

## Criterios para pasar a FE-2.2

1. Este diseno esta aprobado por producto/arquitectura.
2. OpenSpec valida en modo strict.
3. Se confirma que FE-2 actual se mantiene como modulo de clientes fiscales en `api/`.
4. Se confirma que no se moveran POS, ventas, pedidos, pagos, inventario ni pricing.
5. Se define nombre final del servicio y estrategia minima de configuracion.
6. Se define si el scaffolding inicial tendra base propia o solo health/config.
7. Se define el contrato minimo de health/readiness.

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
