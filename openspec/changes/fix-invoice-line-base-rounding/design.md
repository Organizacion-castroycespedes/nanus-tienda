## Context

FactuCore y el mapper de `backend-facturacion-electronica` recalculan cada impuesto porcentual como `round(base x tarifa)` con redondeo DIAN half-up, y la base como `round(cantidad x unitPrice - descuento)`. Manus rechaza la factura si `base + impuestos` difiere del cobro en mas de `0.05`.

Pricing hoy:

- Impuesto incluido: `base = round(unit / (1 + r)) x qty`, `iva = cobro - base`.
- Precio separado: `base = round(price_without_tax x factorPromo) x qty`, `iva = round(base x r)`, cobro = `price_with_tax x qty`.
- Licor con precio separado: base IVA = mismo calculo por unidad.

El error crece con la cantidad (`qty x 0.005 x (1 + r)`).

## Goals / Non-Goals

**Goals:**
- `base + round(base x r) + otros impuestos = cobro` por linea, con diferencia maxima `0.01`.
- `unitPrice x qty` reconstruye la base de linea hasta FactuCore y el XML.

**Non-Goals:**
- No cambiar lo que paga el cliente (`lineTotal`).
- No cambiar lineas con impuesto no incluido y sin precio separado: alli la base sale del precio y el total ya es `base + impuesto`.
- No cambiar ICL, ADV ni impuestos FIXED_AMOUNT.
- No corregir el modelo fiscal de cerveza.

## Decisions

1. `resolveLineTaxBase(neto, r)`: parte de `round(neto / (1 + r))` y prueba `+-0.02` en centavos enteros; elige la base cuyo `base + round(base x r)` difiera menos de `neto`, desempatando por cercania a `neto / (1 + r)`. El redondeo del impuesto usa el mismo half-up que `calculateDianTaxAmount`. Alternativa descartada: residuo; la factura lo recalcula y no cuadra.
2. `neto = cobro de linea - ICL - ADV - FIXED_AMOUNT` cuando esos impuestos estan dentro del cobro (licor con precio separado o IVA incluido). Si `neto < 0`, error como hoy.
3. `unitPrice` se envia como string con 6 decimales sin ceros sobrantes forzados (`toFixed(6)`). Los demas montos siguen con 2 decimales.
4. `electronic_document_lines.unit_price` a `NUMERIC(18,6)`: ampliar escala no pierde datos y el `CHECK unit_price >= 0` sigue valido.
5. FactuCore: `PriceAmount` con `formatDianUnitAmount`. `LineExtensionAmount` ya es `toFixed(2)` de `qty x unitPrice`.

## Risks / Trade-offs

- [Base distinta a la configurada en `price_without_tax`] -> Es la base que cuadra con lo cobrado; con datos coherentes la diferencia es de centavos.
- [Cobros no alcanzables exacto por saltos de redondeo] -> Diferencia `0.01`, dentro de la tolerancia `0.05` de Manus y FactuCore valida consistencia interna.
- [Despliegue] -> `api`, `facturacion`, `V101` y FactuCore deben salir juntos; si FactuCore sale despues, `PriceAmount` redondea a 2 decimales y FAV06 puede notificar diferencia.
