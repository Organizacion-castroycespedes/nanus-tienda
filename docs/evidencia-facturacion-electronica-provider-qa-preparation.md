# Evidencia provider QA preparation - facturacion electronica

Fecha: 2026-08-28

## Resultado

Provider QA preparation quedo bloqueada de forma segura.

No se habilito el worker. No se llamo FactuCore. No se creo documento, XML, firma ni transmision.

## Guard QA

- Environment: `qa`
- Database: `manus_tienda_qa`
- Schema: `public`
- Tenant: `00000000-0000-0000-0000-000000000001`
- `current_database()`: `manus_tienda_qa`
- `current_schema()`: `public`
- PROD: no tocado

## Tenant billing config

- Provider code: `FACTUCORE`
- Provider active: yes
- Tenant config enabled: yes
- Environment: `TEST`
- `credential_reference`: `env:FACTUCORE_TENANT_QA`
- Secret value in DB: no
- Provider `base_url`: empty

La referencia tiene formato valido, pero el secreto referenciado no esta configurado en el runtime QA inspeccionado.

## Secret resolution

Se inspeccionaron las fuentes runtime process, user, machine y `backend-facturacion-electronica/.env` sin imprimir valores.

- Real secret configured: no
- Secret source: runtime environment
- Environment variable `FACTUCORE_TENANT_QA`: no presente
- Credential resolution: blocked
- FactuCore credential shape: not executed
- Client key present: no confirmado
- Client secret present: no confirmado
- Secret value in repo: no
- Secret value in logs: no

No se escribieron secretos en archivos, DB, logs, evidencia ni Git.

## Runtime safety

- Billing Backend health: `200 OK`
- Billing Backend worker: disabled
- API outbox dispatcher: disabled
- Eager FactuCore HTTP on startup: `0`
- Credential resolution during startup: `0`
- Real FactuCore HTTP: `0`
- No invoice created
- No credit note created
- No XML generated
- No document signed
- No document transmitted

El backend inicio correctamente y reporto `Electronic billing background sync disabled`. El proceso local fue detenido despues de la comprobacion.

## Safe connectivity smoke

No existe endpoint FactuCore no mutante confirmado en el runtime/artifact packet para probar autenticacion sin ejecutar una operacion documental. El `base_url` QA tambien esta vacio.

- Safe authenticated FactuCore smoke available: no
- Connectivity: not executed
- Authentication: not executed
- Reason: missing runtime credential and missing provider base URL

No se adivino endpoint. No se uso `create invoice`, `create credit note`, `generate-xml`, `sign`, `transmit`, `retry` ni `cancel` como prueba de conectividad.

## Pending documents

QA tiene dos candidatos `PENDING`, ambos del tenant seleccionado:

- `7fa040a9-0703-434d-954c-5f348f2d6544`, source sale `966060ae-3cd8-4a85-a4f0-33912cfbd295`
- `da862163-c4f3-44c8-92cf-066afc9abcbb`, source sale `2bcbf62c-3b93-43ad-a047-45800cc93bf1`

Ambos tienen `provider_document_id = NULL` y `provider_status = NULL`. No se proceso ninguno. El worker global no debe habilitarse hasta escoger una sola ejecucion controlada.

## Next gate

Antes de Provider QA:

1. Configurar `FACTUCORE_TENANT_QA` mediante el mecanismo seguro de QA.
2. Configurar `base_url` hacia FactuCore QA/Sandbox aprobado.
3. Ejecutar resolver smoke sin imprimir secretos.
4. Confirmar endpoint autenticado no mutante, si existe.
5. Procesar exactamente un documento candidato por ruta controlada.

Credential storage remains unresolved in this runtime. Provider QA is not ready.
