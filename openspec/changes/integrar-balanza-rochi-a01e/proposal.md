# Propuesta: integrar-balanza-rochi-a01e

## Why

El Peripheral Agent ya tiene un m?dulo de balanza MOCK, pero no tiene un parser desacoplado para la balanza ROCHI RC-A01E observada por USB-SERIAL CH340. Se necesita aislar el protocolo antes de conectar un puerto f?sico y mientras la homologaci?n del equipo queda pendiente.

## What Changes

- Agregar parser puro para tramas ASCII `DDD.DDD` terminadas en `CR LF`.
- Gestionar fragmentaci?n, concatenaci?n, corrupci?n y l?mite de b?fer.
- Requerir unidad de origen expl?cita (`KG` o `LB`).
- Convertir `LB` a `kg` con factor `0.5` solo para este protocolo y configuraci?n verificada.
- Mantener errores de comunicaci?n separados de lecturas inv?lidas.
- Agregar fixtures de las capturas `000.000`, `000.245`, `000.270` y `000.490`.
- Integrar el adapter serial configurable, discovery Windows CH340, persistencia local y lectura REAL en el Peripheral Agent.
- Integrar la configuración física en el instalador, incluida la confirmación explícita del operador de que el display usa KG.
- Mantener el POS fail-closed: UNIT continúa operativo y WEIGHT/BOTH no capturan ni agregan peso sin la autorización comercial futura.

La integración incluye transporte local configurable con `serialport@12`, diagnóstico acotado y discovery por identidad PnP CH340 `VID_1A86/PID_7523`. El puerto COM observado se reconcilia por PnP y nunca se fija a un número concreto.

La selección y persistencia requieren el perfil explícito `ROCHI_A01E` y parámetros `9600/8/N/1` sin flow control. El Agent no infiere unidad ni estabilidad.

## Alcance validado

La evidencia aportada por el operador cubre QA fisico Windows para cero, KG, LB, desconexion USB, reenumeracion del CH340, recovery explicito, lectura nueva y cierre seguro. Esta evidencia no constituye homologacion metrologica ni habilitacion comercial.

## Out of Scope

- Integraci?n comercial de la lectura con ventas, impuestos, facturaci?n, inventario, base de datos o captura POS.
- Validaci?n Linux y empaquetado por plataforma no demostrado.
- Inferencia de unidad o estabilidad metrol?gica.
- Homologaci?n f?sica o habilitaci?n para ventas reales.
- Enrollment, credenciales cloud, terminal-scale bindings, `AUTHORIZED`, `REAL_AVAILABLE` y cualquier migración de base de datos.
