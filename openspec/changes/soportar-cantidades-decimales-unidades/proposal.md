## Why

Un producto por unidad hoy acepta cualquier decimal en la recepcion (se registraron 10.85 y 0.98 en un cable manejado en unidades) y la ruedita del mouse cambia la cantidad a recibir. A la vez, productos que si se venden fraccionados (cable por metro) no se pueden vender con decimales en el POS, aunque la base y la API ya lo soportan. Tampoco existen unidades de longitud, volumen o area, y la facturacion electronica solo traducia UND a EA: un producto en KG enviaba "KG", que FactuCore rechaza (solo aceptaba NIU, EA y DAY).

## What Changes

- V118: `products.allows_decimal_quantity` (por defecto FALSE), unidades `M`, `L`, `CM`, `M2` para venta por unidad, regla de base de datos (decimales solo por unidad y sin serie) y marcado automatico de productos que ya tienen movimientos o compras con decimales. Rollback protegido.
- API: regla entero/decimal en crear/editar compra, recepcion y venta POS (verificacion temprana en `sale.service`, sin tocar `inventory_create_sale_v2`). Redondeo de pendientes a 3 decimales. Quitar la marca solo si no hay cantidades fraccionadas. La unidad se puede cambiar despues de crear dentro de la venta por unidad.
- Web: casilla "Permite cantidades con decimales" y unidades nuevas en el producto; recepcion con paso entero/decimal por producto, sin ruedita ni flechas, aviso de confirmacion antes de recibir y pendientes redondeados; captura de compra valida enteros; POS acepta decimales al escribir en productos marcados y completa hasta el stock.
- Facturacion electronica: el mapper de FactuCore traduce UND->EA, KG->KGM, G->GRM, LB->LBR, OZ->ONZ, M->MTR, L->LTR, CM->CMT, M2->MTK. FactuCore agrega esos codigos (change propio en ese repositorio).
- Ticket de compra: etiquetas de liquidacion cortas para que no se monten sobre el valor.

## Impact

- Migracion V118 (local: `Claude outputs/aplicar-V118-local.cjs`; QA/PRD: runner oficial). Despliegue de FactuCore con su migracion antes de vender productos en M, L, CM, M2 o KG con factura electronica.
- Fuera de alcance: pedidos (ordenes de venta) con decimales, conversion entre unidades, unidades adicionales.
