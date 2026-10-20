## Context

FactuCore valida cada impuesto en `validateDianLineTaxBreakdown`:

- ICL (`32`): base = `cantidad x volumen x grados / 750`, importe = `round2(base sin redondear x tarifa)`.
- ADV (`36`): base = `cantidad x publicSalePriceBeforeTaxes`, importe = `base x tarifa% / 100`.
- IVA y demas porcentuales: base = `cantidad x unitPrice - descuento`, importe = `base x tarifa% / 100`.

Manus pricing ya calcula los tres asi. El fallo esta solo en el mapper de `backend-facturacion-electronica`.

## Goals / Non-Goals

**Goals:**
- Enviar a FactuCore el importe ICL calculado por pricing.
- Mantener el recalculo DIAN para impuestos porcentuales.
- Pago unico igual al total real del documento.

**Non-Goals:**
- No cambiar pricing, precio de gondola (`price_with_tax`), flags `is_included` ni tarifas.
- No reaplicar `V099__standardize_liquor_taxes_not_included.sql`.
- No cambiar FactuCore.

## Decisions

1. Detectar impuesto especifico por scheme `32` (o tipo `ICL`). Para esos, `rate` se envia tal cual y `taxAmount` = importe recibido. Alternativa descartada: dividir 360 entre 100; el ICL no es porcentaje.
2. `calculateFactuCoreLineTotal` suma los `taxAmount` mapeados en lugar de aplicar cada tarifa a la base de linea. Para lineas solo IVA el resultado es identico porque el mapper ya recalcula ese importe con la base de linea.
3. `normalizeElectronicBillingTaxForQuantity` recibe `expectedLineBase` desde el perfil del producto (`cantidad x grados x ml / 750` para ICL, `cantidad x DANE` para ADV). Solo escala si la base guardada x cantidad coincide con la esperada y la base guardada no. Sin perfil, conserva el snapshot de pricing, que ya es de linea. Alternativa descartada: inferir por `base x tarifa = importe`, que no distingue unidad de linea.
4. `V100` recalcula la base fiscal desde `fnc_list_product_taxes_for_pricing`, la misma fuente que pricing, y respeta `price_with_tax`.

## Risks / Trade-offs

- [Risk] Un ICL con importe mal calculado aguas arriba ya no se "corrige" en el mapper. Mitigation: FactuCore sigue validando y rechaza con mensaje claro; pricing tiene pruebas propias.

## Migration Plan

Rebuild de `facturacion` (y `api` para levantar juntos). Reintentar la factura rechazada o registrar una venta nueva.

Rollback: revertir el commit del mapper.
