# Change: Mejorar responsive de resumen de sesiones de caja

## Why

La vista `/{tenant}/finance/cash-sessions` comprime demasiado las tarjetas de resumen en anchos reducidos. Valores monetarios, badges y textos como `Sin arqueo` pueden quedar cortados o leerse mal.

## What Changes

- Ajustar layout responsive de la pagina de sesiones de caja.
- Evitar grids fijos de muchas columnas en contenedores estrechos.
- Hacer que las tarjetas de metricas tengan ancho minimo razonable y permitan wrap.
- Ajustar clases de valores y badges para evitar overflow visual.
- Mantener acciones existentes visibles.

## Non-Goals

- No tocar backend.
- No tocar SQL ni migraciones.
- No modificar calculos de caja.
- No modificar cierre de caja.
- No modificar ticket de cierre.
- No modificar POS.
- No modificar pagos.
- No modificar permisos.
