## Context

`products.dian_standard_item_scheme_id` / `dian_standard_item_code` (V097) alimentan `standardItemId` / `standardItemSchemeId` del snapshot de facturacion. FactuCore exige `standardItemId` en toda linea de factura. Las restricciones de V097 exigen par completo, esquema en `001/010/020/999` y codigo no vacio que no parezca UUID.

## Goals / Non-Goals

**Goals:**
- Que ningun producto con SKU quede sin identificacion estandar.

**Non-Goals:**
- No inventar GTIN (`010`): sin codigo de barras verificado se usa `999`.
- No cambiar productos que ya tienen identificacion.
- No reintentar facturas rechazadas (rechazo terminal).

## Decisions

1. Esquema `999` con codigo = `btrim(sku)`, igual que el default del formulario de producto. Alternativa descartada: `010` con SKU; el SKU no es GTIN.
2. Filtro: ambos campos NULL, SKU no vacio y que no parezca UUID (respeta `products_dian_standard_item_pair_chk`).

## Risks / Trade-offs

- [Codigo `999` menos preciso que GTIN] -> Valido para DIAN; el usuario puede cambiarlo a `010` desde el formulario cuando tenga el codigo de barras.
