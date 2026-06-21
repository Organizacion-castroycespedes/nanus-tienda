# POS barcode HID Electron

Fecha: 2026-06-20
OpenSpec change: `validar-lector-barras-hid-pos-electron`

## Objetivo

Validar que un lector de codigo de barras en modo HID teclado funciona con Manus POS Web y Electron Windows sin integracion nativa de hardware.

El punto clave es simple: el lector escribe texto en el input del POS y cierra con Enter. Eso es teclado. No hay USB ni serial en esta fase.

## Alcance

- Revisar comportamiento actual del POS frente a codigo, SKU, barcode y referencia.
- Confirmar que el input de busqueda sirve para lectores HID.
- Confirmar que Enter solo auto-agrega en coincidencia exacta y unica.
- Confirmar que el foco vuelve al buscador para escaneos consecutivos.
- Documentar stock, peso y multiples coincidencias.
- Documentar que Web y Electron usan el mismo flujo.

## Fuera de alcance

- USB directo.
- Serial directo.
- SDKs de lector.
- Electron main/preload para scanner.
- Cambios de negocio en precios, stock, impuestos, descuentos, promociones o pagos.
- Caja, pedidos, facturacion, backend y SQL.
- Offline y sincronizacion.

## Por que HID es teclado

Un lector HID envía caracteres como si fuera un teclado. Por eso el POS no necesita conocer el dispositivo. Solo necesita un input enfocado y una regla segura para Enter.

## Comportamiento esperado en Web

- El usuario enfoca el buscador del POS.
- El lector escribe el codigo.
- El texto se filtra con el mismo mecanismo de busqueda existente.
- Si el Enter resuelve un match exacto unico, el producto puede agregarse con las reglas actuales del carrito.
- Si no hay match o hay varios, no se auto-agrega nada.

## Comportamiento esperado en Electron

- Electron solo contiene la app web.
- El lector HID sigue entrando como teclado dentro del renderer.
- No hace falta API nativa para este caso.
- El mismo flujo debe funcionar en la app empaquetada si el input tiene foco.

## Campos usados para coincidencia

La busqueda POS ya considera texto de producto y codigos scanner. En el helper actual se usan estos campos como candidatos:

- `primaryBarcode`
- `barcode`
- `codigoBarras`
- `codigo_barras`
- `sku`
- `reference`
- `referencia`
- `code`
- `codigo`
- `id`
- `barcodes[]`
- `barcodeCodes[]`

La coincidencia debe ser exacta y normalizada.

## Reglas de Enter

- Un solo match exacto puede agregar el producto.
- Multiples matches no deben auto-agregar.
- Sin match no debe auto-agregar.
- Si el producto ya esta en carrito, se mantiene la regla actual de incremento.

## Foco para escaneos consecutivos

Despues de agregar un producto por scanner, el foco debe regresar al buscador. Eso mantiene el flujo de escaneo continuo.

## Productos sin stock

El lector no debe saltarse la regla de stock del POS. Si el POS bloquea un producto sin stock, el escaneo debe respetar ese bloqueo.

## Productos pesables

Los productos pesables deben seguir su flujo existente. El lector HID no debe saltarse cantidad o peso cuando el producto requiere ese paso.

## Riesgos

- Foco perdido en otro control.
- Duplicados o codigos repetidos en catalogo.
- Codigo escaneado que coincide con varios productos.
- Error de stock o peso si se intenta saltar el flujo actual.
- Diferencias de comportamiento entre navegador y Electron por foco o timing.

## Fases futuras

- Soporte USB o serial si un cliente lo exige.
- API Electron estrecha para hardware nativo.
- Configuracion por terminal para scanner avanzado.
- Integracion con agentes locales si el negocio lo requiere.

## QA manual esperado

- Buscar un producto manualmente.
- Escribir un codigo valido y presionar Enter.
- Verificar match exacto unico.
- Verificar que multiples coincidencias no auto-agregan.
- Verificar que no hay match no auto-agrega.
- Verificar foco despues del agregado.
- Verificar Web y Electron empaquetado si hay ambiente disponible.
