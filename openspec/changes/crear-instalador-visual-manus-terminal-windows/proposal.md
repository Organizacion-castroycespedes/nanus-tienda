## Why

ManusTerminalSetup instala un PeripheralAgent funcional, pero expone un flujo tecnico y poco claro para operadores Windows. Este cambio define una experiencia visual profesional que muestre progreso, dispositivos y estado final sin exigir PowerShell, JSON ni configuracion manual.

## What Changes

- Crear shell visual Windows para instalacion y configuracion de terminal.
- Mostrar pasos con estados `PENDING`, `RUNNING`, `SUCCESS`, `WARNING`, `ERROR` y `SKIPPED`.
- Mostrar impresoras, perfiles, cajon monedero y perifericos no detectados.
- Consumir contratos existentes del Agent: health, discovery, device update y pruebas.
- Mostrar detalles tecnicos solo bajo demanda, sin secretos.
- Preparar layout responsive para resoluciones Windows POS.
- Dejar launcher/kiosk avanzado para una fase posterior.

## Capabilities

### New Capabilities

- `visual-terminal-installer`: experiencia visual, estados de instalacion, dispositivos y terminal lista.

### Modified Capabilities

<!-- No se cambian requisitos del PeripheralAgent ni de impresion fisica. -->

## Impact

- `backend-perifericos/windows-installer` como host y entrypoint Windows.
- Posible bundle de assets UI, sin cambiar contratos ni runtime del Agent.
- Componentes y estilos reutilizables de `web/` solo si son compatibles con el host.
- Nuevos tests de componentes/estados y validacion manual Windows.
