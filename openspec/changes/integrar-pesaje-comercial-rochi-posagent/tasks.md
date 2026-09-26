## 1. Baseline y decisiones de contrato

- [x] 1.1 Confirmar en código los contratos actuales de `saleType`, `measurementUnit`, terminal activa, `scaleDeviceId`, `enableScale`, modo y origen; verificar que no se creen entidades de producto nuevas. Evidencia: `/pos-terminals/resolve-current` y `web/domains/peripherals/scale-visibility.ts`.
- [ ] 1.2 Implementar la autorización backend de corta duración vinculada a tenant, sucursal cuando aplique, terminal, sesión POS, producto, operación y dispositivo; verificar rechazo de identidad no autorizada y replay.
- [ ] 1.3 Aplicar la política aprobada: sin override manual para `WEIGHT` ni para el modo peso de `BOTH`; verificar que cantidad manual solo aplique a operaciones por unidad y nunca se etiquete como REAL.
- [ ] 1.4 Transportar evidencia transitoria con expiración y consumo único mediante el flujo comercial existente; verificar consumo atómico con venta, impuestos, inventario y facturación sin persistencia permanente inicial.
- [ ] 1.5 Implementar una sola operación abrir-leer-cerrar por pesaje; verificar timeout, cierre, dueño único, cancelación e invalidación. Dejar sesión temporal como evolución posterior.

## 2. Contrato de captura y terminal

- [ ] 2.1 Definir el contrato de captura REAL/ MOCK con fuente, unidad origen, kilogramos normalizados, timestamp, frescura, dispositivo, terminal, operación, identificador único y uso único; verificarlo con casos válidos e inválidos.
- [ ] 2.2 Implementar la resolución fail-closed de terminal sin balanza, balanza deshabilitada, dispositivo no autorizado, dispositivo ocupado, desconectado y error; verificar aislamiento por tenant, sucursal y terminal.
- [ ] 2.3 Incorporar configuración explícita de unidad ROCHI y procedimiento de verificación KG sin inferencia desde la trama; verificar rechazo de unidad desconocida, cambio de unidad y configuración inconsistente.
- [ ] 2.4 Definir TTL, cancelación, cierre, invalidación por error/desconexión y límite de concurrencia; verificar que no sobreviva una lectura usable después de cerrar o perder USB.
- [x] 2.5 Hacer que la configuración fallida o ausente sea estado seguro sin escala operativa; verificar que no active `FALLBACK_MOCK` para ventas ponderadas. Evidencia: `PosScreen` exige `source=CONFIGURED`, `scaleDeviceId` y `features.scale`.
- [ ] 2.6 Fase 2A documental: cerrar la matriz de identidad tenant--sucursal--terminal--instalación Agent--SCALE y sus restricciones de pertenencia. La relación propuesta está documentada; implementación y QA pendientes.
- [ ] 2.7 Fase 2A documental: definir la extensión aditiva de `resolve-current` para clasificación MOCK/REAL, autorización, estado físico y unidad KG sin tratar `CONFIGURED` como conexión. DTO y endpoint aún no se modifican.

## 3. Peripheral Agent real

- [ ] 3.1 Adaptar `ScaleService` para seleccionar el driver ROCHI solo con configuración REAL autorizada y conservar el comportamiento MOCK explícito; verificar regresión de otros periféricos.
- [ ] 3.2 Reutilizar `DevicesService`, `DeviceType.SCALE`, eventos y transporte local existentes; verificar que el dispositivo, puerto/PnP y terminal correspondan a la configuración autorizada.
- [ ] 3.3 Implementar la operación o sesión bajo demanda elegida, con apertura, sincronización, lectura fresca, normalización KG y cierre seguro; verificar puerto ocupado, timeout, error, desconexión y liberación.
- [ ] 3.4 Impedir reconexión automática y doble dueño serial; verificar que una recuperación requiera una nueva acción explícita y que eventos tardíos no restauren lecturas.
- [ ] 3.5 Mantener separadas respuestas MOCK y REAL, retirar cualquier interpretación comercial de `stable` para ROCHI y etiquetar el origen; verificar que una respuesta MOCK no pase el gate REAL.
- [ ] 3.6 Fase 2A documental: definir vinculación de instalación Agent con terminal y SCALE, prueba de identidad física y separación de COM/PnP local frente a asignación administrativa. Implementación pendiente.
- [ ] 3.7 Fase 2A documental: seleccionar mecanismo de autorización corta, revocación, replay y consumo único con los criterios de confianza existentes. No hay token ni consulta de captura implementados.

## 4. POS y modelo de venta existente

- [ ] 4.1 Adaptar `PosScreen` y `CartSaleModal` sin duplicar paneles, hooks o stores; verificar estados visibles `Sin balanza configurada`, `Balanza deshabilitada`, disponible, desconectada, error, unidad no verificada, pendiente, inválida y capturada.
- [x] 4.2 Mantener `UNIT` operativo sin balanza y bloquear solo los controles que requieran peso; verificar venta normal en terminal sin dispositivo asignado. Evidencia: el guard solo afecta acciones de pesaje; el agregado por unidad no depende de balanza.
- [x] 4.3 Implementar elección explícita de unidad o peso para `BOTH`; verificar que cada elección use el flujo correcto y que cancelar no modifique el carrito. Evidencia QA manual 6/6: modal visible, Unidad agrega una vez, Peso muestra aviso sin agregar ni leer MOCK, Cancelar conserva carrito, no aparece UI permanente MOCK y scanner también abre el selector. Fixture reportado: `Contra Muslo` `BOTH/KG`; registro DB no verificado.
- [ ] 4.4 Mantener la cantidad manual conforme a la política resuelta en 1.3; verificar que nunca se presente como lectura física si no existe autorización.
- [ ] 4.5 Reemplazar el uso comercial implícito de `mock-scale-001` por la configuración resuelta de terminal; verificar que el fallback MOCK solo aparezca en rutas autorizadas de desarrollo/QA.
- [x] 4.6 Ocultar completamente en `/pos` todo indicador, panel, peso vivo y control de balanza cuando la terminal no tenga dispositivo asignado y habilitado; verificar que solo exista aviso contextual al intentar pesar. Evidencia: `scaleUiVisible` es falso durante carga, error, `FALLBACK_MOCK`, falta de dispositivo, `features.scale=false` o el fixture documentado `mock-scale-001`.
- [ ] 4.7 Adaptar la UI para que `Balanza Lista/Listo` solo aparezca con configuración terminal REAL y estado Agent autorizado; verificar estados desconectada, error, unidad no verificada y lectura inválida. Pendiente: esta fase no conecta el Agent REAL ni implementa captura comercial.
- [ ] 4.8 Ejecutar aceptación con fixture `Contra Muslo` reportado como `BOTH/KG`; verificar unidad sin balanza, peso con ROCHI autorizado y bloqueo contextual sin balanza, sin cambiar sus datos.

## 5. Backend comercial

- [ ] 5.1 Validar en backend `saleType`, `measurementUnit`, cantidad y terminal activa para ventas ponderadas; verificar rechazo de combinaciones inválidas aunque la UI las permita.
- [ ] 5.2 Integrar la evidencia de captura con el flujo existente de pricing, impuestos, descuentos, inventario y `/sales`; verificar que no haya cálculo duplicado ni persistencia parcial.
- [ ] 5.3 Rechazar evidencia ausente, vencida, duplicada, MOCK no autorizado, de otra terminal, de otro producto u operación, o posterior a una revocación; verificar mensajes y rollback atómico.
- [ ] 5.4 Verificar compatibilidad con POS Electron, facturación electrónica y ventas unitarias; ejecutar regresión sobre los flujos existentes.

## 6. Simulador y pruebas automatizadas

- [ ] 6.1 Cubrir `UNIT`, `WEIGHT` y `BOTH`, incluyendo elección de modo, cantidades, precios, impuestos y stock; verificar escenarios de la especificación.
- [ ] 6.2 Cubrir terminal sin balanza, deshabilitada, disponible, ocupada, desconectada, con error y con configuración revocada; verificar estados de UI y rechazo seguro.
- [ ] 6.3 Cubrir KG verificado, unidad incorrecta, unidad ambigua, lectura stale, trama inválida, timeout, cierre, desconexión, reconexión explícita y eventos tardíos; verificar invalidación inmediata.
- [ ] 6.4 Cubrir duplicación, concurrencia, cambio de producto, cambio de terminal, cruce de tenant y reutilización de captura; verificar aislamiento y uso único.
- [ ] 6.5 Cubrir separación MOCK/REAL y compatibilidad del ScaleService existente; verificar que ninguna prueba de simulador habilite una venta REAL.
- [ ] 6.6 Cubrir visibilidad terminal sin balanza: ningún indicador permanente, ventas `UNIT` operativas y aviso contextual únicamente al intentar `WEIGHT` o peso de `BOTH`. Evidencia manual registrada; cobertura automatizada de componentes sigue pendiente.

### Evidencia QA Fase 1

- Terminal 1: respuesta observada por el operador con `source=CONFIGURED`, `scaleDeviceId=mock-scale-001` y `features.scale=true`.
- Fixture: `Contra Muslo` reportado como `saleType=BOTH` y `measurementUnit=KG`; no se modificó ni se verificó directamente en DB.
- Resultado manual: 6/6 PASS para apertura del selector, Unidad una vez, Peso contextual sin MOCK, Cancelar sin cambios, ausencia de UI permanente MOCK y selección desde scanner.
- Esta evidencia no cubre captura REAL, Agent, backend comercial, ventas productivas, hardware, Linux, empaquetado ni metrología.
- [ ] 6.7 Cubrir autorización corta, expiración, revocación, replay, evidencia duplicada y consumo único atómico.

## 7. QA físico y controles de salida

- [ ] 7.1 Ejecutar QA Windows controlado con ROCHI usando KG verificado, puerto/PnP autorizado, lectura bajo demanda, desconexión, invalidación y recuperación explícita; registrar evidencia sin declarar homologación.
- [ ] 7.2 Repetir pruebas con producto `WEIGHT` y `BOTH` en terminal configurada, y confirmar que `UNIT` funciona con balanza ausente; verificar correspondencia de pantalla y captura.
- [ ] 7.3 Verificar que Linux y empaquetado multiplataforma sigan separados de este change hasta completar la tarea 4.6 histórica; no marcarla desde este cambio.
- [ ] 7.4 Ejecutar suite relevante, build, validación OpenSpec y revisión de diff; verificar ausencia de cambios en POS no relacionados, parser ROCHI histórico, ventas unitarias y facturación.
- [ ] 7.5 Obtener aprobación independiente de negocio, seguridad y metrología antes de habilitar ventas ponderadas reales; verificar que el feature permanezca deshabilitado hasta esa aprobación.
