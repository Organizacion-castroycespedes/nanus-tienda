# Diseno tecnico DIAN GetAcquirer real - FE-3.0

## Resumen ejecutivo

FE-3.0 disena el adapter real `DIAN_DIRECT` para consultar DIAN GetAcquirer desde `backend-facturacion-electronica`, sin implementarlo todavia.

La meta es reemplazar o complementar `MOCK_LOCAL` para customers/adquirientes con una integracion SOAP segura, firmada y trazable. La sincronizacion hacia `api/` sigue usando el flujo ya probado en FE-2.6.

Este diseno no consume DIAN real, no configura certificados reales, no crea endpoints nuevos y no modifica codigo.

## Fuentes analizadas

- Guia Herramienta para el Consumo de Web Services GetAcquirer, archivo local `C:\Users\Profe\Downloads\Guia-Herramienta-para-el-Consumo-de-Web-Services-GetAcquirer.pdf`.
- OpenSpec actual `add-electronic-invoicing-customer-backend`.
- Diseno FE-2.1/FE-2.1R de backend especializado y lookup/sync fiscal.
- Scaffolding actual de `backend-facturacion-electronica` con `FiscalProviderAdapter`, `MOCK_LOCAL`, `POST /fiscal-lookup/preview` y `POST /fiscal-lookup/sync`.

La guia DIAN confirma que GetAcquirer completa informacion del adquiriente/comprador para factura electronica usando `identificationType` e `identificationNumber`.

## Decision tecnica

Crear en fase posterior un adapter `DIAN_DIRECT` dentro de `backend-facturacion-electronica`.

`DIAN_DIRECT` debe:

- Implementar la interfaz actual `FiscalProviderAdapter`.
- Aplicar solo a `partyType=CUSTOMER` inicialmente.
- Mapear `documentTypeCode` a `identificationType`.
- Mapear `documentNumberNormalized` a `identificationNumber`.
- Construir request SOAP firmado con WS-Security.
- Usar certificado configurado por secreto o ruta local segura.
- Usar WS-A addressing y `Content-Type` con `action`.
- Normalizar la respuesta a `FiscalLookupResult`.
- No guardar raw SOAP request/response por defecto.
- Devolver errores controlados y seguros.

Suppliers quedan fuera de GetAcquirer hasta confirmar fuente oficial. Para suppliers se mantiene `TECH_PROVIDER`, fuente manual/RUT u otra fuente aprobada.

## Requerimientos tecnicos DIAN

### WSDL

El adapter debe leer `DIAN_WSDL_URL`.

Reglas:

- La guia indica que la URL WSDL del Web Service se obtiene desde el catalogo de participante DIAN, en habilitacion o produccion, bajo la opcion de participantes/facturador.
- No hardcodear URL DIAN en codigo.
- Validar WSDL al iniciar solo si `FISCAL_PROVIDER=DIAN_DIRECT` y una bandera futura de fail-fast lo permite.
- Permitir lazy load del WSDL para no tumbar el servicio por indisponibilidad temporal de DIAN.
- Cachear metadata WSDL durante el proceso si la libreria SOAP lo soporta.
- Fallar con error `WSDL_UNAVAILABLE` si no puede cargar WSDL al momento de consultar.

### Request GetAcquirer

Entrada funcional minima:

- `identificationType`: viene de `documentTypeCode`.
- `identificationNumber`: viene de `documentNumberNormalized`.

Reglas:

- Normalizar documento antes de llamar DIAN.
- No enviar espacios, puntos ni guiones.
- Validar que `documentTypeCode` exista en catalogo operativo antes de permitir DIAN real, cuando el catalogo este sembrado.
- Para NIT, el DV puede existir localmente, pero la guia GetAcquirer solo presenta `identificationType` e `identificationNumber` como datos del request. El adapter no debe agregar un campo DV al SOAP hasta confirmar otra especificacion vigente.

### Tipos de documento permitidos por la guia

La guia lista estos valores de `identificationType`:

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

Reglas:

- Estos codigos deben ser tratados como catalogo versionable, no hardcodeados en controllers.
- El mock/fixtures de FE-3 deben usar la tabla de prueba de habilitacion incluida en la guia.
- El catalogo operativo `dian_document_types` debe incluir `50` y `91` cuando se siembre desde esta fuente o desde fuente DIAN vigente equivalente.

### Certificado y keystore

El adapter debe soportar certificado cliente para firma WS-Security.

Opciones de carga:

- `DIAN_CERT_PATH`: ruta local segura a `.p12`, `.pfx` o formato aprobado.
- `DIAN_CERT_PASSWORD`: password via secreto de entorno.

Reglas:

- No guardar certificado en repo.
- No loggear ruta completa si contiene datos sensibles.
- No loggear password.
- No persistir material de llave privada.
- Cargar certificado en memoria solo en runtime.
- Validar expiracion y alias si el formato lo exige.
- Fallar con `CERTIFICATE_INVALID` si no se puede leer, desbloquear o usar.

### WS-Security Signature

La solicitud debe incluir WS-Security con firma digital basada en X.509.

Elementos esperados:

- `wsse:Security`.
- `wsu:Timestamp`.
- `wsse:BinarySecurityToken` o referencia equivalente al certificado.
- `ds:Signature`.
- Referencias firmadas al `soap:Body`.
- Referencias firmadas a `Timestamp` y headers WS-A si la guia vigente lo exige.

Pendiente de confirmacion contra guia oficial vigente:

- Algoritmo exacto de canonicalizacion.
- Algoritmo exacto de digest.
- Algoritmo exacto de firma.
- Lista exacta de nodos firmados.
- Formato exacto de `KeyInfo` y `SecurityTokenReference`.

Decision de diseno:

- No hand-rollear criptografia XML si existe libreria estable y auditable.
- Encapsular firma en `DianWsSecuritySigner`.
- Cubrir con fixtures XML unitarios para evitar regresiones de namespaces.

### Timestamp

El request debe incluir timestamp WS-Security.

Reglas propuestas:

- `Created`: hora UTC actual.
- `Expires`: `Created + 5 minutos` por defecto, configurable si guia DIAN exige otro valor.
- La guia indica que el tiempo de vigencia del token de seguridad `Timestamp` se configura en milisegundos. El adapter debe expresar la configuracion runtime como `DIAN_WS_SECURITY_TIMESTAMP_TTL_MS` o derivarla de `DIAN_TIMEOUT_MS` solo si se decide explicitamente.
- Rechazar reloj local demasiado desviado si se detecta error DIAN asociado.
- No reusar mensajes firmados.

### Authentication

La guia muestra que el request GetAcquirer debe configurar autenticacion y seleccionar la configuracion WS-Security creada previamente.

Reglas:

- El adapter debe separar autenticacion de transporte, firma WS-Security y certificado.
- Si se requiere basic auth en el binding final, sus credenciales deben venir de secretos y nunca de codigo.
- No loggear headers de autenticacion.
- No mezclar `API_INTERNAL_TOKEN` con credenciales DIAN.

### WS-A addressing

El request SOAP debe incluir headers WS-Addressing.

Headers esperados:

- `wsa:Action`: valor de `DIAN_GET_ACQUIRER_ACTION`.
- `wsa:To`: endpoint efectivo derivado del WSDL o configuracion.
- `wsa:MessageID`: `urn:uuid:<uuid>`.
- `wsa:ReplyTo`: valor anonimo si la guia lo exige.

Reglas:

- `MessageID` nuevo por intento.
- Incluir `Action` tambien en `Content-Type` para SOAP 1.2.
- Confirmar si DIAN exige header HTTP `SOAPAction` adicional para SOAP 1.1.

### Content-Type action

El request debe enviar el action correcto.

Action confirmado por la guia:

```text
http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
```

Diseño base para SOAP 1.2:

```http
Content-Type: application/soap+xml; charset=utf-8; action="<DIAN_GET_ACQUIRER_ACTION>"
```

Si el WSDL/guia exige SOAP 1.1, usar:

```http
Content-Type: text/xml; charset=utf-8
SOAPAction: "<DIAN_GET_ACQUIRER_ACTION>"
```

La version final debe seguir el binding del WSDL vigente.

## Variables de entorno

Variables requeridas para fase de implementacion:

| Variable | Requerida cuando | Ejemplo seguro | Uso |
| --- | --- | --- | --- |
| `FISCAL_PROVIDER` | siempre | `MOCK_LOCAL` o `DIAN_DIRECT` | Selecciona adapter. |
| `DIAN_WSDL_URL` | `DIAN_DIRECT` | vacio en repo | WSDL o endpoint DIAN segun ambiente. |
| `DIAN_CERT_PATH` | `DIAN_DIRECT` | vacio en repo | Ruta a certificado/keystore local seguro. |
| `DIAN_CERT_PASSWORD` | `DIAN_DIRECT` | secreto | Password del certificado. |
| `DIAN_ENVIRONMENT` | `DIAN_DIRECT` | `HABILITACION` o `PRODUCCION` | Ambiente DIAN. |
| `DIAN_TIMEOUT_MS` | opcional | `10000` | Timeout total por request SOAP. |
| `DIAN_GET_ACQUIRER_ACTION` | opcional | valor oficial GetAcquirer | Action WS-A/SOAP. |
| `DIAN_WS_SECURITY_TIMESTAMP_TTL_MS` | opcional | `300000` | Vigencia del token WS-Security Timestamp en milisegundos. |

Defaults propuestos:

- `FISCAL_PROVIDER=MOCK_LOCAL`.
- `DIAN_TIMEOUT_MS=10000`.
- `DIAN_GET_ACQUIRER_ACTION=http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer`.

Reglas:

- `.env.example` futuro puede listar variables vacias, nunca secretos.
- En produccion, `DIAN_CERT_PASSWORD` debe venir de secret manager o mecanismo equivalente.
- `DIAN_ENVIRONMENT` no debe inferir produccion por default.

## Interfaz del adapter

La interfaz actual se mantiene:

```ts
interface FiscalProviderAdapter {
  lookupParty(input: FiscalLookupInput): Promise<FiscalLookupResult>;
}
```

Entrada actual:

```ts
type FiscalLookupInput = {
  partyType: "CUSTOMER" | "SUPPLIER";
  documentTypeCode: string;
  documentNumber: string;
  documentNumberNormalized: string;
};
```

Salida normalizada actual:

```ts
type FiscalLookupResult = {
  provider: "MOCK_LOCAL" | "DIAN_DIRECT" | "TECH_PROVIDER";
  partyType: "CUSTOMER" | "SUPPLIER";
  documentTypeCode: string;
  documentNumberNormalized: string;
  legalName: string;
  fiscalEmail: string;
  lookupStatus: "FOUND" | "NOT_FOUND" | "ERROR" | "SKIPPED";
  message: string;
};
```

Extension recomendada para fase posterior:

- `statusCode?: string`.
- `requestHash?: string`.
- `responseSummary?: Record<string, unknown>`.
- `retryable?: boolean`.
- `providerCorrelationId?: string`.
- `lookupAt?: string`.

No se debe romper el contrato ya usado por sync mock. Cualquier extension debe ser aditiva.

## Flujo DIAN_DIRECT

1. `FiscalLookupService` o `SyncService` recibe solicitud.
2. Normaliza `documentNumber`.
3. `ProvidersModule` resuelve `DIAN_DIRECT`.
4. `DianDirectFiscalProvider.lookupParty` valida `partyType=CUSTOMER`.
5. Construye input DIAN:
   - `identificationType = documentTypeCode`.
   - `identificationNumber = documentNumberNormalized`.
6. Carga WSDL/endpoint.
7. Carga certificado en memoria.
8. Construye SOAP envelope.
9. Agrega WS-A headers.
10. Agrega WS-Security Timestamp.
11. Firma XML con certificado.
12. Envia request con timeout.
13. Recibe SOAP response o SOAP fault.
14. Normaliza respuesta.
15. Calcula `requestHash`.
16. Devuelve `FiscalLookupResult`.
17. `SyncService` decide `CREATE`, `UPDATE` o `SKIP` contra `api/`.

## Mapping de respuesta

La guia indica que GetAcquirer permite completar estos campos de la factura electronica:

| Campo XML relacionado | Normalizado |
| --- | --- |
| `AccountingCustomerParty / PartyIdentification / ID @schemeName` | `documentTypeCode` |
| `TaxRepresentativeParty / PartyIdentification / ID` | `documentNumber` / `documentNumberNormalized` |
| `AccountingCustomerParty / Contact / Name` | `legalName` |
| `AccountingCustomerParty / Contact / ElectronicMail` | `fiscalEmail` |

Respuesta esperada normalizada:

| DIAN | Normalizado |
| --- | --- |
| Tipo de documento | `documentTypeCode` |
| Numero de documento | `documentNumber` y `documentNumberNormalized` |
| Nombre o razon social | `legalName` |
| Correo de recepcion de factura electronica | `fiscalEmail` |

Reglas:

- Si DIAN devuelve nombre pero no email, `lookupStatus=FOUND` y `fiscalEmail` queda vacio/null en extension futura. No debe fallar si el email no es obligatorio para crear customer.
- Si DIAN devuelve estructura sin nombre usable, devolver `lookupStatus=ERROR`, codigo `MAPPING_INCOMPLETE`.
- Si DIAN indica no encontrado, devolver `lookupStatus=NOT_FOUND`.
- Si DIAN devuelve email invalido, registrar en `responseSummary` como email invalido y no sincronizarlo automaticamente.

## Logs seguros y trazabilidad

El adapter debe producir un resumen operativo:

```json
{
  "provider": "DIAN_DIRECT",
  "lookupAt": "2026-05-31T00:00:00.000Z",
  "status": "FOUND",
  "statusCode": "DIAN_OK",
  "message": "GetAcquirer successful",
  "requestHash": "sha256:<hash>",
  "responseSummary": {
    "hasLegalName": true,
    "hasFiscalEmail": true,
    "documentTypeCode": "31",
    "documentNumberMasked": "900***456"
  }
}
```

Reglas:

- No loggear raw SOAP request.
- No loggear raw SOAP response.
- No loggear certificado.
- No loggear password.
- Enmascarar documentos en logs tecnicos.
- `requestHash` debe ser hash de payload canonico sin secretos.
- Si se requiere raw response futuro, guardarlo cifrado o en almacenamiento seguro con TTL y acceso auditado.

## Manejo de errores

| Caso | Codigo interno | `lookupStatus` | Retryable | Accion |
| --- | --- | --- | --- | --- |
| Adquiriente no encontrado | `NOT_FOUND` | `NOT_FOUND` | false | Permitir registro manual. |
| Timeout | `TIMEOUT` | `ERROR` | true | Retornar error claro y permitir reintento/manual. |
| Certificado invalido | `CERTIFICATE_INVALID` | `ERROR` | false | Bloquear DIAN_DIRECT hasta corregir secreto/certificado. |
| Password de certificado invalida | `CERTIFICATE_PASSWORD_INVALID` | `ERROR` | false | No exponer password. |
| WSDL no disponible | `WSDL_UNAVAILABLE` | `ERROR` | true | Reintentar despues, permitir manual. |
| SOAP fault | `SOAP_FAULT` | `ERROR` | depende del fault | Mapear fault seguro. |
| HTTP 401/403 | `AUTH_FAILED` | `ERROR` | false | Revisar certificado/autenticacion. |
| HTTP 5xx | `DIAN_UNAVAILABLE` | `ERROR` | true | Reintento con backoff futuro. |
| Mapping incompleto | `MAPPING_INCOMPLETE` | `ERROR` | false | Guardar summary seguro, no sincronizar campos incompletos. |
| `partyType=SUPPLIER` | `UNSUPPORTED_PARTY_TYPE` | `SKIPPED` | false | Usar provider fiscal de suppliers futuro. |

Errores nunca deben incluir:

- Password.
- Certificado.
- Llave privada.
- Raw SOAP.
- Token interno de `api/`.

## Timeouts y retries

Timeouts:

- `DIAN_TIMEOUT_MS` aplica al request completo.
- Default propuesto: `10000`.
- No bloquear POS ni venta por latencia DIAN.

Retries:

- FE-3.0 solo disena.
- Implementacion inicial puede no reintentar dentro del request sincrono.
- Fase futura puede usar modulo `retries` para reintentos asincronos.
- Reintentar solo errores retryable: timeout, WSDL temporal, HTTP 5xx.
- No reintentar certificado invalido ni mapping incompleto.

## Seguridad

Reglas obligatorias:

- No consumir DIAN real en CI.
- No usar certificados reales en pruebas automatizadas.
- No guardar raw response por defecto.
- No guardar raw request por defecto.
- No exponer secretos en errores.
- No escribir directo en `customers` ni `suppliers`; sync debe pasar por `api/`.
- No asumir GetAcquirer para suppliers.
- No permitir `DIAN_DIRECT` si faltan `DIAN_WSDL_URL`, `DIAN_CERT_PATH` o `DIAN_CERT_PASSWORD`.
- Auditar lookup y sync con resumen operativo.

## Pruebas propuestas

### Unitarias

- Construye request con `identificationType`.
- Construye request con `identificationNumber`.
- Normaliza documento antes de SOAP.
- Rechaza `partyType=SUPPLIER` para `DIAN_DIRECT`.
- Falla si falta `DIAN_WSDL_URL`.
- Falla si falta certificado/password.
- No expone password/certificado en error.
- Mapea respuesta FOUND a `FiscalLookupResult`.
- Mapea respuesta NOT_FOUND.
- Mapea SOAP fault a `SOAP_FAULT`.
- Mapea timeout a `TIMEOUT`.
- Mapea response incompleto a `MAPPING_INCOMPLETE`.
- Genera `requestHash` estable sin secretos.

### Integracion local con fixtures

- Fixture XML request esperado sin llave real.
- Fixture XML response FOUND.
- Fixture XML response NOT_FOUND.
- Fixture SOAP fault.
- Fixture con email ausente.
- Fixture con email invalido.
- Snapshot estructural de namespaces WS-A y WS-Security.
- Fixtures basados en la tabla de prueba de habilitacion de la guia, por ejemplo documentos `1199991`, `1299991`, `1399991`, `3199991`, `4199991`, `4299991`, `5099991` y equivalentes para `47`, `48`, `91` cuando se extraigan del PDF/tabla completa.

### CI

- No DIAN real en CI.
- No certificados reales en CI.
- Usar mock SOAP server local o fixtures.
- Tests de red solo contra servidor local controlado.

## Estructura futura sugerida

```text
backend-facturacion-electronica/src/modules/providers/dian/
  dian-direct-fiscal-provider.service.ts
  dian-get-acquirer.client.ts
  dian-get-acquirer.mapper.ts
  dian-ws-security-signer.ts
  dian-soap-error.mapper.ts
  dian-provider.config.ts
```

Responsabilidades:

- `DianDirectFiscalProvider`: implementa `FiscalProviderAdapter`.
- `DianGetAcquirerClient`: transporte SOAP.
- `DianGetAcquirerMapper`: request/response normalizado.
- `DianWsSecuritySigner`: firma WS-Security.
- `DianSoapErrorMapper`: errores seguros.
- `DianProviderConfig`: lectura/validacion de env.

## Criterios para pasar a implementacion

- Obtener `DIAN_WSDL_URL` desde el catalogo de participante DIAN del ambiente habilitacion.
- Usar `DIAN_GET_ACQUIRER_ACTION=http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer`.
- Confirmar version SOAP y headers HTTP requeridos.
- Confirmar algoritmos WS-Security exactos.
- Confirmar formato de certificado aceptado.
- Confirmar si el certificado de habilitacion requiere basic auth adicional o solo seleccion WS-Security en cliente SOAP.
- Aprobar libreria SOAP/XML signature.
- Tener fixtures XML sanitizados.
- Tener secret local de prueba no productivo, si se hara smoke manual fuera de CI.

## Riesgos vivos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Firma WS-Security mal construida | DIAN rechaza request. | Fixtures XML, libreria probada y validacion contra guia vigente. |
| WSDL cambia por ambiente | Falla runtime. | Env por ambiente, health diagnostico futuro y error `WSDL_UNAVAILABLE`. |
| Certificado vencido | Lookup caido. | Validacion de expiracion y alerta futura. |
| Raw SOAP en logs | Exposicion de datos personales. | Sanitizador y prohibicion por defecto. |
| Latencia DIAN bloquea venta | Mala UX POS. | No acoplar POS, timeout bajo y manual fallback. |
| Mapping incompleto | Datos fiscales incorrectos. | No sincronizar campos dudosos, devolver error seguro. |
| Usar GetAcquirer para suppliers | Fuente equivocada. | Limitar `DIAN_DIRECT` a CUSTOMER. |

## Decisiones abiertas

1. WSDL exacto por ambiente DIAN tomado del catalogo de participante.
2. SOAP 1.1 vs SOAP 1.2 segun binding vigente.
3. Algoritmos exactos de firma y digest.
4. Si WS-A headers tambien deben firmarse.
5. Si DIAN exige basic auth adicional en implementacion propia o si basta WS-Security/certificado segun binding.
6. Politica de cache para respuestas exitosas.
7. Politica de retencion de logs de lookup DIAN.
8. Libreria final para SOAP y XML signature.
9. Estrategia de secret manager para certificado y password.
10. Contrato final de `responseSummary`.

## Fuera de alcance FE-3.0

- Consumir DIAN real.
- Configurar certificado real.
- Crear endpoints nuevos.
- Modificar `api/`.
- Modificar `web/`.
- Modificar SQL/migraciones.
- Guardar raw response DIAN.
- Implementar XML UBL, CUFE o firma de factura.
- Implementar retries persistentes.
