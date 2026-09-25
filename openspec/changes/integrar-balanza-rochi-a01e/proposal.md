# Propuesta: integrar-balanza-rochi-a01e

## Why

El Peripheral Agent ya tiene un módulo de balanza MOCK, pero no tiene un parser desacoplado para la balanza ROCHI RC-A01E observada por USB-SERIAL CH340. Se necesita aislar el protocolo antes de conectar un puerto físico y mientras la homologación del equipo queda pendiente.

## What Changes

- Agregar parser puro para tramas ASCII `DDD.DDD` terminadas en `CR LF`.
- Gestionar fragmentación, concatenación, corrupción y límite de búfer.
- Requerir unidad de origen explícita (`KG` o `LB`).
- Convertir `LB` a `kg` con factor `0.5` solo para este protocolo y configuración verificada.
- Mantener errores de comunicación separados de lecturas inválidas.
- Agregar fixtures de las capturas `000.000`, `000.245`, `000.270` y `000.490`.
- Fase 2: agregar un adapter serial configurable detras de una factory y un simulador inyectable para QA, sin conectar la lectura al proceso de ventas.

La Fase 2 incluye transporte local configurable con `serialport@12`, diagnostico acotado y gates explicitos para QA. No hace discovery automatico de COM3, no selecciona el modelo automaticamente y no abre hardware al arrancar.

La restricción inicial sobre puerto serial queda ampliada únicamente por esta Fase 2: no se hace discovery automático de COM3, no se selecciona modelo automáticamente y no se habilita hardware al arrancar.

## Alcance validado

La evidencia aportada por el operador cubre QA fisico Windows para cero, KG, LB, desconexion USB, reenumeracion del CH340, recovery explicito, lectura nueva y cierre seguro. Esta evidencia no constituye homologacion metrologica ni habilitacion comercial.

## Out of Scope

- Integración comercial de la lectura con ventas, impuestos, facturación, inventario, base de datos o captura POS.
- Discovery automático de dispositivos, selección automática de modelo o reconexión automática.
- Validación Linux y empaquetado por plataforma no demostrado.
- Inferencia de unidad o estabilidad metrológica.
- Homologación física o habilitación para ventas reales.
