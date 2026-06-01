# Matriz readiness DIAN real y certificados - FE-3.4

## Resumen ejecutivo

### Estado actual

El backend especializado `backend-facturacion-electronica` ya tiene una base segura para avanzar hacia GetAcquirer real, pero todavia no esta listo para consumir DIAN productivo.

Ya existe:

- Provider `MOCK_LOCAL` como default.
- Adapter `DIAN_DIRECT` apagado por defecto.
- Parser GetAcquirer con fixtures SOAP/XML.
- Request builder con `identificationType` e `identificationNumber`.
- WS-Security y WS-A conceptuales.
- Mock SOAP HTTP local para pruebas controladas.
- Bloqueo de llamadas externas por defecto con `DIAN_ALLOW_EXTERNAL_CALLS=false`.

### Que ya esta probado

- `DIAN_DIRECT` parsea success, not found, SOAP fault y XML invalido.
- `DIAN_DIRECT` construye request conceptual con body GetAcquirer.
- `DIAN_DIRECT` incluye headers WS-A y WS-Security conceptuales.
- `DIAN_DIRECT` consume mock SOAP local por HTTP.
- `DIAN_DIRECT` maneja timeout local.
- Endpoints externos se bloquean por defecto.
- `MOCK_LOCAL` sigue siendo default.
- No se han usado certificados reales.
- No se ha consumido DIAN real.

### Que falta antes de DIAN real

- Confirmar WSDL y endpoint de habilitacion desde catalogo de participante DIAN.
- Definir certificado de habilitacion seguro.
- Implementar firma WS-Security real o integrar libreria validada.
- Validar algoritmos de firma, digest y canonicalization contra guia/WSDL vigentes.
- Definir operacion segura de secretos.
- Aprobar una prueba controlada en HABILITACION.
- Mantener PRODUCCION bloqueado hasta autorizacion explicita.

## Variables requeridas

| Variable | Requerida para DIAN real | Regla readiness |
| --- | --- | --- |
| `DIAN_ENVIRONMENT` | Si | Solo `HABILITACION` o `PRODUCCION`. Default seguro: `HABILITACION`. |
| `DIAN_WSDL_URL` | Si | Debe venir del catalogo de participante DIAN. No hardcodear. |
| `DIAN_ENDPOINT_URL` | Si se separa del WSDL | Debe coincidir con endpoint aprobado. Para pruebas locales debe ser localhost. |
| `DIAN_CERT_PATH` | Si | Ruta segura fuera del repo. Validar existencia sin imprimir contenido. |
| `DIAN_CERT_PASSWORD` | Si | Secreto. Nunca imprimir ni persistir. |
| `DIAN_TIMEOUT_MS` | Si | Numerico positivo. Recomendado inicial: `15000`. |
| `DIAN_GET_ACQUIRER_ACTION` | Si | `http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer`. |
| `DIAN_ALLOW_EXTERNAL_CALLS` | Si hay llamada real | Default `false`. Solo `true` con autorizacion explicita. |

## Certificados

### Tipo esperado

- Certificado digital valido para consumo de servicios DIAN.
- Formato esperado por implementacion futura: `.p12` o `.pfx`, salvo que la libreria WS-Security final exija otro formato.
- Debe corresponder al ambiente correcto: habilitacion o produccion.

### Ubicacion segura

- Fuera del repositorio.
- Fuera de carpetas publicas.
- Permisos restringidos al usuario/proceso del servicio.
- En despliegue futuro, preferir secret manager, volumen seguro o mecanismo equivalente.

### Politica de no subir certificados al repo

- Nunca commitear `.p12`, `.pfx`, `.pem`, `.key`, `.crt` ni passwords.
- Agregar patrones a `.gitignore` en fase de hardening si no existen.
- Evidencia y docs no deben incluir rutas con datos sensibles ni nombres reales de certificados productivos.

### Politica de rotacion

- Registrar fecha de vencimiento.
- Alertar antes de vencimiento.
- Planear rotacion antes de despliegue productivo.
- Probar certificado nuevo en HABILITACION antes de PRODUCCION.
- Mantener rollback de configuracion de certificado si falla una rotacion.

### Proteccion de password

- `DIAN_CERT_PASSWORD` debe venir de secreto.
- No imprimir en logs.
- No retornar en errores.
- No incluir en evidencias.
- No persistir en base de datos ni archivos de texto.

### Validacion segura del archivo

Validar:

- variable `DIAN_CERT_PATH` existe.
- archivo existe.
- el proceso puede leerlo.
- extension/formato es esperado.
- tamanio es mayor a cero.

No imprimir:

- contenido del certificado.
- password.
- alias sensible.
- ruta completa si revela tenant/persona/empresa.

## Seguridad

Reglas obligatorias:

- No loggear `DIAN_CERT_PASSWORD`.
- No loggear certificado ni llave privada.
- No guardar raw SOAP request/response completo por defecto.
- Guardar `requestHash` calculado desde payload canonico sin secretos.
- Guardar `responseSummary` operativo y seguro.
- Sanitizar errores antes de responder o registrar.
- No incluir headers de autenticacion en logs.
- Enmascarar documento cuando se registre trazabilidad tecnica.
- Mantener `DIAN_ALLOW_EXTERNAL_CALLS=false` en CI y desarrollo normal.

Resumen operativo permitido:

```json
{
  "provider": "DIAN_DIRECT",
  "status": "FOUND",
  "statusCode": "DIAN_OK",
  "message": "GetAcquirer successful",
  "requestHash": "sha256:<hash>",
  "responseSummary": {
    "hasLegalName": true,
    "hasFiscalEmail": true,
    "documentTypeCode": "31",
    "documentNumberMasked": "319***991"
  }
}
```

## Ambientes

### HABILITACION

- Primer ambiente permitido para prueba real controlada.
- Requiere WSDL/endpoint de catalogo participante de habilitacion.
- Requiere certificado de habilitacion o credencial aprobada.
- `DIAN_ALLOW_EXTERNAL_CALLS=true` solo durante ventana de prueba autorizada.
- Guardar solo resumen de resultado.

### PRODUCCION

- Bloqueado por defecto.
- No habilitar hasta completar prueba de HABILITACION y aprobacion funcional/seguridad.
- Requiere autorizacion explicita por escrito.
- Requiere plan de monitoreo, rollback operativo y manejo de incidentes.
- Requiere confirmacion de que no se usaran datos de prueba.

### Reglas de bloqueo PRODUCCION

No permitir `DIAN_ENVIRONMENT=PRODUCCION` si:

- no hay aprobacion explicita.
- `DIAN_ALLOW_EXTERNAL_CALLS` no esta aprobado para la ventana.
- no hay certificado productivo validado.
- no hay WSDL/endpoint productivo confirmado.
- no hay politica de logs y privacidad aprobada.
- no hay responsable operativo asignado.

## Criterios para permitir llamada externa

Checklist minimo:

- Mock SOAP local aprobado.
- `npm test` pasa.
- `npm run build` pasa.
- `openspec validate` pasa.
- Certificado disponible en ruta segura.
- Password disponible por secreto.
- WSDL confirmado desde catalogo participante DIAN.
- Endpoint confirmado.
- `DIAN_ALLOW_EXTERNAL_CALLS=true` autorizado solo para ventana controlada.
- `DIAN_ENVIRONMENT=HABILITACION`.
- Logging seguro definido.
- No raw SOAP por defecto.
- `requestHash` y `responseSummary` definidos.
- Evidencia de configuracion segura sin secretos.
- Responsable tecnico presente durante prueba.

## Plan de prueba DIAN real controlada

1. Ejecutar solo en `HABILITACION`.
2. Configurar `DIAN_ENVIRONMENT=HABILITACION`.
3. Configurar WSDL/endpoint desde catalogo participante DIAN.
4. Configurar certificado de habilitacion en ruta segura.
5. Activar `DIAN_ALLOW_EXTERNAL_CALLS=true` solo durante la prueba.
6. Ejecutar una consulta GetAcquirer con datos de prueba aprobados.
7. Guardar solo resumen operativo.
8. Verificar `lookupStatus`, `statusCode`, `message`, `requestHash` y `responseSummary`.
9. Validar que no se dupliquen `customers`.
10. No sincronizar automaticamente si hay duda de mapping.
11. Desactivar `DIAN_ALLOW_EXTERNAL_CALLS` al terminar.
12. Documentar resultado sin secretos.

### Rollback operativo si falla

- Volver `DIAN_ALLOW_EXTERNAL_CALLS=false`.
- Volver `FISCAL_PROVIDER=MOCK_LOCAL`.
- No borrar customers existentes.
- No aplicar cambios fiscales si la consulta fallo.
- Revisar logs sanitizados.
- Registrar incidente y decision.

### No produccion

La primera prueba real debe excluir PRODUCCION. Produccion solo puede evaluarse despues de habilitacion aprobada y autorizacion explicita.

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Certificado invalido | DIAN rechaza request. | Validar existencia, formato, expiracion y ambiente antes de prueba. |
| Password incorrecta | Falla firma/autenticacion. | Usar secret manager y validar sin imprimir. |
| WSDL no disponible | No hay consumo. | Confirmar endpoint antes de ventana; tener rollback a mock. |
| SOAP fault | Consulta falla. | Mapear fault seguro y no sincronizar automaticamente. |
| Timeout | Mala experiencia y estado incierto. | Timeout definido, retry futuro y fallback manual. |
| Cambios DIAN | Parser o firma fallan. | Versionar fixtures y validar contra guia/WSDL vigente. |
| Datos personales | Riesgo privacidad. | Enmascarar, no raw SOAP, responseSummary minimo. |
| Disponibilidad DIAN | Intermitencia operativa. | No bloquear POS, permitir manual y reintento controlado. |
| Produccion habilitada por error | Riesgo legal/operativo. | Bloqueo por default y autorizacion explicita. |

## Checklist previa a FE-3.5

- [ ] WSDL de HABILITACION confirmado desde catalogo participante DIAN.
- [ ] Endpoint de HABILITACION confirmado.
- [ ] Certificado de HABILITACION disponible fuera del repo.
- [ ] Password disponible solo por secreto.
- [ ] Validacion de existencia de certificado implementada sin imprimir ruta sensible.
- [ ] Firma WS-Security real o libreria seleccionada.
- [ ] Algoritmos de firma/digest/canonicalization confirmados.
- [ ] `DIAN_ALLOW_EXTERNAL_CALLS=false` confirmado en `.env.example`.
- [ ] Procedimiento para activar `DIAN_ALLOW_EXTERNAL_CALLS=true` aprobado.
- [ ] Plan de prueba con datos de habilitacion aprobado.
- [ ] Politica de no raw SOAP aprobada.
- [ ] `requestHash` y `responseSummary` verificados.
- [ ] Tests de mock SOAP local pasan.
- [ ] Build pasa.
- [ ] OpenSpec validate pasa.
- [ ] Responsable tecnico y ventana de prueba definidos.
- [ ] Plan de rollback operativo definido.

## Confirmacion de alcance FE-3.4

- No se implemento firma real.
- No se consumio DIAN real.
- No se configuraron certificados reales.
- No se modifico codigo funcional.
- No se modifico `api/`.
- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se toco PRD.
- No se hizo commit.
