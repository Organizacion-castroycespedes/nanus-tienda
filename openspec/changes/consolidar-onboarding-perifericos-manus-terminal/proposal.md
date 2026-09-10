# Consolidar onboarding de periféricos Manus Terminal

## Objetivo

Convertir el instalador y la pantalla de periféricos POS en un flujo único
para descubrir, configurar, probar, asignar y persistir hardware real.

## Alcance

Se extiende la base existente de `integrar-electron-manus-terminal-windows`
y `alinear-terminales-operativas-perifericos-pos`. Agent qa.4 permanece
inmutable; los cambios físicos se entregarán como una nueva versión QA.

Incluye USB/PnP genérico, colas desconectadas, impresoras de red, scanner
keyboard-wedge, cajón vía impresora, asignación por terminal y handoff
installer→Manus POS. No incluye watchdog ni kiosk.
