## 1. Discovery and OpenSpec

- [x] 1.1 Revisar `openspec/changes/`, `openspec/specs/` y cambios previos de perifericos, impresoras, Electron, USB, TCP y ESC/POS.
- [x] 1.2 Identificar la arquitectura real de `backend-perifericos`.
- [x] 1.3 Crear el change `integrar-impresora-digitalpos-dig-e200i`.
- [x] 1.4 Crear `proposal.md`.
- [x] 1.5 Crear `design.md`.
- [x] 1.6 Crear `specs/digital-pos-dig-e200i-network-printer/spec.md`.
- [x] 1.7 Crear checklist `qa.md`.
- [x] 1.8 Crear `risks.md`.

## 2. Modelado y configuracion

- [x] 2.1 Confirmar como se representara `manufacturer` y `model` dentro del modelo actual de dispositivo.
- [x] 2.2 Confirmar que `connectionType = NETWORK` sigue siendo suficiente para el MVP.
- [x] 2.3 Confirmar que `host` y `port` quedan configurables por terminal o dispositivo.
- [x] 2.4 Confirmar default tecnico de `9100` sin hardcodear IP de laboratorio.
- [ ] 2.5 Confirmar como se marcara `enabled` sin romper los estados existentes.

## 3. Transporte y adapter reutilizable

- [x] 3.1 Reusar el transporte TCP existente para impresora de red.
- [ ] 3.2 Confirmar timeout y errores controlados para host caido, puerto cerrado y socket error.
- [ ] 3.3 Mantener el flujo de impresion desacoplado del navegador.
- [ ] 3.4 Evitar cualquier path directo desde Web hacia `192.168.x.x:9100`.

## 4. Perfil Digital POS DIG-E200I

- [ ] 4.1 Agregar o mapear un perfil de impresora para DIG-E200I dentro del catalogo actual.
- [ ] 4.2 Mantener compatibilidad con otros perfiles termicos.
- [ ] 4.3 No marcar como confirmadas capacidades ESC/POS no probadas.
- [ ] 4.4 Documentar el puerto de consulta `4000` como pendiente.

## 5. Integracion funcional

- [ ] 5.1 Integrar la nueva configuracion en el flujo actual de PeripheralAgent.
- [x] 5.2 Reutilizar los contratos web existentes para registro y prueba de impresora.
- [ ] 5.3 Evitar duplicar logica entre Web, Electron y PeripheralAgent.
- [x] 5.4 Mantener compatibilidad con impresoras ya soportadas.
- [x] 5.5 Mantener `manufacturer` y `model` opcionales para no romper registros historicos ni XPrinter.

## 6. Tests y validacion

- [x] 6.1 Agregar tests de configuracion valida e invalida para impresora NETWORK.
- [ ] 6.2 Agregar tests del transporte TCP con sockets mock.
- [ ] 6.3 Agregar tests de error controlado para impresora inaccesible.
- [x] 6.4 Confirmar que el agente no queda bloqueado.
- [x] 6.5 Ejecutar `openspec validate integrar-impresora-digitalpos-dig-e200i --strict`.
- [x] 6.6 Ejecutar `git diff --check`.
- [x] 6.7 Agregar prueba de diagnostico para preservar Unicode en preview y bytes UTF-8 del adapter de red.

## 7. QA fisica y documentacion

- Estado actual: PAUSED - PENDING DIG-E200I PHYSICAL HARDWARE.
- Evidencia cerrada: test-print fisico, ASCII fisico, UTF-8 tecnico, compatibilidad atras.
- Evidencia pendiente: print-ticket NETWORK, encoding fisico por caracteres, cut, drawer, QR, barcode, recovery.

- [ ] 7.1 Completar la checklist QA fisica con la DIG-E200I real.
- [ ] 7.2 Validar networking, impresion y recovery.
- [ ] 7.3 Confirmar o dejar pendientes init, cut, drawer, QR, barcode, images y encoding.
- [ ] 7.4 Documentar hallazgos y limites reales del firmware.
- [ ] 7.5 Cerrar el change con evidencia sanitizada.
