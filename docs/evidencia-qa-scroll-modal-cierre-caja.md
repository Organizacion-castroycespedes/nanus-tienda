# Evidencia QA - Scroll modal cierre caja

Fecha: 2026-06-23

## Alcance

Vista: `/{tenant}/finance/cash-sessions`

Cambio visual para modal `Cerrar caja`.

## Diagnostico

- El modal se abre en `web/app/[tenant]/finance/cash-sessions/page.tsx`.
- Los botones finales se renderizan en `web/modules/finance/components/CloseCashSessionForm.tsx`.
- El modal de cierre no tenia `max-height` efectivo.
- El formulario de cierre no tenia cuerpo con `overflow-y-auto`.
- Los botones estaban dentro del mismo flujo vertical del contenido largo.

## Casos QA

### 1. Desktop normal

Estado: Pendiente de QA manual.

Pasos:

1. Abrir `/{tenant}/finance/cash-sessions`.
2. Presionar `Cerrar caja`.
3. Confirmar que el modal se ve completo.
4. Confirmar que `Cancelar` y `Cerrar caja` son visibles.

### 2. Pantalla pequena / movil

Estado: Pendiente de QA manual.

Pasos:

1. Reducir alto y ancho del navegador.
2. Abrir el modal `Cerrar caja`.
3. Confirmar que el contenido hace scroll interno.
4. Confirmar que los botones finales siguen accesibles.
5. Confirmar que no hay scroll horizontal global.

### 3. Datos largos

Estado: Pendiente de QA manual.

Pasos:

1. Abrir modal con desglose de caja amplio.
2. Revisar secciones de medios de pago, domicilios y totales.
3. Confirmar que el contenido se puede recorrer verticalmente.
4. Confirmar que las acciones finales siguen accesibles.

### 4. No regresion

Estado: Pendiente de QA manual.

Validar:

- El calculo de cierre no cambia.
- `Cancelar` funciona.
- `Cerrar caja` sigue disponible.
- Ticket de cierre no cambia.
- Arqueo no cambia.

## Resultado esperado

- Modal limitado al alto del viewport.
- Cuerpo con scroll interno.
- Footer de acciones accesible.
- Sin cambios funcionales de caja.

## Validaciones automaticas

- `openspec.cmd validate corregir-scroll-modal-cierre-caja --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS.
- `cd web && npm.cmd run lint`: PASS con advertencias existentes.
- `cd web && npm.cmd run build`: PASS con advertencias existentes.
- `git diff --check`: PASS.

## Nota QA visual

La verificacion visual en navegador queda pendiente de ejecucion manual. El entorno local de browser no pudo conectarse durante esta corrida.
