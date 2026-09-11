# Evidencia: normalización de medios de pago FactuCore

## Alcance

Cambio de código y pruebas locales únicamente. No se creó documento QA, no se modificó `SETP990000006` y no hubo llamadas a proveedor.

## Causa raíz

El evento de negocio de Manus conserva `CASH`, pero el mapper FactuCore lo copiaba sin traducir a `paymentMeansCode` y `paymentMeansId`. Esto produjo `CASH/CASH`, rechazado por DIAN en FAN02 y FAN03.

## Normalización

La frontera `FactuCoreMapper.buildBaseRequest()` aplica una normalización explícita antes de construir el DTO del proveedor:

| Valor de negocio | `paymentMeansCode` | `paymentMeansId` |
| --- | --- | --- |
| `CASH` | `10` | `1` |
| `10` ya normalizado | `10` | `1` |

El enum de negocio no cambia. Valores no mapeados fallan con `FactuCoreConfigurationError`; no existe fallback al valor crudo.

## Validación

- Prueba de `CASH`: confirma `10/1` y ausencia de `CASH` en ambos campos.
- Regresión de passthrough: confirma que `CASH/CASH` no puede llegar al DTO.
- Valor no mapeado: confirma fallo cerrado antes de construir la solicitud.
- Suite local de Billing: 142 pruebas, 142 exitosas.
- No se ejecutaron CREATE, XML en vivo, SIGN, TRANSMIT ni DIAN.

## Estado del documento rechazado

`SETP990000006` permanece inmutable: `REJECTED`, un intento de transmisión y un documento de proveedor. No se hizo reparación manual ni reintento.

## Siguiente paso

Una futura venta QA nueva puede prepararse después de validar también los demás requisitos fiscales. Esta evidencia no autoriza retransmitir el documento rechazado.
