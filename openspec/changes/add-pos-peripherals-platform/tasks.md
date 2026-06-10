# Tasks: add-pos-peripherals-platform

## Fase 0 - OpenSpec

- [x] 1. Crear `openspec/changes/add-pos-peripherals-platform/proposal.md`.
- [x] 2. Crear `openspec/changes/add-pos-peripherals-platform/design.md`.
- [x] 3. Crear `openspec/changes/add-pos-peripherals-platform/tasks.md`.
- [x] 4. Crear `openspec/changes/add-pos-peripherals-platform/acceptance.md`.
- [x] 5. Crear `openspec/changes/add-pos-peripherals-platform/specs/peripherals/spec.md`.
- [x] 6. Ejecutar `openspec validate add-pos-peripherals-platform --type change --strict`.
- [x] 7. Ejecutar `git diff --check`.
- [x] 8. Confirmar `git status --short`.
- [x] 9. Confirmar que no se creo codigo funcional.
- [x] 10. Confirmar que no se crearon migraciones.
- [x] 11. Confirmar que no se tocaron `api/`, `web/`, `database/` ni `backend-reporteria/`.

## Fase 1 - Modelo conceptual y configuracion

- [ ] 1. Definir modelo fisico futuro para `pos_terminals`.
- [ ] 2. Definir modelo fisico futuro para `pos_devices`.
- [ ] 3. Definir modelo fisico futuro para `pos_device_assignments`.
- [ ] 4. Definir modelo fisico futuro para `pos_device_logs`.
- [ ] 5. Definir modelo fisico futuro para `pos_device_events`.
- [ ] 6. Definir modelo fisico futuro para `pos_peripheral_profiles`.
- [ ] 7. Definir estados permitidos de terminal: `ACTIVE`, `INACTIVE`, `ERROR`, `UNKNOWN`.
- [ ] 8. Definir estados permitidos de dispositivo: `CONNECTED`, `DISCONNECTED`, `ERROR`, `SIMULATED`.
- [ ] 9. Definir tipos de dispositivo: `PRINTER`, `CASH_DRAWER`, `SCALE`, `SCANNER`, `DISPLAY`, `OTHER`.
- [ ] 10. Definir tipos de conexion: `MOCK`, `USB`, `SERIAL`, `HID`, `NETWORK`, `BLUETOOTH`.
- [ ] 11. Definir configuracion local del agent y origen de parametros.
- [ ] 12. Definir estrategia de token local.
- [ ] 13. Definir retencion de logs tecnicos.
- [ ] 14. Confirmar que el Backend API principal conserva el negocio.

## Fase 2 - backend-perifericos MOCK/SIMULATOR

- [x] 1. Crear scaffolding futuro de `backend-perifericos` o `peripheral-agent`.
- [x] 2. Implementar `GET /health`.
- [x] 3. Implementar `GET /devices`.
- [x] 4. Implementar `POST /devices/discover` en modo simulador.
- [x] 5. Implementar `POST /devices` para registro local simulado.
- [x] 6. Implementar `PATCH /devices/:id` para actualizar configuracion simulada.
- [x] 7. Implementar simulador de impresora.
- [x] 8. Implementar simulador de caja registradora.
- [x] 9. Implementar simulador de balanza.
- [x] 10. Implementar simulador de scanner.
- [x] 11. Implementar `POST /printer/test-print` en modo simulador.
- [x] 12. Implementar `POST /cash-drawer/open` en modo simulador.
- [x] 13. Implementar `GET /scale/current-weight` en modo simulador.
- [x] 14. Implementar `POST /scanner/simulate`.
- [x] 15. Implementar `GET /logs`.
- [x] 16. Implementar WebSocket local con eventos mock.
- [x] 17. Agregar pruebas unitarias del modo simulador.
- [x] 18. Confirmar que no se requiere hardware real.

## Fase 2.1 - Hardening backend-perifericos MOCK/SIMULATOR

- [x] 1. Validar CORS local por `PERIPHERALS_ALLOWED_ORIGINS`.
- [x] 2. Permitir requests sin `Origin` para curl/Postman.
- [x] 3. Documentar comportamiento CORS local.
- [x] 4. Validar payload de `POST /devices`.
- [x] 5. Validar payload de `PATCH /devices/:id`.
- [x] 6. Validar payload de `POST /printer/test-print`.
- [x] 7. Validar payload de `POST /printer/print-ticket`.
- [x] 8. Validar payload de `POST /cash-drawer/open`.
- [x] 9. Validar payload de `POST /scanner/simulate`.
- [x] 10. Responder errores controlados para `deviceId` inexistente.
- [x] 11. Responder errores controlados para tipo de dispositivo incorrecto.
- [x] 12. Bloquear acciones operativas en dispositivos `DISCONNECTED` o `ERROR`.
- [x] 13. Registrar logs `WARN`/`ERROR` para rechazos operativos.
- [x] 14. Sanitizar responses de error sin stack traces.
- [x] 15. Confirmar logs en memoria con limite fijo/configurable.
- [x] 16. Fortalecer WebSocket para no tumbar proceso ante errores de socket.
- [x] 17. Ampliar pruebas automatizadas de endpoints, validaciones y errores.
- [x] 18. Actualizar `backend-perifericos/README.md`.
- [x] 19. Crear evidencia QA de Fase 2.1.
- [x] 20. Confirmar que no se agrego hardware real ni drivers.

## Fase 3 - integracion frontend con perifericos simulados

- [x] 1. Crear cliente frontend conceptual para HTTP local.
- [x] 2. Crear cliente frontend conceptual para WebSocket local.
- [x] 3. Detectar disponibilidad del agent local.
- [x] 4. Mostrar estado de salud del agent.
- [x] 5. Mostrar lista de dispositivos simulados.
- [x] 6. Permitir impresion de prueba simulada desde configuracion.
- [x] 7. Permitir apertura de caja simulada desde pantalla administrativa autorizable.
- [x] 8. Mostrar peso simulado en pantalla administrativa de diagnostico.
- [x] 9. Recibir lectura simulada de scanner y eventos WebSocket en pantalla administrativa.
- [x] 10. Mostrar logs tecnicos basicos.
- [x] 11. Agregar estados de error y desconexion.
- [x] 12. Verificar que la pantalla Web POS no se rompe cuando el agent local no esta disponible.

## Fase 3.1 - Menu/RBAC para Perifericos POS

- [x] 1. Analizar construccion actual del menu por `menu_items` y `role_menu_permissions`.
- [x] 2. Identificar proteccion frontend por `route-permissions` y `hasPermission`.
- [x] 3. Confirmar roles existentes: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y `USER`.
- [x] 4. Crear menu seed `POS_PERIPHERALS` bajo Configuracion.
- [x] 5. Crear permiso funcional `peripherals.manage` mediante modulo `peripherals` y accion `manage`.
- [x] 6. Asignar acceso a `SUPER_ADMIN`, `SUPER_USER` y `ADMIN`.
- [x] 7. Excluir `USER` de acceso por defecto.
- [x] 8. Agregar regla tenant-aware para `/[tenant]/admin/peripherals`.
- [x] 9. Agregar icono de menu sin instalar dependencias.
- [x] 10. Crear evidencia QA de Fase 3.1.

## Fase 3.2 - QA local/seed/menu end-to-end

- [x] 1. Revisar variables de entorno y DB local sin exponer credenciales.
- [x] 2. Ejecutar o validar seeds locales de menu y permisos.
- [x] 3. Confirmar `POS_PERIPHERALS` en `menu_items`.
- [x] 4. Confirmar ruta `/{tenant}/admin/peripherals` en DB local.
- [x] 5. Confirmar permisos DB para `SUPER_ADMIN`, `SUPER_USER` y `ADMIN`.
- [x] 6. Confirmar exclusion DB de `USER`.
- [x] 7. Validar API `/api/me/menu` y `/api/me/permissions` por rol autorizado.
- [x] 8. Validar API para que `USER` no reciba `POS_PERIPHERALS`.
- [x] 9. Validar ruta web HTTP de perifericos en ambiente local.
- [ ] 10. Validar visualmente sidebar/menu por rol en navegador autenticado.
- [x] 11. Validar backend-perifericos build, tests y smoke MOCK local.
- [x] 12. Validar build de `api/` y `web/`.
- [x] 13. Crear evidencia QA de Fase 3.2.
- [x] 14. Confirmar que no se uso hardware real, Electron ni Capacitor.

## Fase 4 - ESC/POS MOCK avanzado

- [x] 1. Crear capa interna de formato termico ESC/POS MOCK sin bytes reales.
- [x] 2. Definir comandos conceptuales `INIT`, `ALIGN_LEFT`, `ALIGN_CENTER`, `ALIGN_RIGHT`, `BOLD_ON`, `BOLD_OFF`, `DOUBLE_HEIGHT_ON`, `DOUBLE_HEIGHT_OFF`, `FEED`, `CUT` y `CASH_DRAWER_PULSE`.
- [x] 3. Generar preview textual 80mm para `POST /printer/test-print`.
- [x] 4. Generar preview textual para `POST /printer/print-ticket` con estructura de venta simulada.
- [x] 5. Retornar comandos conceptuales en responses de impresion.
- [x] 6. Simular apertura de caja con `CASH_DRAWER_PULSE` conceptual.
- [x] 7. Agregar configuracion `PERIPHERALS_PRINTER_WIDTH_CHARS`.
- [x] 8. Registrar logs tecnicos con `jobId`, `terminalId`, `deviceId`, `ticketType`, `commandCount` y `previewLength` sin guardar preview completo.
- [x] 9. Emitir eventos WebSocket de impresion sin preview completo.
- [x] 10. Agregar pruebas de preview, ancho, comandos, logs y cash drawer pulse.
- [x] 11. Actualizar `backend-perifericos/README.md`.
- [x] 12. Crear evidencia QA de Fase 4.
- [x] 13. Confirmar que no se uso hardware real, drivers reales, USB, serialport ni `node-escpos`.

## Fase 4.1 - Integrar preview ESC/POS MOCK en pantalla Web

- [x] 1. Actualizar tipos frontend para `PrintCommand`, `PrintJobResponse` y `CashDrawerResponse`.
- [x] 2. Actualizar cliente frontend para responses enriquecidas de `test-print`, `print-ticket` y `cash-drawer/open`.
- [x] 3. Agregar ticket demo SALE con negocio, documento, cajero, items, totales, pago y footer.
- [x] 4. Mostrar resultado de accion, `jobId` o `commandId`, modo MOCK, `deviceId` y `terminalId`.
- [x] 5. Mostrar preview textual monoespaciado para impresiones MOCK.
- [x] 6. Mostrar comandos conceptuales ESC/POS.
- [x] 7. Agregar boton para copiar preview.
- [x] 8. Agregar boton para limpiar resultado.
- [x] 9. Mostrar `CASH_DRAWER_PULSE` para apertura de caja simulada.
- [x] 10. Manejar errores sin borrar automaticamente el ultimo preview exitoso.
- [x] 11. Mantener WebSocket sin mostrar preview desde eventos.
- [x] 12. Crear evidencia QA de Fase 4.1.
- [x] 13. Confirmar que no se uso hardware real, drivers reales, Electron ni Capacitor.

## Fase 4.2 - Device Profiles y Print Adapters

- [x] 1. Crear contrato interno `PrinterAdapter`.
- [x] 2. Crear contrato interno `CashDrawerAdapter`.
- [x] 3. Crear contrato base `PeripheralAdapter` para capacidades.
- [x] 4. Crear `MockPrinterAdapter` sin bytes reales ni drivers.
- [x] 5. Crear `MockCashDrawerAdapter` sin apertura fisica.
- [x] 6. Crear `PeripheralAdapterResolver` para seleccion por `device.type`, `connectionType` y modo.
- [x] 7. Crear profiles `THERMAL_80MM`, `THERMAL_58MM` y `GENERIC_TEXT`.
- [x] 8. Asignar `profileId` a dispositivos MOCK compatibles.
- [x] 9. Mantener compatibilidad externa de `POST /printer/test-print`.
- [x] 10. Mantener compatibilidad externa de `POST /printer/print-ticket`.
- [x] 11. Mantener compatibilidad externa de `POST /cash-drawer/open`.
- [x] 12. Retornar `profile` y `capabilities` en responses enriquecidas sin romper web.
- [x] 13. Responder error controlado para adapters reales no implementados.
- [x] 14. Registrar logs con `profileId`, `adapterName`, `commandCount` y `previewLength` sin guardar preview completo.
- [x] 15. Agregar pruebas de profiles, adapters, resolver y contrato HTTP existente.
- [x] 16. Actualizar `backend-perifericos/README.md`.
- [x] 17. Crear evidencia QA de Fase 4.2.
- [x] 18. Confirmar que no se uso hardware real, drivers reales, Electron ni Capacitor.

## Fase 4.3 - Validacion Web de profiles/adapters

- [x] 1. Actualizar tipos frontend para `DeviceProfile`, `PeripheralCapabilities` y metadata de resultado.
- [x] 2. Agregar `profileId` y `profile` al tipo de dispositivo frontend.
- [x] 3. Mostrar `profileId` en listado de dispositivos.
- [x] 4. Mostrar `connectionType` como badge visual.
- [x] 5. Mostrar `adapterName` en resultados de impresion y caja.
- [x] 6. Mostrar `profile.id`, `profile.paperWidthMm` y `profile.widthChars`.
- [x] 7. Mostrar `capabilities.supportsCut` y `capabilities.supportsCashDrawerPulse`.
- [x] 8. Mostrar `commandCount` calculado o retornado por backend.
- [x] 9. Mantener preview monoespaciado, comandos, copy preview y clear result.
- [x] 10. Mantener logs, WebSocket events, health, scanner y scale sin cambios funcionales.
- [x] 11. Crear evidencia QA de Fase 4.3.
- [x] 12. Confirmar que no se uso hardware real, drivers reales, Electron ni Capacitor.

## Fase 5 - Impresion real NETWORK ESC/POS controlada con feature flag

- [x] 1. Agregar feature flag `PERIPHERALS_ENABLE_REAL_ADAPTERS=false` por defecto.
- [x] 2. Mantener `PERIPHERALS_MODE=MOCK` como modo por defecto.
- [x] 3. Crear `NetworkEscposPrinterAdapter` para `NETWORK + PRINTER`.
- [x] 4. Convertir preview y comandos conceptuales minimos a bytes ESC/POS basicos sin `node-escpos`.
- [x] 5. Enviar bytes por TCP socket solo cuando el feature flag real esta activo.
- [x] 6. Bloquear `NETWORK`, `USB`, `SERIAL`, `HID` y otros adapters reales cuando el feature flag esta apagado.
- [x] 7. Mantener `MockPrinterAdapter` y `MockCashDrawerAdapter` como comportamiento default.
- [x] 8. Extender modelo in-memory de dispositivos con `network.host`, `network.port` y `network.timeoutMs`.
- [x] 9. Validar `host`, `port`, `timeoutMs` y bloquear destinos loopback para impresora de red.
- [x] 10. Mantener `POST /printer/test-print` y `POST /printer/print-ticket` compatibles con responses enriquecidas.
- [x] 11. Agregar pruebas unitarias con socket mock sin hardware real.
- [x] 12. Validar smoke MOCK sin flag real.
- [x] 13. Validar error controlado para impresora `NETWORK` con flag real apagado.
- [x] 14. Actualizar `backend-perifericos/README.md`.
- [x] 15. Crear evidencia QA de Fase 5.
- [x] 16. Confirmar que no se uso USB, serialport, HID, Electron, Capacitor ni `node-escpos`.
- [x] 17. Confirmar que no se tocaron `api/`, `database/`, `backend-reporteria/`, ventas, inventario, caja, compras ni facturacion.

## Fase 5.1 - UI para registrar impresora NETWORK y probar feature flag disabled

- [x] 1. Actualizar tipos web para `DeviceNetworkConfig`, `PeripheralDevice.network` y `CreateDeviceRequest`.
- [x] 2. Exponer `createDevice` en `web/domains/peripherals/api.ts`.
- [x] 3. Crear panel `NetworkPrinterRegistrationPanel` en pantalla de perifericos.
- [x] 4. Agregar formulario compacto con defaults para impresora `NETWORK + PRINTER`.
- [x] 5. Validar en frontend `id`, `name`, `host`, `port` y `timeoutMs`.
- [x] 6. Registrar device temporal con `POST /devices`.
- [x] 7. Refrescar `GET /devices` luego de registrar.
- [x] 8. Mostrar device `NETWORK` con badge, `profileId` y `host:port`.
- [x] 9. Permitir `Imprimir prueba` sobre device `NETWORK`.
- [x] 10. Mostrar error controlado cuando `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.
- [x] 11. Mostrar explicacion de seguridad para adapter real desactivado.
- [x] 12. Mantener ultimo preview MOCK exitoso si NETWORK falla.
- [x] 13. Mantener acciones MOCK funcionando en pantalla.
- [x] 14. Validar smoke local con backend-perifericos defaults y web dev.
- [x] 15. Validar build web.
- [x] 16. Validar backend-perifericos build/test.
- [x] 17. Crear evidencia QA de Fase 5.1.
- [x] 18. Confirmar que no se uso hardware real, drivers, USB, serialport, HID, Electron ni Capacitor.
- [x] 19. Confirmar que no se tocaron `api/`, `database/`, `backend-reporteria/` ni core negocio.

## Fase 6 - Contratos funcionales POS - Perifericos

- [x] 1. Analizar arquitectura existente de `web/domains/peripherals`.
- [x] 2. Revisar OpenSpec y tareas pendientes antes de implementar.
- [x] 3. Crear tipos `SaleTicketInput`, `PurchaseTicketInput` y `OrderTicketInput`.
- [x] 4. Crear tipos `CashDrawerOpenInput`, `ScaleReadResult` y `ScannerReadResult`.
- [x] 5. Crear tipos `PeripheralOperationResult`, `PeripheralOperationError` y `PeripheralFeatureFlags`.
- [x] 6. Crear builder `buildSaleTicketPayload(sale)`.
- [x] 7. Crear builder `buildPurchaseTicketPayload(purchase)`.
- [x] 8. Crear builder `buildOrderTicketPayload(order)`.
- [x] 9. Crear contrato `getPeripheralAgentHealth()`.
- [x] 10. Crear contrato `getPeripheralDevices()`.
- [x] 11. Crear contrato `printSaleTicket(input)`.
- [x] 12. Crear contrato `printPurchaseTicket(input)`.
- [x] 13. Crear contrato `printOrderTicket(input)`.
- [x] 14. Crear contrato `openCashDrawer(input)`.
- [x] 15. Crear contrato `readCurrentWeight(input?)`.
- [x] 16. Crear contrato `simulateScannerRead(input)`.
- [x] 17. Crear contrato `subscribeScannerEvents(callback)`.
- [x] 18. Crear contrato `subscribePeripheralEvents(callback)`.
- [x] 19. Agregar feature flags frontend en `web/.env.example`.
- [x] 20. Manejar agent offline con error controlado sin romper flujo de negocio.
- [x] 21. Reutilizar `web/domains/peripherals/api.ts` sin duplicar logica HTTP.
- [x] 22. Mantener compatibilidad con `/admin/peripherals`, preview MOCK y registro NETWORK.
- [x] 23. Documentar contratos en README de `web/domains/peripherals`.
- [x] 24. Crear evidencia QA de Fase 6.
- [x] 25. Validar build web.
- [x] 26. Validar build/test de `backend-perifericos`.
- [x] 27. Validar OpenSpec y `git diff --check`.
- [x] 28. Confirmar que no se integro ventas, compras ni pedidos reales.
- [x] 29. Confirmar que no se uso hardware real, Electron ni Capacitor.
- [x] 30. Confirmar que no se tocaron `api/`, `database/`, `backend-reporteria/` ni core negocio.

## Fase 7 - Ventas MOCK

- [x] 1. Identificar flujo de confirmacion de venta en `web/modules/pos/components/PosScreen.tsx`.
- [x] 2. Confirmar que `createSale()` persiste la venta antes de ejecutar perifericos.
- [x] 3. Identificar datos disponibles para ticket: cliente, cajero, items, totales y pagos.
- [x] 4. Identificar pagos en efectivo por `PaymentMethod.tipo === "CASH"`.
- [x] 5. Crear helper `pos-sale-integration.ts` para aislar perifericos del POS.
- [x] 6. Construir `SaleTicketInput` desde snapshot de venta confirmada.
- [x] 7. Usar `buildSaleTicketPayload()` para validar payload de ticket.
- [x] 8. Usar `printSaleTicket(input)` despues de `createSale()` exitoso.
- [x] 9. Usar `openCashDrawer(input)` con reason `SALE_CASH_PAYMENT`.
- [x] 10. Abrir caja solo si existe pago efectivo.
- [x] 11. Respetar `NEXT_PUBLIC_PERIPHERALS_ENABLED`.
- [x] 12. Respetar `NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED`.
- [x] 13. Respetar `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED`.
- [x] 14. Mostrar feedback no bloqueante mediante toast existente.
- [x] 15. Manejar agent offline sin revertir venta ni mostrar stack traces.
- [x] 16. Mantener venta, inventario, facturacion y reglas fiscales sin cambios.
- [x] 17. Validar build web.
- [x] 18. Validar build/test de `backend-perifericos`.
- [x] 19. Crear evidencia QA de Fase 7.
- [x] 20. Confirmar que no se uso hardware real, Electron ni Capacitor.
- [x] 21. Confirmar que no se tocaron `database/`, `backend-reporteria/` ni backend API principal.

## Fase 8 - Compras MOCK

- [x] 1. Identificar flujo de creacion de compra en `web/modules/inventory/components/PurchaseForm.tsx`.
- [x] 2. Confirmar que `createPurchase()` persiste la compra antes de ejecutar perifericos.
- [x] 3. Identificar ruta principal `/[tenant]/inventory/purchases` como reexport de `/[tenant]/purchases`.
- [x] 4. Identificar pago inmediato de compra por `PurchaseResponse.type === "CASH"` y `totalPaid > 0`.
- [x] 5. Identificar egreso efectivo posterior por `PaymentMethod.tipo === "CASH"` en `DocumentPaymentForm`.
- [x] 6. Crear helper `purchase-integration.ts` para aislar perifericos de compras.
- [x] 7. Construir `PurchaseTicketInput` desde la compra guardada y los items del formulario.
- [x] 8. Usar `buildPurchaseTicketPayload()` para validar payload de ticket.
- [x] 9. Usar `printPurchaseTicket(input)` despues de `createPurchase()` exitoso.
- [x] 10. Usar `openCashDrawer(input)` con reason `PURCHASE_CASH_PAYMENT`.
- [x] 11. Abrir caja solo si existe pago o egreso efectivo.
- [x] 12. No abrir caja en compras `CREDIT`, pagos no efectivo o compras sin pago inmediato.
- [x] 13. Extender `DocumentPaymentForm` para devolver metadata segura de pagos creados.
- [x] 14. Mostrar feedback no bloqueante mediante `useNoticeDialog`.
- [x] 15. Manejar agent offline sin revertir compra ni mostrar stack traces.
- [x] 16. Respetar `NEXT_PUBLIC_PERIPHERALS_ENABLED`.
- [x] 17. Respetar `NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED`.
- [x] 18. Respetar `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED`.
- [x] 19. Mantener compras, inventario, proveedores y reglas contables sin cambios.
- [x] 20. Validar build web.
- [x] 21. Validar build/test de `backend-perifericos`.
- [x] 22. Crear evidencia QA de Fase 8.
- [x] 23. Confirmar que no se uso hardware real, Electron ni Capacitor.
- [x] 24. Confirmar que no se tocaron `api/`, `database/`, `backend-reporteria/` ni core negocio.

## Fase 9 - Pedidos / Orders MOCK

- [x] 1. Identificar flujo de pedidos en `web/app/[tenant]/orders/page.tsx`.
- [x] 2. Identificar creacion/edicion de pedido en `web/modules/inventory/components/OrderForm.tsx`.
- [x] 3. Confirmar que `createOrder()` y `updateOrder()` persisten antes de ejecutar perifericos.
- [x] 4. Identificar entrega de pedido en `web/modules/inventory/components/OrderDeliverForm.tsx`.
- [x] 5. Confirmar que `deliverOrder()` persiste antes de ejecutar perifericos.
- [x] 6. Identificar abonos de pedido por `DocumentPaymentForm` con `referenceType="SALES_ORDER"`.
- [x] 7. Identificar pago efectivo por `PaymentMethod.tipo === "CASH"`.
- [x] 8. Crear helper `order-integration.ts` para aislar perifericos de pedidos.
- [x] 9. Construir `OrderTicketInput` desde pedido guardado, items, total, estado y pagos.
- [x] 10. Usar `buildOrderTicketPayload()` para validar payload de ticket.
- [x] 11. Usar `printOrderTicket(input)` despues de pedido exitoso.
- [x] 12. Usar `openCashDrawer(input)` con reason `ORDER_CASH_PAYMENT`.
- [x] 13. Abrir caja solo si existe pago efectivo nuevo.
- [x] 14. No abrir caja en pedido pendiente sin pago, pago no efectivo, pedido cancelado o fallido.
- [x] 15. Mostrar feedback no bloqueante mediante toast existente.
- [x] 16. Manejar agent offline sin revertir pedido ni mostrar stack traces.
- [x] 17. Respetar `NEXT_PUBLIC_PERIPHERALS_ENABLED`.
- [x] 18. Respetar `NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED`.
- [x] 19. Respetar `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED`.
- [x] 20. Mantener pedidos, inventario, reglas contables y facturacion electronica sin cambios.
- [x] 21. Validar build web.
- [x] 22. Validar build/test de `backend-perifericos`.
- [x] 23. Crear evidencia QA de Fase 9.
- [x] 24. Confirmar que no se uso hardware real, Electron ni Capacitor.
- [x] 25. Confirmar que no se tocaron `api/`, `database/`, `backend-reporteria/` ni core negocio.

## Fase 10 - Scanner MOCK

- [x] 1. Identificar flujo POS en `web/modules/pos/components/PosScreen.tsx`.
- [x] 2. Confirmar que catalogo POS carga productos con `getPosProducts(activeBranchId)`.
- [x] 3. Confirmar que el carrito usa `addToCart(product)` y se reutiliza para scanner.
- [x] 4. Integrar lectura QR MOCK al POS mediante eventos `scanner.code.read`.
- [x] 5. Integrar lectura codigo de barras MOCK al POS mediante eventos `scanner.code.read`.
- [x] 6. Consumir `subscribeScannerEvents(callback)` desde contratos web.
- [x] 7. Respetar `NEXT_PUBLIC_PERIPHERALS_ENABLED`.
- [x] 8. Respetar `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED`.
- [x] 9. No abrir WebSocket scanner cuando feature flags estan desactivadas.
- [x] 10. Buscar producto por `barcode`, `codigoBarras`, `sku`, `reference`, `code`, `id` o `barcodes[]` si existen.
- [x] 11. Agregar producto encontrado usando la logica existente de carrito.
- [x] 12. Mostrar warning controlado cuando el codigo no existe.
- [x] 13. Agregar panel `Scanner MOCK/SIMULATOR` para llamar `simulateScannerRead(input)`.
- [x] 14. Manejar agent offline sin romper POS ni mostrar stack traces.
- [x] 15. Cerrar suscripcion WebSocket al desmontar POS.
- [x] 16. Mantener ventas, inventario core y facturacion sin cambios.
- [x] 17. Validar build web.
- [x] 18. Validar build/test de `backend-perifericos`.
- [x] 19. Crear evidencia QA de Fase 10.
- [x] 20. Confirmar OpenSpec validate y `git diff --check`.
- [x] 21. Confirmar que no se uso hardware real, USB/HID, drivers, Electron ni Capacitor.
- [x] 22. Ajustar caso especifico `code=46564567` con default en simulador POS.
- [x] 23. Confirmar que scanner MOCK solo afecta carrito mientras `PosScreen` esta montado.
- [x] 24. Documentar comportamiento fuera de POS.

## Fase 10.1 - Catalogo POS con codigos de barras

- [x] 1. Analizar modelo `product_barcodes` con `barcode`, `is_primary` e `is_active`.
- [x] 2. Confirmar endpoint existente `/products/:productId/barcodes`.
- [x] 3. Identificar causa raiz: `GET /products?branchId=...` no incluia codigos de barras.
- [x] 4. Agregar consulta agregada de codigos activos por `productIds` sin N+1.
- [x] 5. Enriquecer `ProductService.listProducts()` con `primaryBarcode`.
- [x] 6. Enriquecer `ProductService.listProducts()` con `barcodeCodes`.
- [x] 7. Enriquecer `ProductService.listProducts()` con objetos `barcodes[]`.
- [x] 8. Filtrar codigos inactivos.
- [x] 9. Mantener productos sin codigos con arrays vacios y `primaryBarcode=null`.
- [x] 10. Actualizar tipos frontend `ProductResponse`.
- [x] 11. Actualizar matcher POS para `primaryBarcode`, `barcodeCodes`, `barcodes[]` y aliases existentes.
- [x] 12. Agregar tests API de catalogo con codigos activos.
- [x] 13. Agregar test API de codigos inactivos omitidos.
- [x] 14. Agregar test API para productos sin codigos.
- [x] 15. Confirmar que `code=46564567` ahora puede matchear en POS si llega en catalogo y hay stock.
- [x] 16. Documentar diferencia entre producto no encontrado y producto encontrado sin stock.
- [x] 17. Validar build/test de `api`.
- [x] 18. Validar build web.
- [x] 19. Validar build/test de `backend-perifericos`.
- [x] 20. Confirmar OpenSpec validate y `git diff --check`.
- [x] 21. Confirmar que no se crearon migraciones ni cambios de persistencia.
- [x] 22. Confirmar que no se uso hardware real, USB/HID, drivers, Electron ni Capacitor.

## Fase 11 - Balanza MOCK

- [x] 1. Integrar lectura de peso MOCK al POS.
- [x] 2. Preparar soporte UI para productos pesables.
- [x] 3. Consumir `readCurrentWeight(input?)` desde contratos web.
- [x] 4. Crear evidencia QA de Fase 11.

## Fase 11.1 - Modelo formal de productos pesables

- [x] 1. Analizar modelo actual de productos en API, Web y SQL.
- [x] 2. Crear modelo formal `saleType` con valores `UNIT`, `WEIGHT` y `BOTH`.
- [x] 3. Crear modelo formal `measurementUnit` con valores `UND`, `KG`, `LB`, `G` y `OZ`.
- [x] 4. Agregar migracion SQL idempotente para `products.sale_type` y `products.measurement_unit`.
- [x] 5. Mantener defaults compatibles `UNIT` y `UND` para productos existentes.
- [x] 6. Validar reglas `UNIT/UND` y `WEIGHT|BOTH/KG|LB|G|OZ` en API.
- [x] 7. Exponer `saleType` y `measurementUnit` en catalogo `GET /products?branchId=...`.
- [x] 8. Actualizar tipos y formulario Web de productos.
- [x] 9. Mostrar modelo de venta en listado Web de productos.
- [x] 10. Actualizar POS para preferir `saleType` formal sobre inferencias.
- [x] 11. Mantener fallback legacy solo cuando `saleType` no exista.
- [x] 12. Validar build/test de `api`, build de `web` y build/test de `backend-perifericos`.
- [x] 13. Crear evidencia QA de Fase 11.1.
- [x] 14. Confirmar que no se uso hardware real, USB, serialport, drivers, Electron ni Capacitor.

## Fase 11.2 - QA formulario productos pesables

- [x] 1. Validar que el formulario de creacion de productos expone `Modelo de venta` y `Unidad comercial`.
- [x] 2. Validar defaults compatibles `saleType=UNIT` y `measurementUnit=UND`.
- [x] 3. Validar caso QA crear producto unitario `UNIT/UND`.
- [x] 4. Validar caso QA crear producto pesable `WEIGHT/KG`.
- [x] 5. Validar caso QA crear producto mixto `BOTH/KG`.
- [x] 6. Validar caso QA editar producto `UNIT/UND` a `WEIGHT/KG`.
- [x] 7. Confirmar que API create/update/get/list persiste y devuelve `saleType` y `measurementUnit`.
- [x] 8. Confirmar que `GET /products?branchId=...` entrega los campos al catalogo POS.
- [x] 9. Confirmar que POS usa `saleType` como fuente principal para producto pesable.
- [x] 10. Agregar cobertura QA automatizada para create/get/list/update de modelo formal.
- [x] 11. Validar build/test de `api`, build de `web` y build/test de `backend-perifericos`.
- [x] 12. Confirmar OpenSpec validate y `git diff --check`.
- [x] 13. Crear evidencia QA de Fase 11.2.
- [x] 14. Confirmar que no se uso hardware real, USB, serialport, HID, drivers, Electron ni Capacitor.

## Fase 12 - Configuracion operativa

- [x] 1. Crear migracion `V054__pos_terminal_peripheral_settings_phase_12.sql`.
- [x] 2. Crear tabla `pos_terminals` tenant-aware y branch-aware.
- [x] 3. Crear tabla `pos_terminal_peripheral_settings` por terminal POS.
- [x] 4. Agregar constraints, indices y triggers `updated_at`.
- [x] 5. Sembrar terminal MOCK local solo para tenant/sucursal local segura si existe.
- [x] 6. Crear modulo API `pos-terminals`.
- [x] 7. Implementar CRUD de terminal POS.
- [x] 8. Implementar lectura/escritura de settings de perifericos por terminal.
- [x] 9. Implementar resolve-current con fallback MOCK seguro.
- [x] 10. Agregar pruebas API de create/update/list/get/settings/fallback.
- [x] 11. Actualizar contratos frontend para resolver terminal antes de comandos.
- [x] 12. Combinar feature flags frontend con settings por terminal.
- [x] 13. Actualizar `/[tenant]/admin/peripherals` con panel `Terminal POS`.
- [x] 14. Mantener fallback `local-terminal` y `mock-*` cuando API config no esta disponible.
- [x] 15. Validar build/test de `api`, build de `web` y build/test de `backend-perifericos`.
- [x] 16. Confirmar OpenSpec validate y `git diff --check`.
- [x] 17. Crear evidencia QA de Fase 12.
- [x] 18. Confirmar que no se uso hardware real, drivers, USB, serial, HID, Electron ni Capacitor.

## Fase 12.1 - QA Operativo Integral

- [x] 1. Aplicar/validar migraciones V053 y V054 en ambiente local/QA.
- [x] 2. Validar `backend-perifericos` MOCK con `GET /health`, `GET /devices` y `GET /logs`.
- [x] 3. Validar configuracion terminal resuelta con printer, cash drawer, scale y scanner MOCK.
- [x] 4. Validar tickets MOCK, caja MOCK, profiles y adapters desde endpoints del agent.
- [x] 5. Validar scanner MOCK con `code=46564567` y codigo inexistente `99999999`.
- [x] 6. Validar balanza MOCK con lectura estable `1.25 kg`.
- [x] 7. Validar catalogo POS con `primaryBarcode`, `barcodeCodes`, `saleType` y `measurementUnit`.
- [x] 8. Validar WebSocket local con evento `scanner.code.read`.
- [x] 9. Validar bloqueo controlado de impresora `NETWORK` con adapters reales desactivados.
- [x] 10. Validar RBAC de `POS_PERIPHERALS` para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y exclusion de `USER`.
- [x] 11. Corregir bug menor encontrado: `subscribeScannerEvents()` no respetaba `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED=false`.
- [x] 12. Validar agent offline con error controlado `AGENT_OFFLINE`.
- [x] 13. Validar build/test de `api`, build de `web` y build/test de `backend-perifericos`.
- [x] 14. Confirmar OpenSpec validate y `git diff --check`.
- [x] 15. Crear evidencia QA de Fase 12.1.
- [x] 16. Confirmar que no se uso hardware real, drivers, USB, serial, HID, Electron ni Capacitor.

## Fase 12.2 - QA Manual Autenticado

- [x] 1. Validar migraciones V053 y V054 aplicadas en ambiente local/QA.
- [x] 2. Levantar/verificar API, Web y `backend-perifericos` MOCK.
- [x] 3. Validar login autenticado para `SUPER_ADMIN`, `ADMIN` y `USER` sin exponer tokens.
- [x] 4. Validar terminal configurada con printer, cash drawer, scale y scanner MOCK.
- [x] 5. Validar rutas HTTP `/pos` y `/admin/peripherals`.
- [x] 6. Validar contratos de venta efectivo y no efectivo contra agent MOCK.
- [x] 7. Validar contratos de compra efectivo y credito/sin pago contra agent MOCK.
- [x] 8. Validar contratos de pedido con abono efectivo y sin abono contra agent MOCK.
- [x] 9. Validar scanner MOCK con `46564567` y `99999999`.
- [x] 10. Validar balanza MOCK con lectura estable `1.25 kg`.
- [x] 11. Validar RBAC de `POS_PERIPHERALS` para roles autorizados y exclusion de `USER`.
- [x] 12. Validar fallback MOCK y agent offline por contratos frontend.
- [x] 13. Validar `NETWORK` con adapters reales desactivados sin activar feature flag real.
- [ ] 14. Ejecutar click a click los casos QA-01 a QA-14 en navegador autenticado (bloqueado por herramienta Browser no disponible en esta sesion).
- [x] 15. Crear evidencia QA de Fase 12.2 con limitacion documentada.
- [ ] 16. Cerrar Fase 12.2 como completa cuando exista validacion visual autenticada en navegador real.

## Fase 12.3 - Pre-merge Stabilization

- [x] 1. Validar rama actual y estado Git con `git status --short`.
- [x] 2. Validar formato con `git diff --check`.
- [x] 3. Validar OpenSpec con `openspec validate add-pos-peripherals-platform --type change --strict`.
- [x] 4. Revisar coherencia de proposal, design, spec y tasks.
- [x] 5. Confirmar que Fase 12.2 queda parcial por falta de navegador autenticado click-by-click.
- [x] 6. Revisar migracion V053 de modelo formal de productos pesables.
- [x] 7. Revisar migracion V054 de configuracion por terminal POS.
- [x] 8. Validar migraciones V053/V054 aplicadas en DB local/QA.
- [x] 9. Validar build de `api`.
- [x] 10. Validar tests de `api`.
- [x] 11. Validar build de `web`.
- [x] 12. Confirmar que `web` no tiene script `test`.
- [x] 13. Validar build de `backend-perifericos`.
- [x] 14. Validar tests de `backend-perifericos`.
- [x] 15. Validar smoke MOCK de `backend-perifericos` con health/devices/logs.
- [x] 16. Revisar fallback MOCK de terminal y devices.
- [x] 17. Validar agent offline con error controlado.
- [x] 18. Revisar feature flags frontend en `web/.env.example`.
- [x] 19. Revisar feature flags y README de `backend-perifericos`.
- [x] 20. Revisar evidencias QA principales.
- [x] 21. Revisar que evidencias QA no contengan tokens ni credenciales reales.
- [x] 22. Crear evidencia QA de Fase 12.3.
- [x] 23. Emitir recomendacion `MERGE_READY`.
- [x] 24. Confirmar que no se uso hardware real, drivers, USB, serial, HID, Electron ni Capacitor.
- [x] 25. Confirmar que no se hizo commit, merge ni avance a Fase 13.

## Fase 13 - Runbook impresion real NETWORK

- [ ] 1. Documentar prerequisitos de impresora NETWORK.
- [ ] 2. Documentar feature flags y retorno a MOCK.
- [ ] 3. Documentar smoke seguro sin hardware real.
- [ ] 4. Crear evidencia QA de Fase 13.

## Fase 14 - Prueba real controlada NETWORK

- [ ] 1. Ejecutar prueba real solo con aprobacion humana explicita.
- [ ] 2. Habilitar `PERIPHERALS_ENABLE_REAL_ADAPTERS=true` solo durante la prueba autorizada.
- [ ] 3. Registrar evidencia sanitizada.
- [ ] 4. Volver a `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.

## Fase 15 - Caja registradora real

- [ ] 1. Definir estrategia de caja registradora real.
- [ ] 2. Evaluar apertura via impresora ESC/POS pulse.
- [ ] 3. Mantener feature flag para adapters reales.
- [ ] 4. Crear evidencia QA de Fase 15.

## Fase 16 - Balanza real

- [ ] 1. Evaluar integracion futura con `serialport`.
- [ ] 2. Definir perfil de balanza.
- [ ] 3. Definir protocolo de lectura de peso.
- [ ] 4. Definir `GET /scale/current-weight`.
- [ ] 5. Definir evento `scale.weight.changed`.
- [ ] 6. Definir tolerancia, unidad y precision.
- [ ] 7. Definir manejo de peso estable/inestable.
- [ ] 8. Definir errores de puerto ocupado o desconectado.
- [ ] 9. Agregar simulador de cambios de peso.
- [ ] 10. Documentar limites por modelo de balanza.

## Fase 17 - Scanner real

- [ ] 1. Definir soporte para scanner HID keyboard.
- [ ] 2. Definir soporte para scanner serial/USB si aplica.
- [ ] 3. Definir evento `scanner.code.read`.
- [ ] 4. Definir `POST /scanner/simulate`.
- [ ] 5. Definir normalizacion de codigos leidos.
- [ ] 6. Definir manejo de QR y codigo de barras lineal.
- [ ] 7. Definir debounce y lectura completa.
- [ ] 8. Definir errores o lecturas invalidas.
- [ ] 9. Integrar lectura con busqueda de producto en POS.
- [ ] 10. Probar flujo sin hardware mediante simulador.

## Fase 18 - Electron Desktop POS

- [ ] 1. Definir estrategia de ejecucion Desktop POS.
- [ ] 2. Decidir si Electron arranca el agent como proceso hijo o detecta servicio externo.
- [ ] 3. Definir instalador y actualizacion futura.
- [ ] 4. Definir configuracion de puerto local.
- [ ] 5. Definir seguridad IPC si aplica.
- [ ] 6. Definir permisos OS requeridos.
- [ ] 7. Definir monitoreo de agent desde Electron.
- [ ] 8. Definir fallback cuando agent no inicia.
- [ ] 9. Ejecutar pruebas de escritorio con simulador.
- [ ] 10. Documentar soporte por Windows primero si se aprueba.

## Fase 19 - Capacitor Android POS

- [ ] 1. Identificar casos de uso Android POS: tablets, meseros, preventistas y terminales POS Android.
- [ ] 2. Evaluar plugins Capacitor para USB.
- [ ] 3. Evaluar plugins Capacitor para serial.
- [ ] 4. Evaluar HID/scanner integrado.
- [ ] 5. Evaluar impresion USB, Bluetooth u OTG.
- [ ] 6. Evaluar permisos Android requeridos.
- [ ] 7. Evaluar SDKs propietarios de terminales POS Android.
- [ ] 8. Definir si Android usa agent local, plugin nativo o API distinta.
- [ ] 9. Documentar restricciones y riesgos.
- [ ] 10. Recomendar go/no-go para primera version Android POS.

## Fase 20 - QA final y cierre OpenSpec

- [ ] 1. Crear matriz de pruebas por tipo de periferico.
- [ ] 2. Crear matriz Web POS, Electron y Capacitor.
- [ ] 3. Probar health del agent.
- [ ] 4. Probar discovery.
- [ ] 5. Probar registro de dispositivos.
- [ ] 6. Probar asignacion de perifericos a terminal.
- [ ] 7. Probar impresion de prueba.
- [ ] 8. Probar apertura de caja.
- [ ] 9. Probar lectura de peso.
- [ ] 10. Probar lectura de scanner.
- [ ] 11. Probar logs tecnicos.
- [ ] 12. Probar eventos WebSocket.
- [ ] 13. Probar seguridad local.
- [ ] 14. Probar desconexion y reconexion.
- [ ] 15. Documentar evidencias con screenshots o logs sanitizados.
- [ ] 16. Confirmar que Backend API principal no queda acoplado al hardware.
