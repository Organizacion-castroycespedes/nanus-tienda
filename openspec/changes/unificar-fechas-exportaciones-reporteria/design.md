## Context

Los seis flujos usan `backend-reporteria`, pero cada servicio normaliza fechas por separado. Una fecha sin zona (`YYYY-MM-DD`) se interpreta como UTC; PostgreSQL recibe intervalos semiabiertos correctos en forma, pero desplazados cinco horas para `America/Bogota`. Las listas de reportería cargan todos los registros y paginan en frontend; las exportaciones recolectan todos los registros mediante `DocumentExportService`, que ya usa una transacción `REPEATABLE READ`.

La revisión QA del 26/09/2026 confirmó una segunda capa del mismo problema: PDF POS y datos PostgreSQL coincidían, pero Excel POS convertía los instantes a `Date` serializables sin zona y mostraba `05:00` en vez de `00:00` Bogotá. El patrón `new Date(...)` más `numFmt` también está presente en Excel de caja, compras y pedidos.

## Goals / Non-Goals

**Goals:**

- Centralizar la resolución del período efectivo y validaciones para reportes.
- Usar `America/Bogota` como zona efectiva del escenario actual, con una configuración única y extensible.
- Resolver ausencia de fechas como inicio del día actual hasta `now`.
- Resolver fechas de calendario como inicio local inclusivo y siguiente inicio local exclusivo, limitando hoy al instante actual.
- Aplicar la ventana dinámica de tres meses calendario y rechazar futuros o rangos invertidos.
- Reutilizar datasets y snapshot de exportación existentes.

**Non-Goals:**

- No cambiar cierres, pagos, auditoría histórica ni operaciones transaccionales.
- No agregar tablas, migraciones, endpoints nuevos o dependencias externas.
- No cambiar semántica de filtros de estado, permisos, tenant o sucursal.

## Decisions

1. **Resolver en backend con una utilidad compartida.** Se usará una utilidad de fechas del módulo de reportes que reciba `now` inyectable para pruebas y produzca `dateFrom`, `dateTo` y metadatos de presentación. Esto evita cuatro implementaciones divergentes. Alternativa descartada: corregir solo el frontend, porque solicitudes directas y exportaciones seguirían sin límites seguros.

2. **Calendario local convertido a UTC.** Para fechas de entrada se calculará la medianoche de `America/Bogota` y se enviará a SQL como `timestamptz`; el fin será exclusivo. No se usará `new Date("YYYY-MM-DD")` como frontera. Alternativa descartada: `AT TIME ZONE` repetido en cada consulta, porque duplica reglas y facilita errores.

3. **Un mismo contrato para lista y documento.** Los servicios construirán filtros resueltos antes de llamar a adaptadores de lista o a `DocumentExportService`. Las exportaciones seguirán recolectando lotes completos dentro de `REPEATABLE READ`; no exportarán la página visible.

4. **Límite de tres meses calendario.** La fecha mínima será la misma fecha del día actual menos tres meses, ajustada al último día válido del mes destino. Se valida antes de acceder a SQL. El frontend refleja esa regla para UX, pero el backend es autoridad.

5. **Metadatos explícitos.** Los datasets y documentos mostrarán período efectivo, zona e instante de generación. Se preservan campos existentes y se agregan solo campos opcionales compatibles donde sea necesario.

6. **Excel sin conversión implícita.** Las fechas de período y las fechas de filas se escriben como strings producidos por una utilidad común con `timeZone: America/Bogota` y el identificador de zona incluido. Excel no recibe objetos `Date` para timestamps de reportes. Las horas reales de apertura, cierre y auditoría se conservan como instantes UTC y solo cambia su presentación.

## Risks / Trade-offs

- [Cambio de resultados sin fechas] → Ahora se consulta el día actual en vez de todo el histórico; se documenta en el contrato y se cubre con pruebas.
- [Zona configurable mal definida] → Mantener una constante de configuración única, validar zona soportada y cubrir conversión Bogotá/UTC.
- [Exportación grande] → Conservar `MAX_REPORT_EXPORT_ROWS` y el snapshot actual; devolver el error existente si excede el límite.
- [Pantalla y exportación consultadas en instantes distintos] → Las exportaciones usan su snapshot existente y reciben exactamente los filtros efectivos enviados; no se introduce persistencia nueva.

## Migration Plan

No hay migración de datos. Desplegar backend y frontend juntos; si el frontend anterior envía fechas simples, el backend las acepta bajo el nuevo contrato. Rollback consiste en revertir el código desplegado, sin cambios de esquema.

## Open Questions

- Confirmar en despliegue si una futura configuración de tenant debe reemplazar `America/Bogota`; esta tarea usa la zona efectiva definida para el escenario QA.
