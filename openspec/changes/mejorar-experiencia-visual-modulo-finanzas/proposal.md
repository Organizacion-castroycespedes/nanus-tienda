## Why

El padre `/{tenant}/finance` concentra datos útiles, pero hoy consume demasiado espacio y repite la navegación en tarjetas grandes y en `FinanceSectionNav`. En terminales POS se necesita una portada financiera compacta que muestre primero las rutas operativas, el estado de caja actual, KPI ya disponibles y sesiones recientes sin cambiar la lógica ni los contratos financieros.

## What Changes

- Rediseñar exclusivamente la portada `/{tenant}/finance` con encabezado compacto y acción existente de abrir/cerrar caja o arqueo.
- Reemplazar la navegación visual duplicada por cuatro accesos rápidos: Caja/Sesiones, Movimientos, Cajas y Métodos de pago, respetando permisos y rutas reales.
- Reorganizar los KPI existentes en tarjetas compactas y priorizar el estado de la caja/turno actual.
- Convertir “Últimos cierres y aperturas” en una lista operacional compacta usando los mismos datos de historial.
- Mantener el acceso a `/{tenant}/finance/current-shift` sin presentarlo como una quinta tarjeta redundante del padre.
- Preservar loading, error, empty, autorización, handlers y navegación existentes.
- No modificar backend, base de datos, contratos, servicios, permisos ni submódulos financieros.

## Capabilities

### New Capabilities

- `finance-operational-landing`: Organización visual POS-first de la portada financiera, con accesos rápidos, resumen operativo y sesiones recientes.

### Modified Capabilities

No se modifican requisitos funcionales existentes. Las rutas, permisos, datos y flujos de Finanzas permanecen sin cambios.

## Impact

- `web/app/[tenant]/finance/page.tsx` y, solo si una prueba de presentación lo requiere, cobertura frontend asociada.
- Nuevos artefactos OpenSpec bajo este change.
- No hay cambios en `backend-reporteria`, `api`, PostgreSQL, migraciones, endpoints, DTOs, hooks/services de Finance ni autorización.
- No se agregan dependencias visuales.
