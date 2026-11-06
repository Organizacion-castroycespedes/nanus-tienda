# QA manual - fiscal avanzado de productos para ADMIN

## Condiciones seguras

- Ejecutar solo en ambiente local o QA autorizado para el tenant Premium Brands.
- Usar usuarios reales de prueba con roles `ADMIN`, `SUPER_USER`, `SUPER_ADMIN` y `USER`.
- No emitir documentos electronicos reales ni usar credenciales productivas.
- Registrar commit desplegado de web y API antes de atribuir resultados al cambio.
- Preparar un SKU unico de prueba y eliminarlo o desactivarlo segun el procedimiento normal del ambiente.

## Caso ADMIN - crear IVA 19% incluido

1. Iniciar sesion como `ADMIN` de Premium Brands con escritura de productos.
2. Abrir `/{tenant}/inventory/products` y seleccionar Crear producto.
3. Confirmar que aparece `Configuracion avanzada`.
4. Completar datos basicos, unidad, precio y costo.
5. Abrir configuracion avanzada, elegir categoria fiscal aplicable y agregar IVA 19% con `Precio incluye impuesto` activo.
6. Guardar.
7. Recargar el listado, abrir el producto y confirmar categoria, IVA, orden e inclusion.
8. Confirmar que el precio final y el precio sin impuestos siguen el preview existente.

Resultado esperado: creacion exitosa, configuracion persistida y sin acceso a datos de otro tenant.

## Caso ADMIN - editar y preservar asignaciones

1. Abrir el producto creado como `ADMIN`.
2. Confirmar que las asignaciones existentes aparecen completas.
3. Cambiar el orden o inclusion de una asignacion sin eliminar las demas.
4. Guardar, recargar y volver a abrir.
5. Confirmar que el cambio persiste y que ninguna asignacion no eliminada desaparecio.
6. Repetir una edicion solo de nombre/costo y comprobar que la configuracion fiscal permanece igual.

Resultado esperado: solo cambian los campos elegidos; no hay borrado fiscal accidental.

## Caso ADMIN - DANE y vigencias

1. En un producto de prueba con ADV, informar categoria fiscal, grado alcoholico, volumen, precio DANE y vigencias.
2. Intentar guardar sin precio DANE.
3. Confirmar que el formulario bloquea el envio y muestra la validacion requerida.
4. Informar precio DANE y vigencias validas, guardar y recargar.

Resultado esperado: validacion ADV activa y perfil fiscal persistido con vigencias.

## Compatibilidad SUPER_USER y SUPER_ADMIN

1. Repetir apertura y edicion con `SUPER_USER` y `SUPER_ADMIN`.
2. Confirmar que ambos conservan el acordeon y el comportamiento previo.
3. Confirmar que el contexto seleccionado no expone productos o impuestos fuera del tenant autorizado.

Resultado esperado: sin regresion para roles superiores.

## Control negativo USER

1. Iniciar sesion como `USER`.
2. Intentar navegar al listado y a una URL directa de edicion segun permisos del ambiente.
3. Confirmar que no puede crear/editar productos y que no ve configuracion fiscal avanzada.
4. Si se intenta una llamada directa, confirmar rechazo por autorizacion backend.

Resultado esperado: ningun escalamiento de permisos.

## POS y documento fiscal sin emision real

1. En QA/local, consultar el producto desde POS sin completar una venta productiva.
2. Confirmar preview/precio esperado para IVA incluido y, si aplica, ICL/ADV.
3. Generar solo preview o borrador de documento fiscal permitido por el ambiente.
4. Comparar bases, impuestos y total con el comportamiento anterior.
5. No transmitir a DIAN ni a FactuCore productivo.

Resultado esperado: este cambio no altera formulas, redondeos, POS ni mapeo fiscal.

## Evidencia a registrar

- Ambiente, fecha, rama/commit web y API.
- Tenant y rol usado, sin datos personales ni secretos.
- SKU de prueba.
- Capturas del acordeon antes/despues y payload sanitizado.
- Resultado por caso: `PASS`, `FAIL`, `BLOCKED` o `PARTIAL`.
- Cualquier diferencia entre codigo local y version desplegada.

## Resultado observado reportado

- Fecha del reporte: 2026-11-05.
- Fuente: reporte del operador/usuario; no observado directamente por el agente.
- Ambiente: local, no productivo.
- Rama: `fix/develop/admin-product-fiscal-advanced`.
- Base/HEAD reportado durante la ejecucion: `9f81261a76c90ffdca0107a5834ac4735fd920fa` con cambios sin commit.
- Alcance reportado para `ADMIN`: creacion, edicion, modificacion, eliminacion y persistencia despues de recargar - `PASS`.
- Evidencia automatizada: no sustituida por este resultado manual; la suite focalizada continuaba bloqueada por dependencias locales al momento del reporte.
- Evidencia no aportada en el reporte: capturas, payload sanitizado, SKU, prueba negativa de `USER`, matriz observada de `SUPER_USER`/`SUPER_ADMIN`, aislamiento cruzado de tenant, verificacion POS y preview de documento fiscal.
- Despliegue QA/PRD: no ejecutado ni validado.

Resultado manual global: `PARTIAL`. El flujo CRUD y la persistencia local reportados son `PASS`; los demas casos siguen pendientes de evidencia.
