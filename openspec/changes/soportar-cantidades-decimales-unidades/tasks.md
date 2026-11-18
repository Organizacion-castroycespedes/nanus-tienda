## 1. Base de datos

- [x] 1.1 V118 + rollback + pruebas (estaticas y funcionales en PostgreSQL 16).
- [x] 1.2 Aplicar V118 en local (`node "Claude outputs\aplicar-V118-local.cjs" --aplicar`). QA/PRD: runner oficial en el despliegue.

## 2. API

- [x] 2.1 Producto: `allowsDecimalQuantity`, unidades nuevas, cambio de unidad dentro de venta por unidad, bloqueo al quitar la marca con fracciones.
- [x] 2.2 Compras: regla entero/decimal al crear/editar y al recibir; redondeo de pendientes.
- [x] 2.3 Ventas: verificacion temprana en `sale.service`.
- [x] 2.4 Pruebas (`quantity-policy.spec`, `product-decimal-units.entity.spec`).

## 3. Facturacion electronica

- [x] 3.1 Mapper de unidades DIAN en backend-facturacion-electronica + prueba.
- [x] 3.2 FactuCore: codigos KGM, GRM, LBR, ONZ, MTR, LTR, CMT, MTK (catalogo, enum y migracion Prisma).
- [x] 3.3 QA: venta de cable en M con 10.85 y factura electronica aceptada por DIAN (habilitacion).

## 4. Web

- [x] 4.1 Formulario de producto (casilla y unidades).
- [x] 4.2 Recepcion: paso por producto, sin ruedita, confirmacion, pendientes redondeados.
- [x] 4.3 Captura de compra y POS con decimales.
- [x] 4.4 Ticket de compra: etiquetas de liquidacion.

## 5. Validacion

- [x] 5.1 `openspec.cmd validate soportar-cantidades-decimales-unidades --strict`.
- [x] 5.2 Suite completa API + build; lint + build web; tests backend-facturacion-electronica y FactuCore en Windows.
