## ADDED Requirements

### Requirement: PDF del contrato para el cliente

El sistema SHALL generar en el servidor un PDF de una versión del contrato con los datos del emisor, del cliente y del tenant, las condiciones comerciales, los ítems con precios e IVA, los totales por frecuencia, las cláusulas y el espacio de firmas, y SHALL auditar cada descarga.

#### Scenario: Versión vigente

- **WHEN** el SUPER_ADMIN descarga el PDF de un contrato activo sin indicar versión
- **THEN** el sistema SHALL devolver un `application/pdf` de la versión vigente con nombre `<número>-v<versión>.pdf`.

#### Scenario: Versión anterior

- **WHEN** se descarga el PDF de una versión cerrada
- **THEN** el documento SHALL mostrar los precios y condiciones de esa versión, no los vigentes.

#### Scenario: Contrato en borrador

- **WHEN** se descarga el PDF de un contrato en borrador
- **THEN** el documento SHALL llevar la marca "BORRADOR".

#### Scenario: Versión de otro contrato

- **WHEN** el `versionId` no pertenece al contrato
- **THEN** el sistema SHALL responder 404.

### Requirement: Emisor desde la empresa del tenant plataforma y cláusulas configurables

El sistema SHALL tomar los datos del emisor de la empresa registrada en MANUS para el tenant plataforma (`public.tenants_detalles` y el logo de `public.tenants.config`), SHALL tomar las cláusulas del archivo `CONTROL_CENTER_CONTRACT_TERMS_FILE` cuando exista y SHALL usar cláusulas base incluidas cuando no exista.

#### Scenario: Datos de empresa actualizados

- **WHEN** se actualizan en MANUS la razón social, el NIT o el logo del tenant plataforma
- **THEN** el siguiente PDF SHALL mostrar los datos nuevos sin cambiar configuración del servidor.

#### Scenario: Logo externo

- **WHEN** el logo del tenant plataforma es una URL externa y no una imagen embebida
- **THEN** el PDF SHALL generarse sin logo y sin descargar la URL.

#### Scenario: Archivo de cláusulas

- **WHEN** existe el archivo de cláusulas con títulos `##` y párrafos
- **THEN** el PDF SHALL mostrar esas cláusulas en orden en lugar de las cláusulas base.

#### Scenario: Sin archivo de cláusulas

- **WHEN** no está configurado el archivo
- **THEN** el PDF SHALL incluir las cláusulas base, incluida la de tratamiento de datos personales.
