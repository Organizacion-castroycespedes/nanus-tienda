## 1. Baseline y decisiones de contrato

- [ ] 1.1 Confirmar en código los contratos actuales de `saleType`, `measurementUnit`, terminal activa, `scaleDeviceId`, `enableScale`, modo y origen; verificar que no se creen entidades de producto nuevas.
- [ ] 1.2 Resolver y documentar el mecanismo existente de confianza local POS/Electron-Agent que vincula una captura con tenant, sucursal, terminal y operación; verificar con una prueba de rechazo de identidad no autorizada.
- [ ] 1.3 Resolver la política de override manual de peso y su permiso existente, o declarar que no está permitido; verificar que una entrada manual no se etiquete como captura REAL.
- [ ] 1.4 Decidir si la evidencia de captura viaja transitoriamente por `/sales` o requiere persistencia auditada; verificar atomicidad de venta, impuestos, inventario y facturación en ambos casos antes de implementar.
- [ ] 1.5 Elegir entre operación única abrir-leer-cerrar y sesión temporal acotada según latencia y UX; verificar que la opción elegida conserve timeout, dueño único, cancelación e invalidación.

## 2. Contrato de captura y terminal

- [ ] 2.1 Definir el contrato de captura REAL/ MOCK con fuente, unidad origen, kilogramos normalizados, timestamp, frescura, dispositivo, terminal, operación, identificador único y uso único; verificarlo con casos válidos e inválidos.
- [ ] 2.2 Implementar la resolución fail-closed de terminal sin balanza, balanza deshabilitada, dispositivo no autorizado, dispositivo ocupado, desconectado y error; verificar aislamiento por tenant, sucursal y terminal.
- [ ] 2.3 Incorporar configuración explícita de unidad ROCHI y procedimiento de verificación KG sin inferencia desde la trama; verificar rechazo de unidad desconocida, cambio de unidad y configuración inconsistente.
- [ ] 2.4 Definir TTL, cancelación, cierre, invalidación por error/desconexión y límite de concurrencia; verificar que no sobreviva una lectura usable después de cerrar o perder USB.

## 3. Peripheral Agent real

- [ ] 3.1 Adaptar `ScaleService` para seleccionar el driver ROCHI solo con configuración REAL autorizada y conservar el comportamiento MOCK explícito; verificar regresión de otros periféricos.
- [ ] 3.2 Reutilizar `DevicesService`, `DeviceType.SCALE`, eventos y transporte local existentes; verificar que el dispositivo, puerto/PnP y terminal correspondan a la configuración autorizada.
- [ ] 3.3 Implementar la operación o sesión bajo demanda elegida, con apertura, sincronización, lectura fresca, normalización KG y cierre seguro; verificar puerto ocupado, timeout, error, desconexión y liberación.
- [ ] 3.4 Impedir reconexión automática y doble dueño serial; verificar que una recuperación requiera una nueva acción explícita y que eventos tardíos no restauren lecturas.
- [ ] 3.5 Mantener separadas respuestas MOCK y REAL, retirar cualquier interpretación comercial de `stable` para ROCHI y etiquetar el origen; verificar que una respuesta MOCK no pase el gate REAL.

## 4. POS y modelo de venta existente

- [ ] 4.1 Adaptar `PosScreen` y `CartSaleModal` sin duplicar paneles, hooks o stores; verificar estados visibles `Sin balanza configurada`, `Balanza deshabilitada`, disponible, desconectada, error, unidad no verificada, pendiente, inválida y capturada.
- [ ] 4.2 Mantener `UNIT` operativo sin balanza y bloquear solo los controles que requieran peso; verificar venta normal en terminal sin dispositivo asignado.
- [ ] 4.3 Implementar elección explícita de unidad o peso para `BOTH`; verificar que cada elección use el flujo correcto y que cambiar de modo invalide una lectura previa.
- [ ] 4.4 Mantener la cantidad manual conforme a la política resuelta en 1.3; verificar que nunca se presente como lectura física si no existe autorización.
- [ ] 4.5 Reemplazar el uso comercial implícito de `mock-scale-001` por la configuración resuelta de terminal; verificar que el fallback MOCK solo aparezca en rutas autorizadas de desarrollo/QA.

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

## 7. QA físico y controles de salida

- [ ] 7.1 Ejecutar QA Windows controlado con ROCHI usando KG verificado, puerto/PnP autorizado, lectura bajo demanda, desconexión, invalidación y recuperación explícita; registrar evidencia sin declarar homologación.
- [ ] 7.2 Repetir pruebas con producto `WEIGHT` y `BOTH` en terminal configurada, y confirmar que `UNIT` funciona con balanza ausente; verificar correspondencia de pantalla y captura.
- [ ] 7.3 Verificar que Linux y empaquetado multiplataforma sigan separados de este change hasta completar la tarea 4.6 histórica; no marcarla desde este cambio.
- [ ] 7.4 Ejecutar suite relevante, build, validación OpenSpec y revisión de diff; verificar ausencia de cambios en POS no relacionados, parser ROCHI histórico, ventas unitarias y facturación.
- [ ] 7.5 Obtener aprobación independiente de negocio, seguridad y metrología antes de habilitar ventas ponderadas reales; verificar que el feature permanezca deshabilitado hasta esa aprobación.
