# Tasks: soportar cajon monedero via impresora XP-80 LAN

## 1. Discovery y cierre de gap

- [x] 1. Revisar `backend-perifericos/src/modules/cash-drawer/**`.
- [x] 2. Revisar `backend-perifericos/src/modules/printer/**`.
- [x] 3. Revisar `backend-perifericos/src/shared/**`.
- [x] 4. Revisar `backend-perifericos/src/adapters/**` y `backend-perifericos/src/platform/**`.
- [x] 5. Confirmar que `POST /cash-drawer/open` hoy es mock.
- [x] 6. Confirmar que `NetworkEscposPrinterAdapter` ya envia bytes reales.
- [x] 7. Confirmar que `CASH_DRAWER_PULSE` ya existe en el renderer.
- [x] 8. Confirmar que el drawer hoy no esta amarrado al `printerDeviceId` canonical.

## 2. Diseno funcional

- [x] 1. Definir request canonical de apertura por `printerDeviceId`.
- [x] 2. Definir respuesta QA con `mode`, `adapterName`, `network` y `bytesSent`.
- [x] 3. Definir defaults seguros de pulso para THERMAL_80MM.
- [x] 4. Definir compatibilidad temporal con `deviceId` si hace falta.
- [x] 5. Definir error model para printer not found, unsupported pulse y failure de red.

## 3. Backend-perifericos

- [x] 1. Extender el resolver para cajon logico sobre impresora real.
- [x] 2. Reusar `NetworkEscposPrinterAdapter` para el cajon real.
- [x] 3. Construir un solo pulso por request.
- [x] 4. Mantener `POST /cash-drawer/open` compatible.
- [x] 5. Exponer respuesta operativa completa.
- [x] 6. Emitir logs y eventos tecnicos para QA.

## 4. Admin periferial

- [x] 1. Mostrar que el cajon depende de la impresora.
- [x] 2. Permitir asociar cajon a la impresora canonical de la terminal.
- [x] 3. Agregar boton `Probar apertura`.
- [x] 4. Mostrar ultimo resultado.
- [x] 5. Evitar seleccion accidental de MOCK en produccion.

## 5. Tests

- [x] 1. Cobertura de bytes ESC/POS para drawer pulse.
- [x] 2. Cobertura de un request = un pulso.
- [x] 3. Cobertura de uso de `NetworkEscposPrinterAdapter`.
- [x] 4. Cobertura de host/port heredados de la impresora.
- [x] 5. Cobertura de success y failure de red.
- [x] 6. Cobertura de printer not found.
- [x] 7. Cobertura de unsupported printer capability.
- [x] 8. No regresion de print-ticket.
- [x] 9. No regresion de CUT.
- [x] 10. No regresion de USB XP-80.
- [x] 11. No regresion de persistence/autostart/CORS.

## 6. QA y empaquetado

- [x] 1. Preparar package Windows x64.
- [x] 2. Validar package Windows x64.
- [x] 3. Ejecutar `backend-perifericos npm test`.
- [x] 4. Ejecutar `backend-perifericos npm run build`.
- [x] 5. Ejecutar `git diff --check`.
- [x] 6. Detenerse antes de QA fisica y documentar comandos para workstation `.18`.
