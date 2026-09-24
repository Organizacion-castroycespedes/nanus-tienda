# Fallos y recuperación: productos, inventario y pricing — B5.3.3

| Escenario | Tratamiento observado | Estado |
|---|---|---|
| SKU duplicado | validación por tenant | implementado |
| Producto inactivo | pricing rechaza producto inactivo | implementado |
| Precio por ruta incorrecta | bloquea campos y exige ruta de cambio | implementado |
| Cantidad negativa | validación de producto, balance y FEFO | implementado |
| Reserva mayor que disponible | rechazo de servicio | implementado |
| Lote vencido o bloqueado | exclusión de FEFO | implementado |
| Producto exige vencimiento sin fecha | rechazo de inconsistencia FEFO | implementado |
| Stock insuficiente | `canFulfill=false` en selección o excepción en decremento | implementado por ruta |
| Impuesto especial incompleto | excepción de pricing | implementado |
| Promoción fuera de rango | validación de fechas y valor | implementado |
| Promoción no aplicable | consulta por tenant, fecha, producto y sucursal | implementado |
| Error de escritura | rollback en servicios observados | implementado por ruta |
| Recepción o venta duplicada | controles propios del flujo; no universal | parcial |
| Timeout después de commit | no se demuestra reconciliación común | no verificado |
| Concurrencia de balance | validación y repositorio; QA de carrera pendiente | parcial/no verificado |

No se ejecutaron pruebas funcionales ni de concurrencia. Las pruebas de
`inventory-fefo`, balances, producto, compra, venta y promociones son
evidencia histórica versionada.
