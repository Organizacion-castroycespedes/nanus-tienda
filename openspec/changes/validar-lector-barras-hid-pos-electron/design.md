## Context

PosScreen ya tiene busqueda por codigo y un helper de scanner exacto. El flujo HID se trata como teclado: el lector escribe el valor en el input y suele cerrar con Enter. Electron no necesita API nativa para este caso.

## Goals / Non-Goals

**Goals:**

- Confirmar soporte HID en Web y Electron.
- Revisar el match exacto por codigo/SKU/barcode/referencia.
- Revisar el comportamiento de Enter.
- Revisar foco despues de agregar producto.
- Documentar reglas para multiples coincidencias y sin coincidencia.
- Mantener stock, peso y reglas de carrito existentes.

**Non-Goals:**

- No agregar integracion USB o serial.
- No agregar SDKs de lector.
- No agregar API Electron de scanner.
- No modificar reglas de negocio.
- No tocar caja, pedidos, facturacion, backend ni SQL.
- No implementar offline ni sincronizacion.

## Decisions

### 1. HID se trata como teclado

Decision: el lector HID debe usar el mismo campo de busqueda que usa una persona.

Rationale: evita hardware nativo y reutiliza el flujo ya soportado por Chromium.

### 2. Enter solo puede auto-agregar en match seguro

Decision: Enter no debe tomar el primer resultado difuso. Solo debe auto-agregar si existe coincidencia exacta y unica.

Rationale: evita agregar producto equivocado cuando hay varias coincidencias.

### 3. Foco vuelve al buscador

Decision: despues de un agregado exitoso, el foco debe volver al input de busqueda.

Rationale: permite escaneos consecutivos sin pasos extra.

### 4. Electron no expone API de lector

Decision: no hay preload/main para scanner en esta fase.

Rationale: el caso HID no lo necesita y no debe ampliar superficie nativa.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| El foco se mueve a otro control | Restaurar foco al input de busqueda despues de agregar. |
| Duplicados por catalogo | Requerir coincidencia exacta unica. |
| Productos pesables | Respetar flujo existente de peso/cantidad. |
| Sin stock | Respetar bloqueo ya existente del POS. |
| Electron empaquetado cambia foco/teclado | Validar en runtime de Windows. |

## Migration Plan

No hay migracion de datos ni cambios de infraestructura.

Pasos:

1. Documentar el estado actual.
2. Crear OpenSpec change.
3. Registrar evidencia QA documental.
4. Validar OpenSpec strict y diff limpio.

Rollback: borrar documentos y cambio OpenSpec. No hay codigo nativo que revertir.
