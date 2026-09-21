## Context

La rama ya contiene módulos separados para POS, inventario, compras y reportes, además de un layout tenant compartido. El dashboard de inventario ya expone `summary`, series, tablas, `scope` y `filters`; no se encontró evidencia para tratar `summary.stockTotal` como moneda. La recepción de compras usa un servicio transaccional y DTOs propios. El reporte POS ya tiene hooks, servicios de reporte, paginación y representación de facturación electrónica.

## Goals / Non-Goals

**Goals:**

- Mejorar la legibilidad operativa manteniendo contratos y permisos.
- Ordenar clientes en presentación con comparación estable y locale español.
- Agregar `inventoryCostTotal` al contrato únicamente después de reutilizar la fuente de costo persistida.
- Compartir navegación responsive entre Web y Electron mediante CSS/layout existente.
- Persistir factura del proveedor en la misma transacción de recepción.
- Encapsular la estructura común de reportes para uso gradual.

**Non-Goals:**

- No inventar métricas, endpoints, estados DIAN ni reglas de unicidad.
- No migrar todos los reportes ni cambiar el motor de gráficos.
- No reemplazar el modelo de permisos, scope multi-tenant o paginación existente.
- No introducir valores de mock para completar tarjetas o gráficas.

## Decisions

1. **Ordenamiento de clientes en frontend.** Se ordenará la colección ya entregada por el contrato existente, usando `Intl.Collator("es", { sensitivity: "base", numeric: true })` y un índice original como desempate. Evita una API nueva y conserva búsqueda/selección.

2. **Costo de inventario en backend.** Se inspeccionará el modelo de lotes/productos y la consulta del dashboard. El backend calculará el total con la regla de costo vigente y devolverá `inventoryCostTotal`; frontend solo formatea el valor. Si no existe una fuente única demostrable, la tarea queda bloqueada.

3. **Responsive por CSS.** El breakpoint será `1280px`: navegación colapsada con drawer hasta ese ancho y sidebar persistente sobre ese ancho. Se reutilizarán clases, store y componentes del layout; no se duplicará implementación para Electron.

4. **Factura de proveedor dentro de recepción.** El DTO, servicio, repository y respuesta se extenderán solo con campos ausentes comprobados. La escritura ocurrirá en la transacción existente junto con movimientos y estado de recepción. No se agrega unicidad global sin regla de negocio demostrada.

5. **Estado electrónico contractual.** La acción de documento electrónico se habilitará mediante el enum/estado que ya usa el dominio de facturación electrónica y solo para aceptación DIAN. El ticket POS físico seguirá su flujo independiente.

6. **Plantilla de reportes.** Se agregará una composición pequeña en el design system o módulo común existente, con header, toolbar, summary, data, estados y paginación como slots. Nuevos reportes y futuras migraciones deberán evaluarla; esta rama solo migra POS.

## Risks / Trade-offs

- [Costo ambiguo] → detener implementación de costo y reportar tablas/campos encontrados.
- [Cambios de contrato] → mantener campos existentes y añadir el nuevo campo de forma aditiva.
- [Layout Electron divergente] → verificar que Electron carga el mismo bundle Web y probar ambos tamaños.
- [Recepción parcial] → usar la transacción actual y probar rollback cuando falle la factura.
- [Estado DIAN no concluyente] → bloquear la acción y documentar el enum real, sin comparar etiquetas visuales.

## Migration Plan

1. Aplicar OpenSpec y cambios frontend/backend.
2. Ejecutar tests focalizados, lint y builds.
3. Si la inspección demuestra columna ausente para factura o costo, agregar una migración nueva siguiendo la secuencia del repositorio; si no, no migrar.
4. Desplegar backend compatible antes que frontend cuando cambie un contrato.
5. Rollback: retirar UI nueva y mantener campos aditivos; revertir migración solo con el procedimiento real del repositorio.

## Open Questions

- ¿La fuente de costo vigente es costo promedio, último costo o costo por lote? Debe resolverse leyendo el repository/service real.
- ¿La recepción actual ya tiene fecha de factura con otro nombre? Debe confirmarse antes de agregar campo.
