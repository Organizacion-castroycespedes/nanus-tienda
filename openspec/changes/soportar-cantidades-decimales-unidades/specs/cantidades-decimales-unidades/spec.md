## ADDED Requirements

### Requirement: Marca de cantidades con decimales por producto

El sistema SHALL permitir marcar un producto de venta por unidad como "Permite cantidades con decimales". Sin la marca, las cantidades de compra, recepcion y venta por unidad MUST ser enteras. Con la marca SHALL admitir hasta 2 decimales. La marca MUST NOT combinarse con productos por peso ni con serie.

#### Scenario: Recibir decimales en un producto sin la marca

- **WHEN** se recibe 10.85 de un producto por unidad sin la marca
- **THEN** el sistema SHALL rechazar la recepcion sin crear movimientos de inventario.

#### Scenario: Vender fraccionado un producto marcado

- **WHEN** se vende 10.85 de un producto marcado con stock suficiente
- **THEN** el sistema SHALL registrar la venta con esa cantidad sin cambiar `inventory_create_sale_v2`.

#### Scenario: Quitar la marca con fracciones registradas

- **WHEN** se intenta quitar la marca a un producto con stock fraccionado en alguna sucursal o compras abiertas con decimales
- **THEN** el sistema SHALL rechazar el cambio.

#### Scenario: Decimal historico ya compensado

- **WHEN** un ajuste decimal fue corregido y el stock de cada sucursal es entero
- **THEN** el sistema SHALL permitir quitar la marca.

### Requirement: Unidades de medida por unidad

El sistema SHALL ofrecer las unidades UND, M, L, CM y M2 para productos de venta por unidad y KG, LB, G y OZ para productos por peso. La unidad de un producto por unidad SHALL poder cambiarse despues de crearlo dentro de ese grupo.

#### Scenario: Producto por peso con unidad de longitud

- **WHEN** se crea un producto por peso con unidad M
- **THEN** el sistema SHALL rechazarlo.

### Requirement: Unidad DIAN en facturacion electronica

El sistema SHALL enviar a FactuCore el codigo DIAN UN/ECE de la unidad del producto: UND como EA, KG como KGM, G como GRM, LB como LBR, OZ como ONZ, M como MTR, L como LTR, CM como CMT y M2 como MTK.

#### Scenario: Factura de cable por metro

- **WHEN** se factura electronicamente una venta de 10.85 M
- **THEN** la linea SHALL viajar con unitCode MTR y cantidad 10.85.

### Requirement: Recepcion protegida

La recepcion de compras SHALL usar paso entero o decimal segun el producto, SHALL ignorar la ruedita del mouse y las flechas en la cantidad, SHALL mostrar pendientes redondeados y SHALL pedir confirmacion con advertencia antes de registrar la recepcion.

#### Scenario: Confirmar recepcion

- **WHEN** el usuario pulsa "Confirmar recepcion"
- **THEN** la interfaz SHALL mostrar factura, productos y unidades a recibir y SHALL enviar la recepcion solo si el usuario confirma.
