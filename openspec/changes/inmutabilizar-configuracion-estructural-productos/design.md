## Context

`products` ya persiste `unit_id`, `sale_type`, `measurement_unit`, `is_perishable`, `requires_lot` y `requires_expiration`. El formulario web permite definirlos al crear, pero tambien cambiarlos al editar. `ProductService.updateProduct` valida la combinacion final y luego actualiza por `id + tenant_id`; el importador tambien usa este servicio.

Cambiar esas columnas despues del primer guardado cambia la interpretacion de cantidades, FEFO y trazabilidad historica. No existe una columna autoritativa de producto "inventariable" y no se debe inferir esa condicion desde categoria, modelo de venta o stock minimo/maximo.

El producto local analizado presenta el caso real: Kardex agregado `133.000`, vinculos de lote netos `100.000` y saldos por lote `100.000`. La diferencia corresponde exactamente a un movimiento inicial `IN 33.000` anterior al cambio de configuracion y sin filas en `stock_movement_lots`.

## Goals / Non-Goals

**Goals:**

- Bloquear cambios reales de los seis campos estructurales desde el primer guardado.
- Mantener creacion, actualizaciones parciales, edicion comercial, permisos y aislamiento por tenant.
- Dar una explicacion visible y controles deshabilitados en edicion.
- Cubrir tambien llamadas API directas e importacion mediante una regla central.
- Definir una intervencion de datos separada, auditable y no ejecutada para las `33.000` unidades historicas.

**Non-Goals:**

- Crear un flag `inventariable` o reutilizar `product_categories`.
- Cambiar ventas, compras, FEFO, facturacion, Kardex, V108 o contratos de lotes.
- Agregar una migracion de esquema o ejecutar reconciliacion de datos.
- Asignar las unidades historicas al lote de compra posterior o inventar codigo/fecha de vencimiento.

## Decisions

### Campos estructurales cerrados

Los campos cerrados son `unitId`, `saleType`, `measurementUnit`, `isPerishable`, `requiresLot` y `requiresExpiration`.

- `unitId` define la unidad base persistida.
- `saleType` y `measurementUnit` definen como se interpreta una cantidad vendida.
- `isPerishable`, `requiresLot` y `requiresExpiration` definen trazabilidad y FEFO.

`operationalStatus`, `rotationClass`, `minStock`, `maxStock`, clasificacion, datos fiscales, costo, identidad comercial e imagen permanecen editables por sus flujos actuales. No se incluye un campo de inventariabilidad porque no existe en el contrato real.

Alternativa descartada: bloquear solo cuando existan movimientos. Permitiria que la misma entidad cambiara de significado entre el primer guardado y el primer movimiento, y deja una carrera innecesaria entre consulta y escritura.

### Comparar valores en backend

`ProductService.updateProduct` obtiene primero el producto con `id + tenantId`. Si un campo estructural esta presente y su valor difiere del persistido, responde `400 Bad Request` antes de abrir la transaccion de actualizacion. Si el cliente repite el mismo valor, la solicitud continua.

Esto conserva compatibilidad con el formulario actual y clientes historicos que envian snapshots completos. Tambien cubre importaciones porque `ProductImportService` delega la actualizacion al mismo servicio.

Alternativa descartada: rechazar por mera presencia. Romperia ediciones comerciales de clientes que reenvian campos sin modificarlos.

### Bloqueo visible en web

En modo `create` los seis controles siguen habilitados. En modo `edit`, unidad base, modelo de venta, unidad comercial y los tres indicadores de perecibilidad/lote/vencimiento quedan deshabilitados. Las dos secciones muestran una nota comun: la configuracion se define al crear y no puede cambiarse despues del primer guardado.

La proteccion web es orientativa; la autoridad sigue siendo backend.

### Compatibilidad historica

No se revalida ni normaliza de forma masiva la configuracion persistida. Un producto historico puede editar sus atributos permitidos aunque su combinacion estructural provenga de una version anterior. El backend usa sus valores actuales como baseline y solo impide diferencias nuevas.

### Reconciliacion de las 33 unidades como intervencion separada

La evidencia local muestra:

- movimiento inicial `0109316d-c101-4c06-9abc-65471a582874`, `IN 33.000`, sin vinculo de lote;
- compra posterior `IN 100.000` y sus reversos de venta netos en cero, todos vinculados al lote existente;
- Kardex `133.000`, vinculos netos `100.000` y balance de lote `100.000` en un unico tenant y sucursal;
- ninguna ubicacion asociada a los movimientos o balances observados.

No se debe modificar ni duplicar `stock_movements`. Tampoco se debe adjudicar el stock anterior al lote comprado despues. La intervencion segura requiere que negocio suministre un `lot_code` historico unico y una `expiration_date` real y vigente, porque el producto exige vencimiento. Entonces, en una sola transaccion y bajo `inventory_lock_stock_scope(tenant, branch, product)`, se debe:

1. bloquear producto, movimiento inicial y filas de lote/balance del alcance;
2. exigir que el movimiento siga siendo exactamente `IN 33.000`, pertenezca al tenant/sucursal/producto esperados y no tenga vinculos;
3. exigir que Kardex menos vinculos y Kardex menos balances sigan siendo `33.000`;
4. crear un lote separado con `is_legacy = true`, sin referencias de compra y con fecha de recepcion igual al movimiento inicial;
5. vincular `33.000` del movimiento existente a ese lote, sin crear movimiento nuevo;
6. crear su balance sin ubicacion por `33.000`, reservado `0.000`;
7. verificar Kardex = vinculos = balances = `133.000` y que el reconciliador ya no reporte stock sin lote;
8. confirmar solo si todas las aserciones pasan; cualquier divergencia aborta completa.

El SQL exacto se entrega como runbook revisable. Su ejecucion requiere autorizacion separada y respaldo vigente.

## Risks / Trade-offs

- [Clientes que mandan snapshots completos] -> Se aceptan valores estructurales identicos y se rechazan solo diferencias.
- [Importacion intenta cambiar estructura] -> La regla central genera error de fila en vez de omitir el cambio silenciosamente.
- [Producto historico con combinacion rara] -> Se conserva el baseline; no se fuerza migracion ni reinterpretacion.
- [Reconciliacion con trazabilidad desconocida] -> No ejecutar hasta tener codigo y vencimiento reales; nunca copiar el lote de compra posterior por conveniencia.
- [Carrera durante reconciliacion] -> Usar el mismo advisory lock de V108 y bloqueos de filas dentro de una sola transaccion.
- [Staging previo de otra HU] -> Los archivos de esta HU permanecen sin staging y el indice existente no se modifica.

## Migration Plan

No hay migracion de esquema.

1. Desplegar backend y web juntos o backend primero.
2. Verificar creacion y edicion comercial de productos existentes.
3. Verificar rechazo API de cambios estructurales.
4. Mantener la reconciliacion local fuera del despliegue.

Rollback funcional: revertir los cambios de servicio y UI. No hay datos ni DDL que deshacer.

## Open Questions

- PENDING: negocio debe suministrar y validar `lot_code` y `expiration_date` reales para las `33.000` unidades historicas.
- PENDING: la ejecucion de la reconciliacion local requiere autorizacion expresa separada despues de revisar el SQL y sus precondiciones.
