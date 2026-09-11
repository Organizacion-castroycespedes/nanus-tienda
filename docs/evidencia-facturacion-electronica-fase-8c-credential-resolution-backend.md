# Fase 8C - Credential Storage + Secret Resolution in Billing Backend

Fecha: 2026-08-28

## Discovery

- No se encontro infraestructura real de `AWS Secrets Manager`, `SSM`, `Vault` o `KMS` para este flujo.
- El repo ya usa `process.env` para config runtime.
- La ruta inicial segura es resolucion por entorno.

## Selected backend

```text
environment-based secret resolution
```

## Credential reference

- Formato soportado: `env:<ENV_VAR_NAME>`
- La DB guarda solo `credential_reference`
- El valor secreto vive en la variable de entorno nombrada por la referencia

## Resolution flow

```text
tenant_electronic_billing_configs.credential_reference
  -> env:<NAME>
  -> process.env[NAME]
  -> JSON payload
  -> provider-neutral resolved credential
  -> FactuCore validation
  -> request headers
```

## FactuCore validation

- `FactuCoreProvider` valida que el payload tenga `clientKey` y `clientSecret`
- `FactuCoreClient` no lee `process.env`
- No hay estado mutable compartido para credenciales

## Tenant isolation

- Resolver por referencia
- Cada operacion obtiene su propio material
- Prueba interleaved tenant pass

## Rotation

- La referencia no cambia
- Se rota el valor de la variable de entorno
- No hace falta cambiar documentos historicos

## Logging

- Permitido: `tenantId`, `providerCode`, `providerConfigId`, `credentialReference`
- Prohibido: `clientKey`, `clientSecret`, headers secretos, payload secreto completo

## Errors

- Missing reference: controlled config error
- Missing env var: controlled not-found error
- Invalid JSON payload: controlled invalid error

## Tests

- Resolver env tests
- Provider missing secret test
- Provider interleaved tenant test

## Operational limit

- Env strategy is okay for first rollout
- Not ideal for long-term high-tenant secret rotation
- Backend contract stays neutral for future secret manager swap
