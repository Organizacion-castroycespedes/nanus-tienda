# Propuesta: soportar cajon monedero via impresora XP-80 LAN

## Resumen ejecutivo

Manus POS ya certifico la XP-80 LAN como impresora de red. La nueva fase no debe modelar el cajon monedero como un TCP device independiente. El cajon debe ser un recurso logico asociado a la impresora fisica que ya transporta el pulso ESC/POS.

## Problema actual

El backend `backend-perifericos` tiene `POST /cash-drawer/open`, pero hoy ese flujo sigue atado a `MockCashDrawerAdapter`. El resolver no tiene camino real para `CASH_DRAWER + NETWORK`, aunque la capa de impresora de red ya sabe enviar bytes ESC/POS crudos.

La consecuencia es esta:

```text
Cash drawer logico
  -> deviceType = CASH_DRAWER
  -> hoy solo MOCK

Printer fisica
  -> deviceType = PRINTER
  -> NETWORK ya certificado
  -> ya puede enviar bytes al puerto 9100
```

## Cambio propuesto

- Mantener `POST /cash-drawer/open`.
- Resolver el cajon por `printerDeviceId`, no por host/port propio.
- Reusar el transporte de la impresora asignada a la terminal.
- Enviar un solo pulso ESC/POS por request.
- Exponer respuesta operativa con `mode`, `adapterName`, `printerDeviceId`, `connectionType`, `network` y `bytesSent`.

## Impacto

- Afecta `backend-perifericos` y la pantalla administrativa de perifericos.
- Afecta tests de resolver, adapter y response shape.
- No toca el modelo de negocio de POS.
- No abre el cajon automatico por venta todavia.
