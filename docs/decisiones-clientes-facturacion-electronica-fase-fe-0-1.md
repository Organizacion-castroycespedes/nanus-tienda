# Decisiones clientes facturacion electronica - Fase FE-0.1

## Alcance

Este documento cierra decisiones funcionales para preparar clientes/adquirientes de facturacion electronica Colombia.

No define migraciones. No define endpoints finales. No modifica codigo funcional. Sirve como entrada para FE-1 modelo de datos.

## Decisiones cerradas

### 1. Integracion DIAN/proveedor

Decision: el diseno sera provider-agnostic.

No se amarra todavia a DIAN directo ni a proveedor tecnologico. La arquitectura debe preparar una capa futura `ElectronicInvoicingProviderAdapter`.

Modos previstos:

- `MOCK_LOCAL`: preview local y pruebas sin consumo externo.
- `DIAN_DIRECT`: consumo directo DIAN si se aprueba despues.
- `PROVIDER`: proveedor tecnologico si se aprueba despues.

La primera implementacion puede iniciar en `MOCK_LOCAL` / preview.

### 2. Consumidor final

Decision: debe existir un consumidor final por tenant.

Reglas:

- No duplicar consumidor final por sucursal.
- La sucursal viene del contexto de venta, pedido o POS, no del cliente.
- Debe existir endpoint para asegurar consumidor final default.
- POS puede vender con consumidor final sin email fiscal.
- Consumidor final es fallback cuando no hay cliente identificado.

### 3. Email fiscal

Decision: `fiscalEmail` no sera obligatorio al crear cliente.

Debe validarse si viene informado. Sera obligatorio solo cuando el flujo de emision electronica nominada lo necesite.

### 4. Permisos y menu

Decision: menu key principal:

```text
ELECTRONIC_INVOICING_CUSTOMERS
```

Keys futuras reservadas:

```text
ELECTRONIC_INVOICING_DOCUMENTS
ELECTRONIC_INVOICING_SETTINGS
ELECTRONIC_INVOICING_REPORTS
```

### 5. Respuestas DIAN/proveedor y privacidad

Decision: no guardar raw response DIAN/proveedor completo en la primera version.

Guardar solo resumen operativo:

- `status`
- `statusCode`
- `message`
- `provider`
- `lookupAt`
- `requestHash`
- `responseSummary`

Si una fase futura requiere raw response, debe guardarse cifrado o en almacenamiento seguro.

### 6. Catalogos

Decision: `dian_document_types` debe ser catalogo versionable.

Reglas:

- No hardcodear tipos de documento DIAN en codigo.
- Sembrar catalogo solo despues de confirmar fuente vigente.
- Guardar metadatos de fuente/version.

### 7. Compatibilidad

Decision: `/api/customers` actual no debe romperse.

Reglas:

- Campos fiscales nuevos opcionales inicialmente.
- Ventas, pedidos, POS y reportes siguen usando `customers.id`, `name`, `document_number` e `is_active`.
- Evolucion aditiva de `customers`, no tabla paralela de clientes.
- Consumidor final queda como fallback tenant-aware cuando no haya cliente identificado.

## Justificacion

El cliente operativo actual ya es contrato vivo para POS, pedidos, ventas y reportes. Cambiar identidad o crear cliente paralelo puede partir datos, duplicar adquirientes y romper trazabilidad de ventas.

El diseno provider-agnostic reduce acoplamiento temprano. DIAN directo y proveedores tecnologicos pueden tener contratos, credenciales, tiempos y respuestas distintas. `MOCK_LOCAL` permite avanzar modelo y reglas sin bloquearse por integracion externa.

El consumidor final por tenant conserva la regla actual de `customers.is_default` y evita duplicados por sucursal. La sucursal pertenece al hecho de venta, no a la identidad fiscal del adquiriente.

`fiscalEmail` opcional permite mantener ventas POS y registro operativo. La obligatoriedad se mueve al momento correcto: emision electronica nominada.

No guardar raw response reduce riesgo de datos personales y secretos. El resumen operativo basta para trazabilidad inicial.

## Impacto tecnico

- `customers` sigue siendo identidad canonica.
- FE-1 debe disenar migracion aditiva sobre `customers`.
- FE-1 debe disenar `dian_document_types` versionable.
- FE-1 debe disenar `dian_acquirer_lookup_logs` con resumen operativo.
- Los permisos futuros deben usar `ELECTRONIC_INVOICING_CUSTOMERS`.
- El adapter futuro debe normalizar `MOCK_LOCAL`, `DIAN_DIRECT` y `PROVIDER`.
- Los DTOs deben permitir `fiscalEmail` nulo al crear cliente.
- El ensure de consumidor final debe trabajar por tenant, no por sucursal.

## Riesgos

- El formato fiscal exacto del consumidor final puede cambiar segun DIAN o proveedor.
- El catalogo DIAN puede cambiar; sembrarlo sin fuente vigente crea deuda.
- Un adapter generico puede ocultar diferencias de proveedor; mitigar con contrato minimo y campos `provider`, `statusCode`, `message`.
- Backfill de clientes existentes con `document_number` incompleto puede crear duplicados o datos ambiguos.
- Si no hay validation pipe global, DTOs NestJS pueden no validar como se espera.
- Raw response futuro exige diseno de cifrado, acceso y retencion antes de implementarse.

## Preguntas abiertas

1. Cual es la fuente oficial y version exacta para sembrar `dian_document_types`?
2. Cuales son los valores fiscales exactos del consumidor final para FE-1?
3. La unicidad fiscal FE-1 queda por tenant o se anticipa `company_id` futuro?
4. Se usara validation pipe global o validacion manual local?
5. Cual sera la politica de retencion para `dian_acquirer_lookup_logs`?
6. Como se hara backfill de clientes existentes con `document_number` sin `documentTypeCode`?
7. Para tipos no NIT, el backend debe rechazar `verificationDigit` o limpiarlo silenciosamente?
8. Que criterio habilita pasar de `MOCK_LOCAL` a DIAN directo o proveedor tecnologico?

## Criterios para pasar a FE-1 modelo de datos

Antes de disenar migraciones:

1. OpenSpec valida en modo strict.
2. `git diff --check` no reporta problemas.
3. No existen cambios funcionales en `api/`, `web/`, `backend-reporteria` ni SQL.
4. La fuente vigente de tipos de documento esta identificada.
5. Los valores fiscales del consumidor final estan definidos.
6. La decision tenant vs `company_id` para unicidad FE-1 esta cerrada.
7. La estrategia de backfill de clientes existentes esta definida.
8. La politica de retencion de logs de lookup esta definida.
9. La estrategia de validacion NestJS esta definida.
10. El alcance de `MOCK_LOCAL` para primera implementacion esta aceptado.
