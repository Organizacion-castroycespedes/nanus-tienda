## Why

Manus tiene dos identidades de terminal sin una relación explícita.
`terminals` es la terminal operativa usada por ventas, sesiones POS y caja;
`pos_terminals` nació como configuración MOCK de periféricos. Al resolver
una terminal operativa real, la configuración actual puede caer en
`local-terminal`, una identidad paralela creada para QA.

La XP-80 USB fue validada con ese bridge. Para soportar periféricos reales de
forma segura en WEB o Electron, la configuración debe pertenecer a la terminal
operativa del negocio.

## What Changes

- Agregar una relación opcional y única de `pos_terminals` hacia
  `terminals` mediante `operational_terminal_id`.
- Resolver configuración de periféricos primero por `terminals.id`, con
  tenant y sucursal validados.
- Mantener temporalmente `pos_terminals` y `local-terminal` como bridge
  legado/MOCK controlado, sin fallback MOCK silencioso para hardware real.
- Ajustar contratos API/UI para distinguir `operationalTerminalId`, código
  local del Agent y `deviceId` de periférico.
- Crear una migración idempotente con preflight, mapping aprobado, rollback y
  QA. Su ejecución queda restringida al runner incremental seleccionado y a
  una aprobación explícita por entorno.

## Capabilities

### New Capabilities

- `operational-terminal-peripheral-configuration`: Asociar de forma explícita
  la configuración POS/periféricos a una terminal operativa real y resolverla
  sin identidad paralela.

### Modified Capabilities

- None.

## Impact

- API: `pos-terminals`, `resolve-current`, DTOs, repository y pruebas.
- DB: futura migración aditiva para FK/unique/index y bridge de datos.
- Web: `/config/terminals`, `/admin/peripherals`, resolución de impresión
  directa y contratos de periferales.
- Agent: conserva un código local de terminal; no pasa a ser dueño de la
  terminal comercial.
- No modifica ventas, pagos, impuestos, inventario, caja, scanner, balanza ni
  cajón en esta fase.
