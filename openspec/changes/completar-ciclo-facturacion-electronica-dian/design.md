# Diseño

Los formularios mantienen `countryCode`, `departmentCode` y `municipalityCode` como estado interno. Los controles editables son únicamente `País`, `Departamento` y `Municipio`, respaldados por los catálogos existentes.

La selección de país limpia departamento y municipio; la selección de departamento limpia municipio. Al hidratar una edición, los códigos canónicos seleccionan automáticamente las entidades del catálogo.

El backend valida que la combinación de códigos exista en la jerarquía activa `paises -> departamentos -> municipios`. Para Colombia exige los tres códigos. La validación ocurre antes de persistir y antes de cualquier uso fiscal.

Los campos técnicos fiscales permanecen internos o de solo lectura según su naturaleza. `Consultar DIAN mock` continúa siendo una herramienta de desarrollo y no se convierte en una operación DIAN productiva.

## Contrato FactuCore-Manus

FactuCore expone en su estado de documento el identificador fiscal `uuid` como `cufe` para facturas, además de `status`, `statusDetail`, `fullNumber`, `acceptedAt` y `rejectedAt`. El último intento puede aportar `responseCode`, `responseMessage` y `externalTrackingId`; estos se normalizan como código, mensaje y `trackingId` de respuesta del proveedor.

Manus persiste `provider_document_id`, `provider_status`, `provider_status_detail`, `cufe`, `accepted_at` y `rejected_at`. El código, mensaje y tracking adicionales se conservan bajo `metadata.providerResponse`, sin copiar credenciales ni el payload bruto.

La reconciliación usa solo lecturas de estado por identificador o referencia externa. Es idempotente, conserva metadatos no nulos existentes y no crea, firma, genera XML ni transmite.

No hay campo probado para `validatedAt` o QR en el estado actual de FactuCore. Esos datos quedan abiertos para una evolución posterior. La representación de ticket y el procesamiento automático/global siguen pendientes.
