# Evidencia activacion sale v2 tenant/sucursal - Fase 3.16

Fecha: 2026-05-28

Resultado final: APROBADO.

## Objetivo

Preparar activacion controlada de `inventory_create_sale_v2` por tenant/sucursal piloto, manteniendo `inventory_create_sale` como default absoluto.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/repositories/sale.repository.ts` | Resuelve v1/v2 con env + config tenant/sucursal. |
| `api/src/modules/inventory/repositories/sale.repository.spec.ts` | Amplia tests de seleccion v1/v2. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Agrega y marca Fase 3.16. |

## Regla de activacion

La seleccion queda asi:

1. Si `process.env.INVENTORY_SALE_V2_ENABLED !== "true"`, usar `inventory_create_sale`.
2. Si `process.env.INVENTORY_SALE_V2_ENABLED === "true"`, consultar `tenants.config`.
3. Usar `inventory_create_sale_v2` solo si `config.inventory.saleV2Enabled === true`.
4. Si `config.inventory.saleV2Branches` existe, usar v2 solo cuando `branchId` este incluida.
5. Si `saleV2Branches` no existe, todo el tenant queda habilitado.
6. Ante cualquier duda, config ausente, config invalida o error de consulta, usar `inventory_create_sale`.

## Config esperada

```json
{
  "inventory": {
    "saleV2Enabled": true,
    "saleV2Branches": ["branch-uuid-1"]
  }
}
```

SUPUESTO: `tenants.config` ya existe y es el patron de configuracion tenant disponible. No se crea tabla nueva.

## Seguridad

- El nombre SQL sigue restringido a union interna cerrada:
  - `inventory_create_sale`
  - `inventory_create_sale_v2`
- No hay interpolacion con valores externos.
- El payload enviado a la funcion no cambia.
- La respuesta esperada no cambia.
- El contrato API no cambia.
- El log solo indica la funcion usada o fallback seguro.

## Tests ejecutados

```text
cmd /c npx tsx --test src/modules/inventory/repositories/sale.repository.spec.ts
cmd /c npx tsx --test src/modules/inventory/services/sale.service.spec.ts
npm run build
cmd /c npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json
git diff --check
```

## Resultado de tests

| Caso | Resultado |
| --- | --- |
| A. Env apagado + tenant activo | OK, usa v1. |
| B. Env true + tenant sin config | OK, usa v1. |
| C. Env true + `saleV2Enabled=false` | OK, usa v1. |
| D. Env true + `saleV2Enabled=true` sin branches | OK, usa v2. |
| E. Env true + branch incluida | OK, usa v2. |
| F. Env true + branch no incluida | OK, usa v1. |
| G. Env `TRUE` | OK, usa v1. |
| H. Error consultando config | OK, usa v1 y log warning. |
| I. Payload y respuesta | OK, no cambian. |
| J. Contrato API | OK, no cambia firma publica de `createSaleWithFunction`. |

## Confirmaciones

- `inventory_create_sale` v1 no fue modificado.
- `inventory_create_sale_v2` no fue modificado.
- `inventory_invoice_order` no fue modificado.
- No se crearon migraciones.
- No se tocaron SQL functions.
- No se tocaron `web/`, `backend-reporteria/` ni POS UI.
- No se tocaron compras, ajustes, pedidos, reporteria ni seeds.
- No se ejecuto contra PRD.
- v1 sigue siendo default.
- v2 solo puede activarse con doble condicion: env true + config tenant/sucursal.

## Riesgos vivos

RIESGO: `tenants.config` mal editado puede dejar v2 apagada por fallback seguro. Es deseado para seguridad, pero requiere runbook para pilotos.

RIESGO: No hay cache de config. Cada venta con env true consulta `tenants.config`. Se acepta por ahora para evitar estado stale y complejidad.

RIESGO: Activacion por tenant/sucursal todavia requiere prueba operativa con POS real antes de ampliar alcance.

## Proximos pasos

- Definir tenant/sucursal piloto y actualizar `tenants.config` solo en local/QA autorizado.
- Ejecutar prueba POS/API local con `INVENTORY_SALE_V2_ENABLED=true` y config piloto.
- Crear runbook de activacion/reversion por tenant/sucursal.
