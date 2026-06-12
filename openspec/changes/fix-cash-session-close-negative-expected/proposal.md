## Why

Cerrar caja puede devolver HTTP 500 cuando el resumen calcula `expectedAmount` negativo y luego se intenta guardar en `cash_sessions.expected_amount`. La base tiene `cash_sessions_expected_amount_check`, por eso el usuario ve "Internal server error" en vez de un cierre controlado.

## What Changes

- Normalizar el monto esperado del cierre de caja antes de persistirlo para cumplir la regla existente de montos no negativos.
- Mantener el cierre exitoso cuando el resumen tenga saldo esperado negativo por movimientos netos.
- Calcular la diferencia contra el monto esperado persistible.
- Agregar cobertura automatizada para el caso de `expectedAmount` negativo.
- Documentar evidencia tecnica del fix.

## Capabilities

### New Capabilities
- `cash-session-closing-controls`: Reglas de cierre de caja cuando el resumen financiero produce valores limite o negativos.

### Modified Capabilities
- Ninguna. No existe spec archivada de finanzas/cierre de caja en `openspec/specs/`.

## Impact

- `api/src/modules/finance/cash-sessions/cash-sessions.service.ts`
- Tests unitarios nuevos o existentes bajo `api/src/modules/finance/cash-sessions/`
- `openspec/changes/fix-cash-session-close-negative-expected/`
- Sin migracion SQL esperada; se respeta la constraint existente.
