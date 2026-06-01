# Alineacion guia DIAN GetAcquirer - FE-3.0R

## Objetivo

Alinear el diseno `docs/diseno-dian-getacquirer-real-fe-3-0.md` con la Guia Herramienta para el Consumo de Web Services GetAcquirer, sin implementar codigo ni consumir DIAN real.

## Fuente revisada

- Archivo local: `C:\Users\Profe\Downloads\Guia-Herramienta-para-el-Consumo-de-Web-Services-GetAcquirer.pdf`.
- Paginas extraidas para validacion: 3 a 11.
- Herramienta usada: extraccion local de texto con runtime Python bundled y `pypdf`.

No se llamo ningun servicio DIAN. No se uso certificado real.

## Hallazgos de la guia

### Alcance funcional

GetAcquirer permite completar informacion del adquiriente/comprador para factura electronica.

Campos de request:

- `identificationType`.
- `identificationNumber`.

Datos esperados para normalizar:

- tipo de documento.
- numero de documento.
- nombre o razon social.
- correo de recepcion de factura electronica.

### Campos XML relacionados

La guia vincula la informacion obtenida con estos campos XML:

| Campo guia/XML | Campo normalizado backend FE |
| --- | --- |
| `AccountingCustomerParty / PartyIdentification / ID @schemeName` | `documentTypeCode` |
| `TaxRepresentativeParty / PartyIdentification / ID` | `documentNumber` / `documentNumberNormalized` |
| `AccountingCustomerParty / Contact / Name` | `legalName` |
| `AccountingCustomerParty / Contact / ElectronicMail` | `fiscalEmail` |

### Tipos de documento permitidos

| Codigo | Significado |
| --- | --- |
| `11` | Registro civil |
| `12` | Tarjeta de identidad |
| `13` | Cedula de ciudadania |
| `21` | Tarjeta de extranjeria |
| `22` | Cedula de extranjeria |
| `31` | NIT |
| `41` | Pasaporte |
| `42` | Documento de identificacion extranjero |
| `47` | PEP |
| `48` | PPT |
| `50` | NIT de otro pais |
| `91` | NUIP |

Impacto: el catalogo `dian_document_types` debe considerar `50` y `91`, que no estaban resaltados en el diseno inicial.

### Requerimientos tecnicos

- WSDL: la URL del Web Service se obtiene desde el catalogo de participante DIAN, en habilitacion o produccion.
- Keystore/certificado: se configura certificado y password.
- WS-Security Signature: se configura una entrada de firma usando certificado y password.
- Timestamp: la vigencia del token de seguridad se configura en milisegundos.
- Authentication: el request GetAcquirer requiere autenticacion y seleccion de la configuracion WS-Security.
- WS-A addressing: se habilitan WS-A addressing y `wsa:To`.
- `Content-Type` action: la solicitud debe incluir el action `http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer`.

## Cambios aplicados al diseno FE-3.0

Archivo actualizado:

- `docs/diseno-dian-getacquirer-real-fe-3-0.md`.

Cambios:

- Reemplazada nota de PDF no encontrado por referencia real al PDF local.
- WSDL alineado con catalogo de participante DIAN.
- Request confirmado con `identificationType` e `identificationNumber`.
- Agregada tabla de tipos de documento permitidos.
- Agregado mapping XML a campos normalizados.
- Agregado `Authentication`.
- Agregado `DIAN_WS_SECURITY_TIMESTAMP_TTL_MS` como variable futura para timestamp en milisegundos.
- Confirmado action GetAcquirer.
- Pruebas alineadas con tabla de prueba de habilitacion.

## Decisiones

1. `DIAN_DIRECT` aplica inicialmente solo a `CUSTOMER`/adquiriente.
2. `SUPPLIER` sigue provider-agnostic.
3. GetAcquirer no se asume como fuente unica ni valida para proveedores.
4. No se guardara raw SOAP response por defecto.
5. Se mantendra `requestHash` y `responseSummary`.
6. CI no consumira DIAN real.
7. Fixtures locales deben basarse en XML/SOAP y tabla de habilitacion de la guia.

## Riesgos vivos

| Riesgo | Mitigacion |
| --- | --- |
| Algoritmos exactos WS-Security no quedan legibles por extraccion textual del PDF | Confirmar visualmente imagenes/configuracion de la guia antes de implementar. |
| WSDL cambia por ambiente | Resolver siempre desde catalogo de participante DIAN. |
| Certificado/password expuestos por logs | Sanitizar logs y nunca imprimir secretos. |
| Tabla de prueba parcial extraida por PDF | Construir fixture completo desde revision manual del PDF antes de codificar tests. |
| Usar GetAcquirer para suppliers | Bloquear `DIAN_DIRECT` para `SUPPLIER` hasta fuente aprobada. |

## Preguntas abiertas

1. Algoritmo exacto de firma indicado en la imagen de WS-Security Signature.
2. Algoritmo exacto de digest.
3. Canonicalization exacta.
4. Si la implementacion propia requiere basic auth adicional o solo seleccion de WS-Security/certificado.
5. Version SOAP efectiva del WSDL vigente.
6. Valor de timestamp recomendado para habilitacion y produccion.

## Confirmacion de alcance

- No se implemento DIAN real.
- No se creo cliente SOAP.
- No se configuraron certificados.
- No se modifico `api/`.
- No se modifico `backend-facturacion-electronica/`.
- No se modifico frontend.
- No se modifico SQL.
- No se toco PRD.
- No se hizo commit.
