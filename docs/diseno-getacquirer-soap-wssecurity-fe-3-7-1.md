# Diseno GetAcquirer SOAP/WS-Security - FE-3.7.1

## Objetivo

Seleccionar estrategia tecnica para implementar en fase futura el consumo real de DIAN GetAcquirer con SOAP, WS-Addressing, WS-Security, certificado X.509 y firma XML.

Esta fase solo documenta. No implementa DIAN real, no instala librerias, no llama red DIAN y no usa certificados reales.

## Alcance revisado

Artefactos del repo:

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.ts`.
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.config.ts`.
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.ts`.
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.types.ts`.
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts`.
- `docs/diseno-dian-getacquirer-real-fe-3-0.md`.
- `docs/alineacion-guia-dian-getacquirer-fe-3-0R.md`.
- `docs/evidencia-getacquirer-skeleton-fe-3-5.md`.
- `backend-facturacion-electronica/src/modules/providers/dian/dian-get-acquirer.request-builder.ts`.
- `backend-facturacion-electronica/src/modules/providers/dian/dian-ws-security.builder.ts`.
- `backend-facturacion-electronica/test/dian-direct-provider.spec.ts`.

Fuentes externas consultadas para librerias y estandares:

- `node-soap`: https://github.com/vpulim/node-soap
- `xml-crypto`: https://github.com/node-saml/xml-crypto
- `node-forge`: https://github.com/digitalbazaar/forge
- `@xmldom/xmldom`: https://github.com/xmldom/xmldom
- `fast-xml-parser`: https://github.com/NaturalIntelligence/fast-xml-parser
- W3C XML Signature 1.1: https://www.w3.org/TR/xmldsig-core1/
- W3C WS-Addressing Core: https://www.w3.org/TR/ws-addr-core/
- OASIS WS-Security X.509 Token Profile 1.1.1: https://docs.oasis-open.org/wss-m/wss/v1.1.1/os/wss-x509TokenProfile-v1.1.1-os.html

## Estado actual en `api`

`ThirdPartyLookupGetAcquirerAdapter` ya existe como skeleton seguro:

- Provider: `DIAN_GET_ACQUIRER`.
- Modo: `real`.
- Operacion: `GetAcquirer`.
- `externalCallEnabled=false`.
- Mapea `documentTypeCode` a `identificationType`.
- Mapea `documentNumberNormalized` a `identificationNumber`.
- Marca `certificateConfigured` y `certificatePasswordConfigured` sin incluir valores.
- Retorna `REAL_LOOKUP_NOT_IMPLEMENTED` para customer real configurado.
- Rechaza suppliers con `UNSUPPORTED_PARTY_TYPE`.
- No expone raw SOAP, certificado, password ni tokens.

`resolveThirdPartyLookupConfig` ya soporta:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true|false
DIAN_THIRD_PARTY_LOOKUP_MODE=disabled|mock|real
DIAN_GET_ACQUIRER_WSDL_URL=
DIAN_GET_ACQUIRER_ENDPOINT_URL=
DIAN_CERTIFICATE_PATH=
DIAN_CERTIFICATE_PASSWORD=
DIAN_GET_ACQUIRER_TIMEOUT_MS=15000
```

`assertGetAcquirerConfig` valida en modo real:

- WSDL requerido.
- Endpoint requerido.
- Certificate path requerido.
- Certificate password requerido.
- URLs validas.
- Timeout positivo.
- Error claro sin imprimir secretos.

## Estructura esperada GetAcquirer

Entrada normalizada:

| Campo interno | Campo DIAN |
| --- | --- |
| `documentTypeCode` | `identificationType` |
| `documentNumberNormalized` | `identificationNumber` |

SOAP envelope esperado:

- `soap:Envelope`.
- `soap:Header`.
- `soap:Body`.
- Body con operacion `GetAcquirer`.
- Body con `identificationType`.
- Body con `identificationNumber`.

WS-Addressing esperado:

- `wsa:Action`.
- `wsa:To`.
- `wsa:MessageID`.
- `wsa:ReplyTo` si WSDL/guia vigente lo exige.

Action GetAcquirer confirmado por documentacion previa:

```text
http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
```

WS-Security esperado:

- `wsse:Security`.
- `wsu:Timestamp`.
- `wsu:Created`.
- `wsu:Expires`.
- `wsse:BinarySecurityToken` con certificado X.509 publico codificado, si la guia vigente lo exige.
- `ds:Signature`.
- `ds:SignedInfo`.
- `ds:Reference` al `soap:Body`.
- `ds:Reference` al `wsu:Timestamp`.
- Referencias a headers WS-A si DIAN/WSDL lo exige.
- `ds:KeyInfo` o `wsse:SecurityTokenReference` al token X.509, segun perfil final.

HTTP esperado:

- Si binding final es SOAP 1.2: `Content-Type: application/soap+xml; charset=utf-8; action="<action>"`.
- Si binding final es SOAP 1.1: `Content-Type: text/xml; charset=utf-8` y header `SOAPAction`.
- La version final debe salir del WSDL vigente, no de suposicion.

## Recomendacion tecnica

Recomendacion principal:

Usar envelope controlado + firma XML controlada, no depender de generacion SOAP opaca.

Stack sugerido para fase de implementacion:

| Necesidad | Libreria sugerida | Motivo |
| --- | --- | --- |
| Firma XMLDSig | `xml-crypto` | Soporta XML Signature, algoritmos RSA-SHA256, SHA256, canonicalization y referencias por XPath. |
| DOM XML para firma | `@xmldom/xmldom` | `xml-crypto` lo usa comunmente para parsear/serializar DOM en Node. |
| P12/PFX a material PEM en memoria | `node-forge` | Tiene utilidades PKI/PKCS#12/X.509 en JavaScript. |
| Parseo de respuesta y fixtures | `fast-xml-parser` | Parser/validator/builder rapido sin C/C++ nativo. |
| Transporte SOAP | `fetch` nativo Node 18 con `AbortController` | Menos dependencias y control exacto de headers/body. |
| WSDL/client SOAP opcional | `soap` (`node-soap`) | Candidato secundario para spike; tiene `WSSecurityCert`, `ClientSSLSecurityPFX` y referencias adicionales, pero puede ocultar detalles de namespaces/firma. |

Decision:

- Implementar `DianWsSecuritySigner` con `xml-crypto`.
- Mantener request builder propio, pero basado en builder/DOM, no concat de strings para la version real.
- Usar `node-forge` solo para cargar `.p12/.pfx` y extraer private key/cert en memoria.
- Enviar con `fetch` nativo para controlar `Content-Type`, `SOAPAction`, timeout y sanitizacion.
- Hacer un spike con `soap` solo si el WSDL DIAN vigente exige behavior dificil de replicar manualmente.

Por que no usar `soap` como primera opcion:

- Puede generar namespaces, IDs y orden de headers distinto al fixture esperado.
- Puede firmar nodos de forma correcta pero dificil de auditar si DIAN rechaza.
- Para GetAcquirer el body es pequeno; el mayor riesgo esta en firma WS-Security, no en invocar metodos WSDL.

Por que no hand-rollear criptografia:

- XML Signature tiene canonicalization, transforms, digest y signed references. Un string firmado "a mano" es facil de romper.
- `xml-crypto` permite firmar nodos especificos y validar fixtures.

## Arquitectura futura propuesta

Mantener `ThirdPartyLookupGetAcquirerAdapter` como borde provider-agnostic y extraer componentes:

```text
api/src/modules/electronic-invoicing/third-party-lookup/get-acquirer/
  get-acquirer-soap-envelope.builder.ts
  get-acquirer-wsa.builder.ts
  get-acquirer-ws-security.signer.ts
  get-acquirer-certificate.loader.ts
  get-acquirer-http.client.ts
  get-acquirer-response.mapper.ts
  get-acquirer-soap-error.mapper.ts
  get-acquirer-sanitizer.ts
```

Responsabilidades:

- `soap-envelope.builder`: construye XML base con IDs estables para `Body`, `Timestamp`, `Action`, `To` y `MessageID`.
- `wsa.builder`: genera Action/To/MessageID/ReplyTo.
- `ws-security.signer`: agrega Timestamp, BinarySecurityToken, SignedInfo, SignatureValue y referencias firmadas.
- `certificate.loader`: lee `.p12/.pfx`, valida existencia/formato/expiracion minima y retorna PEM en memoria.
- `http.client`: envia SOAP con timeout, sin loggear headers sensibles.
- `response.mapper`: normaliza FOUND/NOT_FOUND/ERROR a `ThirdPartyLookupPreview`.
- `soap-error.mapper`: convierte fault/timeout/auth/cert errors a codigos seguros.
- `sanitizer`: elimina raw SOAP, password, private key, certificate body y tokens de errores/logs.

## Algoritmos y detalles pendientes

Antes de implementar se debe confirmar contra WSDL/guia vigente:

- SOAP 1.1 vs SOAP 1.2.
- Canonicalization exacta.
- Digest exacto.
- Signature algorithm exacto.
- Transform exacto por referencia.
- Nodos firmados exactos: Body, Timestamp, WS-A headers.
- Formato exacto de `BinarySecurityToken`.
- Formato exacto de `SecurityTokenReference`.
- Si se requiere TLS client auth adicional a firma XML.
- Si se requiere basic auth adicional. Si aplica, debe ser secreto separado.

Defaults tecnicos propuestos hasta confirmar:

- Signature: RSA-SHA256.
- Digest: SHA256.
- Canonicalization: exclusive c14n.
- Timestamp TTL: 300000 ms.
- Timeout request: 15000 ms.

Estos defaults no deben activar DIAN real sin validacion.

## Config futura sugerida

Mantener config actual y evaluar agregar en fase posterior:

```env
DIAN_GET_ACQUIRER_ACTION=http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
DIAN_WS_SECURITY_TIMESTAMP_TTL_MS=300000
DIAN_ENVIRONMENT=HABILITACION|PRODUCCION
DIAN_ALLOW_EXTERNAL_CALLS=false
DIAN_GET_ACQUIRER_SOAP_VERSION=auto|1.1|1.2
```

Reglas:

- `DIAN_ALLOW_EXTERNAL_CALLS=false` por defecto.
- `DIAN_ENVIRONMENT=PRODUCCION` debe quedar bloqueado sin aprobacion explicita.
- Errores de config muestran nombres de variables, nunca valores.
- Certificado y password nunca se guardan en DB ni docs.

## Estrategia de pruebas con fixtures

No usar DIAN real en CI.

Pruebas unitarias:

- Construye body `GetAcquirer` con `identificationType`.
- Construye body `GetAcquirer` con `identificationNumber`.
- Genera WS-A Action/To/MessageID.
- Genera Timestamp con `Created < Expires`.
- Rechaza supplier en modo real.
- Falla si falta WSDL/endpoint/cert/password.
- Sanitiza password/cert/private key en errores.

Pruebas de firma con certificado fixture:

- Usar certificado self-signed local de test, nunca certificado DIAN real.
- Firmar `Body`.
- Firmar `Timestamp`.
- Firmar WS-A headers si el contrato final lo exige.
- Verificar con `xml-crypto` que los `SignedReferences` corresponden a los nodos esperados.
- Snapshot XML firmado sin secretos.

Pruebas de parser:

- Fixture FOUND.
- Fixture NOT_FOUND.
- Fixture SOAP fault.
- Fixture XML invalido.
- Fixture sin email.
- Fixture con email invalido.
- Fixture con namespaces en orden distinto.

Pruebas de integracion local:

- Mock SOAP HTTP local.
- Timeout local.
- HTTP 401/403 local.
- HTTP 500 local.
- Red externa bloqueada por `DIAN_ALLOW_EXTERNAL_CALLS=false`.

Pruebas de seguridad:

- No raw SOAP en response API.
- No raw SOAP en logs por defecto.
- No password en errores.
- No private key/cert body en evidencia.
- XML parser sin DTD/entidades externas.
- Documento enmascarado en logs.

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Canonicalization incorrecta | DIAN rechaza firma. | Fixtures firmados, `xml-crypto`, validacion contra WSDL/guia. |
| Nodos firmados incompletos | Rechazo o riesgo de manipulacion. | Definir lista de referencias y test `SignedReferences`. |
| XML Signature Wrapping | Uso de datos no firmados. | IDs unicos, validar referencias y no leer nodos no firmados en response si se verifica firma futura. |
| Certificado/password expuestos | Riesgo legal y seguridad. | Sanitizer, no raw, no logs, no evidencia. |
| P12/PFX incompatible | No se puede firmar. | Loader con `node-forge`, tests por formato, error seguro. |
| `soap` genera XML opaco | Dificil debug DIAN. | Usar solo como spike/fallback, preferir envelope controlado. |
| XML parser vulnerable o XXE | Exposicion/DoS. | Desactivar DTD/entidades, SCA antes de instalar, fixtures negativos. |
| Produccion activada por error | Riesgo operativo. | `DIAN_ALLOW_EXTERNAL_CALLS=false`, bloqueo `PRODUCCION`. |
| Latencia DIAN bloquea POS | Mala UX. | Timeout bajo, fallback manual, POS no bloqueante. |
| GetAcquirer usado en suppliers | Fuente equivocada. | Mantener `UNSUPPORTED_PARTY_TYPE` para suppliers. |

## Siguientes fases

### FE-3.7.2 Dependency spike sin DIAN real

- No llamada DIAN.
- Instalar candidatas solo si se aprueba.
- Probar `xml-crypto`, `@xmldom/xmldom`, `node-forge`, `fast-xml-parser`.
- Opcional: spike `soap` con WSSecurityCert contra fixture local.
- Elegir versiones con `npm audit`/SCA.

### FE-3.7.3 Request builder real con fixtures

- Crear builder SOAP/WS-A/WS-Security sin firma real o con firma fixture.
- Crear snapshots XML seguros.
- Mantener external calls bloqueadas.

### FE-3.7.4 Firma XML con certificado fixture

- Cargar P12/PFX self-signed de test o generarlo en test.
- Firmar nodos requeridos.
- Validar references.
- No usar certificado DIAN real.

### FE-3.7.5 Mock SOAP local firmado

- Mock HTTP local valida action, headers y estructura firmada.
- Parser normaliza FOUND/NOT_FOUND/FAULT.
- No red externa.

### FE-3.8 Habilitacion controlada

- Solo con WSDL/endpoint DIAN de habilitacion aprobados.
- Solo con certificado de habilitacion fuera del repo.
- Solo con `DIAN_ALLOW_EXTERNAL_CALLS=true` durante ventana aprobada.
- Guardar solo resumen seguro.

## Decision final FE-3.7.1

Libreria sugerida para firma XML: `xml-crypto`.

Stack sugerido completo:

- `xml-crypto` para XMLDSig.
- `@xmldom/xmldom` para DOM XML.
- `node-forge` para P12/PFX.
- `fast-xml-parser` para response parsing y fixtures.
- `fetch` nativo Node 18 para transporte.
- `soap` solo como spike/fallback, no como base primaria.

Confirmacion de alcance:

- No se implemento DIAN real.
- No se instalaron librerias.
- No se hizo llamada DIAN real.
- No se uso certificado real.
- No se guardaron secretos.
- No se toco PRD.
- No se uso remoto.
- No se hizo commit.
