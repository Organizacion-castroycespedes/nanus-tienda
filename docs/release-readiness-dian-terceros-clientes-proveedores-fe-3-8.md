# Release readiness FE-3.8 - DIAN terceros clientes/proveedores

Fecha: 2026-06-03

## Resumen ejecutivo

FE-3 queda listo para QA mock de terceros fiscales en customers, suppliers y POS. El flujo mock permite buscar, previsualizar, aplicar campos seleccionados, guardar estado de consulta y usar `customerId` en POS sin bloquear Consumidor Final.

DIAN real no queda listo para habilitacion ni produccion. GetAcquirer tiene seleccion tecnica, dependencias, request builder, firma XML local con certificado TEST ONLY, BinarySecurityToken y transporte HTTP controlado por env. Falta certificado P12/PFX real, loader real de certificado, parser de respuesta DIAN real, pruebas de habilitacion y aprobacion operativa.

Decision de arquitectura: suppliers no usan GetAcquirer real. Suppliers se mantienen provider-agnostic/mock hasta definir fuente fiscal aprobada.

## Estado por fase

| Fase | Estado | Resultado |
| --- | --- | --- |
| FE-3.1 | Completada | Diseno y OpenSpec base para terceros fiscales, POS, customers, suppliers y GetAcquirer futuro. |
| FE-3.2 | Completada | Campos fiscales backend para `customers` y `suppliers`, migracion V052 y rollback conservador. |
| FE-3.3 | Completada | Lookup mock provider-agnostic para customers/suppliers con preview, diffs y apply seguro. |
| FE-3.4 | Completada | POS quick fiscal customer form, servicios frontend y seleccion de `customerId`. |
| FE-3.4-QA | Parcial documentada | Web/API locales respondieron; smoke visual interactivo quedo limitado por browser automation local. |
| FE-3.5 | Completada | Skeleton GetAcquirer real con modo `disabled/mock/real`, config y errores claros. |
| FE-3.6 | Parcial inicial | Detecto bloqueo DB sin columnas FE-3.2. |
| FE-3.6.1 | Completada con hallazgo | V052 local aplicada; E2E mock valido sin `taxResponsibilities`; detecto bug JSONB. |
| FE-3.6.2 | Completada | Fix `taxResponsibilities` JSONB para customers y suppliers. |
| FE-3.6.3 | Completada | QA final mock customers POS con `taxResponsibilities`, customer validado y `customerId` en POS. |
| FE-3.7.1 | Completada | Estrategia tecnica SOAP/XML Signature seleccionada. |
| FE-3.7.2 | Completada | Dependencias agregadas y spike local sin DIAN real. |
| FE-3.7.3 | Completada | Request builder SOAP GetAcquirer con WS-A, Timestamp e IDs estables. |
| FE-3.7.4 | Completada | Firma XML local Body/Timestamp con certificado TEST ONLY. |
| FE-3.7.5 | Completada | BinarySecurityToken y SecurityTokenReference con fixture. |
| FE-3.7.6 | Completada | Builder + signer integrados en adapter sin llamada externa. |
| FE-3.7.7 | Completada | Transporte HTTP con `fetch` controlado, desactivado por defecto y testeado con mock. |

## Listo para QA mock

- Customers fiscales backend.
- Suppliers fiscales backend.
- POS quick fiscal customer.
- Lookup mock `MOCK_LOCAL`.
- Preview seguro sin raw SOAP.
- Diffs por campo.
- Apply solo de campos seleccionados.
- Estado de lookup guardado en campos fiscales/metadatos seguros.
- `taxResponsibilities` como JSONB array valido.
- Consumidor Final como fallback.
- Venta POS usando `customerId` seleccionado validada por evidencia local.

## No listo para DIAN real/habilitacion

- No hay certificado real.
- No hay P12/PFX real.
- No hay loader productivo P12/PFX.
- No hay password real ni flujo seguro de secretos aprobado.
- No hay llamada DIAN habilitacion ejecutada.
- No hay parser real de respuesta DIAN a datos fiscales.
- No hay validacion con WSDL/endpoint oficial DIAN.
- No hay observabilidad productiva de retries, rate limit ni errores DIAN.
- No hay aprobacion para `DIAN_GET_ACQUIRER_HTTP_ENABLED=true` en ambiente real.

## Endpoints disponibles

Document types:

```http
GET /api/electronic-invoicing/document-types
```

Customers/adquirientes:

```http
GET /api/electronic-invoicing/customers
POST /api/electronic-invoicing/customers
POST /api/electronic-invoicing/customers/lookup
PATCH /api/electronic-invoicing/customers/:id
POST /api/electronic-invoicing/customers/:id/apply-lookup
GET /api/electronic-invoicing/customers/default
POST /api/electronic-invoicing/customers/default/ensure
GET /api/electronic-invoicing/customers/:id
```

Suppliers/proveedores:

```http
GET /api/electronic-invoicing/suppliers
POST /api/electronic-invoicing/suppliers
POST /api/electronic-invoicing/suppliers/lookup
PATCH /api/electronic-invoicing/suppliers/:id
POST /api/electronic-invoicing/suppliers/:id/apply-lookup
GET /api/electronic-invoicing/suppliers/:id
```

POS usa servicios frontend para customers fiscales:

- `web/modules/electronic-invoicing/services/customer.service.ts`
- `web/modules/pos/components/QuickFiscalCustomerModal.tsx`

## Variables de entorno

Lookup general:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=false
DIAN_THIRD_PARTY_LOOKUP_MODE=disabled
```

GetAcquirer real controlado:

```env
DIAN_GET_ACQUIRER_WSDL_URL=
DIAN_GET_ACQUIRER_ENDPOINT_URL=
DIAN_CERTIFICATE_PATH=
DIAN_CERTIFICATE_PASSWORD=
DIAN_GET_ACQUIRER_TIMEOUT_MS=15000
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

Valores de `DIAN_THIRD_PARTY_LOOKUP_MODE`:

- `disabled`: no consulta provider.
- `mock`: usa mock local.
- `real`: prepara flujo GetAcquirer solo para customers.

## Configuracion mock

Configuracion recomendada para QA mock:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

Notas:

- No requiere certificado.
- No requiere WSDL.
- No requiere endpoint DIAN.
- No hace llamadas externas.
- Suppliers pueden usar mock provider-agnostic.
- Customers pueden usar mock desde POS, customer endpoints y apply.

## Configuracion real controlada

Configuracion tecnica para preparar GetAcquirer real sin activar red:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=real
DIAN_GET_ACQUIRER_WSDL_URL=https://example.test/GetAcquirer?wsdl
DIAN_GET_ACQUIRER_ENDPOINT_URL=https://example.test/GetAcquirer
DIAN_CERTIFICATE_PATH=C:\certs\dian.p12
DIAN_CERTIFICATE_PASSWORD=<secret>
DIAN_GET_ACQUIRER_TIMEOUT_MS=15000
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

Para cualquier ambiente DIAN real futuro:

- `DIAN_GET_ACQUIRER_HTTP_ENABLED=true` solo con aprobacion explicita.
- Usar solo habilitacion primero.
- No usar suppliers.
- No imprimir certificado, password, XML firmado completo ni raw SOAP.
- Validar vulnerabilidades npm antes de exponer el servicio.

## Que esta probado

Backend:

- Build API.
- Tests de customers fiscales.
- Tests de suppliers fiscales.
- Tests de lookup mock.
- Tests de permisos POS para endpoints fiscales.
- Tests de `taxResponsibilities` JSONB.
- Tests de dependencias SOAP/XML.
- Tests de request builder GetAcquirer.
- Tests de signer XML local.
- Tests de BinarySecurityToken.
- Tests de adapter GetAcquirer sin red externa.
- Tests de transporte HTTP con `fetch` mock.

Frontend:

- Lint web en FE-3.4.
- Build web en fases QA mock.
- POS quick fiscal customer implementado.

QA local:

- API mock customer lookup `FOUND`.
- `apply-lookup` con campos seleccionados.
- Customer validado con `isDianValidated=true` o estado equivalente.
- `taxResponsibilities` guardado como JSONB array valido.
- POS puede usar `customerId`.
- Consumidor Final sigue fallback.
- Cleanup de fixtures QA documentado.

## Que no esta probado

- DIAN real.
- Habilitacion DIAN.
- Produccion DIAN.
- Certificado real.
- P12/PFX real.
- Password real.
- Loader productivo de P12/PFX.
- Firma aceptada por endpoint DIAN real.
- Parser real de respuesta DIAN.
- WSDL oficial con validacion end-to-end.
- Reintentos/rate limit contra DIAN.
- Rotacion de certificados.
- Smoke visual interactivo POS completo por browser automation local en fases parciales.
- `npm audit fix` o remediacion de vulnerabilidades.

## Riesgos de seguridad

| Riesgo | Impacto | Mitigacion actual |
| --- | --- | --- |
| `DIAN_GET_ACQUIRER_HTTP_ENABLED=true` por error | Llamada externa no aprobada | Default `false`, tests con fetch mock, documentar gate manual. |
| Password/certificado en logs | Exposicion de secretos | No se loguea password, certificado ni XML firmado completo. |
| Raw SOAP en respuesta/API | Exposicion de datos sensibles | Preview y metadata guardan resumen seguro, hash y campos normalizados. |
| XML parser vulnerable o XXE | Exposicion/DoS | Pendiente SCA y fixtures negativos antes de DIAN real. |
| Dependencias con vulnerabilidades | Riesgo supply chain | Reporte npm documentado, requiere revision antes de habilitacion. |
| GetAcquirer en suppliers | Fuente incorrecta | Suppliers devuelven `UNSUPPORTED_PARTY_TYPE` en real. |
| Sobrescritura de datos manuales | Perdida de dato operativo | Apply por campos seleccionados. |
| Certificado TEST ONLY confundido con real | Falsa confianza | Fixtures marcados TEST ONLY y generados en tests. |

## Dependencias agregadas

Agregadas en `api/package.json` durante FE-3.7.2:

```json
{
  "@xmldom/xmldom": "^0.9.10",
  "fast-xml-parser": "^5.8.0",
  "node-forge": "^1.4.0",
  "xml-crypto": "^6.1.2"
}
```

Uso:

- `xml-crypto`: firma XML local.
- `@xmldom/xmldom`: DOM XML para firma y parseo estructural.
- `node-forge`: certificados fixture TEST ONLY y base futura para P12/PFX.
- `fast-xml-parser`: parser de respuesta SOAP fixture.
- `fetch` nativo Node 18: transporte HTTP controlado.

## Vulnerabilidades npm reportadas

En FE-3.7.2, `npm.cmd install xml-crypto @xmldom/xmldom node-forge fast-xml-parser` reporto:

```text
10 vulnerabilities (7 moderate, 3 high)
```

No se ejecuto `npm audit fix` porque puede cambiar dependencias fuera del alcance. En FE-3.8 no se ejecuto `npm audit` nuevo por regla de no remoto. Antes de habilitacion DIAN se debe correr SCA/npm audit en ambiente permitido y aprobar remediacion.

## Checklist predeploy QA mock

- [ ] Confirmar branch `feat/dian-terceros-clientes-proveedores-fe-3`.
- [ ] Aplicar V052 en DB QA si no existe.
- [ ] Confirmar columnas fiscales FE-3.2 en `customers` y `suppliers`.
- [ ] Configurar `DIAN_THIRD_PARTY_LOOKUP_ENABLED=true`.
- [ ] Configurar `DIAN_THIRD_PARTY_LOOKUP_MODE=mock`.
- [ ] Configurar `DIAN_GET_ACQUIRER_HTTP_ENABLED=false`.
- [ ] Ejecutar `cd api && npm.cmd run build`.
- [ ] Ejecutar `cd web && npm.cmd run build`.
- [ ] Ejecutar tests backend fiscales relevantes.
- [ ] Confirmar `POST /api/electronic-invoicing/customers/lookup` responde `FOUND` con mock.
- [ ] Confirmar `POST /api/electronic-invoicing/customers/:id/apply-lookup` aplica solo campos seleccionados.
- [ ] Confirmar `taxResponsibilities` queda como JSON array.
- [ ] Confirmar POS selecciona `customerId`.
- [ ] Confirmar Consumidor Final disponible.
- [ ] Cleanup de fixtures QA.

## Checklist para habilitacion DIAN futura

- [ ] Aprobar proveedor/fuente para DIAN real.
- [ ] Aprobar WSDL y endpoint de habilitacion.
- [ ] Aprobar certificado P12/PFX real de habilitacion.
- [ ] Implementar loader P12/PFX real sin guardar secretos.
- [ ] Implementar manejo seguro de `DIAN_CERTIFICATE_PASSWORD`.
- [ ] Validar firma XML contra reglas DIAN reales.
- [ ] Implementar parser de respuesta DIAN real.
- [ ] Agregar fixtures de respuesta DIAN anonimizados.
- [ ] Ejecutar SCA/npm audit y remediar vulnerabilidades relevantes.
- [ ] Definir rate limit, timeout, retry y circuit breaker.
- [ ] Definir retencion de logs y hash de request/response.
- [ ] Ejecutar prueba de habilitacion con datos aprobados.
- [ ] Mantener `DIAN_GET_ACQUIRER_HTTP_ENABLED=false` hasta ventana controlada.
- [ ] Confirmar rollback a `mock` o `disabled`.

## Decisiones y pendientes

Decision cerrada:

- Suppliers no usan GetAcquirer real.

Pendientes:

- Certificado P12/PFX real.
- Loader P12/PFX real.
- Password real en secret manager o mecanismo aprobado.
- Parser de respuesta DIAN real.
- Prueba habilitacion DIAN.
- Catalogos DIAN finales.
- Politica de DV.
- Fuente fiscal final para suppliers.
- Remediacion npm/SCA.

## Rollback/reversion general

Rollback por configuracion:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=false
DIAN_THIRD_PARTY_LOOKUP_MODE=disabled
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

Degradacion a mock:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

Reversion de despliegue:

- Volver al build anterior de API/web si POS o endpoints fiscales fallan.
- Mantener `DIAN_GET_ACQUIRER_HTTP_ENABLED=false` durante rollback.
- No ejecutar rollback SQL de V052 si ya hay datos fiscales utiles sin backup.
- Si se necesita rollback DB controlado, existe `scripts/database/rollbacks/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2_rollback.sql`; usar solo con backup y aprobacion, porque elimina campos fiscales FE-3.2.

## Criterios para pasar a FE-4 o facturacion electronica real

Puede pasar a FE-4 mock/UX si:

- QA mock acepta customers/suppliers/POS.
- No hay bugs bloqueantes con `taxResponsibilities`.
- Consumidor Final sigue funcionando.
- `DIAN_GET_ACQUIRER_HTTP_ENABLED=false`.
- No hay raw SOAP ni secretos en respuestas.

No debe pasar a facturacion electronica real hasta que:

- SCA/npm audit este revisado y aprobado.
- P12/PFX real este implementado y protegido.
- Parser respuesta DIAN real este implementado.
- Habilitacion DIAN pase con datos aprobados.
- Seguridad apruebe logs, secretos, timeout, retry y rollback.
- Negocio apruebe criterios de emision electronica nominada.

## Validaciones FE-3.8

- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS. Git mostro warning CRLF en `tasks.md`, sin errores de whitespace.

## Fuera de alcance confirmado

- No codigo funcional.
- No SQL.
- No PRD.
- No remoto.
- No commit.
