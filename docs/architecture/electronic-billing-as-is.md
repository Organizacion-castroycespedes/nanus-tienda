# Backend Facturación Electrónica: arquitectura AS-IS

Estado: implementación preparada y probada con dobles/fixtures; transmisión productiva a DIAN no verificada.

## Frontera del servicio

`backend-facturacion-electronica` es un NestJS dedicado. `AppModule` compone salud, base de datos, consumo de eventos, proveedores, consulta fiscal, sincronización, facturas, DIAN, certificados, documentos, reintentos y webhooks ([fuente](../../backend-facturacion-electronica/src/app.module.ts#L1-L26)). El módulo electrónico registra consumidor, repositorios de documentos, inbox, configuración por tenant, procesamiento y worker ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/electronic-billing.module.ts#L1-L80)).

## Contrato interno HTTP

El controlador usa el prefijo `/internal/electronic-billing`. Recibe `POST /events/sale-completed` con Bearer interno y un envelope versionado. También expone acciones internas de refresco, recuperación y reintento por `documentId` ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/consumers/electronic-billing-sale-event.controller.ts#L86-L220)). El token es una frontera de servicio; el cuerpo lleva `tenantId` para acciones documentales. No se verificó despliegue, rotación ni almacenamiento del token.

El consumidor valida el envelope, calcula hash estable del payload, crea referencia externa determinista por tenant/venta, busca duplicado por `eventId` y por fuente, y luego inserta el inbox dentro de una transacción ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/consumers/electronic-billing-sale-event.consumer.ts#L112-L220)). La respuesta distingue éxito, evento ya procesado y fallas temporales; el detalle completo depende de las ramas posteriores del consumidor.

## Persistencia

El DDL versionado `V072__electronic_billing_base_persistence.sql` define `tenant_electronic_billing_configs`, `electronic_documents`, líneas, impuestos, referencias, eventos, adjuntos y entregas. `V073__electronic_billing_inbox_events.sql` define el inbox. Los repositorios NestJS usan SQL directo y `DatabaseService`; no se encontró ORM.

La matriz de persistencia de B2.2 es la fuente consolidada: [persistencia AS-IS](../database/persistence-as-is.md). El esquema del repositorio no certifica que cada ambiente tenga exactamente esas tablas.

## Estados y recuperación

El modelo separa estado de documento y etapa de procesamiento. Las etapas verificadas son `PRE_PROVIDER_CREATE`, `PROVIDER_CREATE_INTENT`, `PROVIDER_LINKED`, `XML_GENERATE_INTENT`, `XML_GENERATED`, `SIGN_INTENT`, `SIGNED`, `PRE_TRANSMIT`, `TRANSMISSION_INTENT`, `TRANSMITTED`, `RECONCILIATION_REQUIRED`, `COMPLETED` y `UNKNOWN` ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/contracts/processing-state.ts#L1-L38)). Las reglas evitan repetir ciegamente una operación después de una mutación externa y ordenan reconciliar antes de reintentar.

El worker es opt-in mediante `ELECTRONIC_BILLING_BACKGROUND_ENABLED`, reclama documentos `PENDING`, `PROCESSING` y `TECHNICAL_ERROR`, aplica lease, refresca estado y difiere a revisión manual al superar reintentos ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/workers/electronic-billing-background.service.ts#L51-L159), [fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/workers/electronic-billing-background.service.ts#L254-L312)).

## Proveedores y nivel de evidencia

- `MOCK_LOCAL` es el default declarado en `.env.example`; el fake registra comandos y devuelve resultados sintéticos (`FAKE-*`) ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/providers/fake-electronic-billing-provider.ts#L128-L221)). Esto prueba el contrato interno, no una factura real.
- Existe adaptador FactuCore y código `DIAN_DIRECT`. La configuración declarada bloquea llamadas externas por defecto (`DIAN_ALLOW_EXTERNAL_CALLS=false`) y exige credenciales/configuración para ese modo ([fuente](../../backend-facturacion-electronica/.env.example#L1-L29)).
- Las pruebas `dian-direct-provider.spec.ts` usan fixtures y servidores SOAP locales. Son evidencia de parsing, validación y manejo de errores; no son evidencia de transmisión DIAN productiva.

No se afirma firma certificada, generación UBL/CUFE/CUDE completa, aceptación DIAN ni operación productiva. Esas capacidades requieren evidencia de ambiente y credenciales que no se consultaron.
