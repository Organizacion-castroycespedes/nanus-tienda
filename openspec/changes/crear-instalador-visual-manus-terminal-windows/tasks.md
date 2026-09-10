## 1. Discovery arquitectura installer

- [x] 1.1 Documentar entrypoint Go, lifecycle, rollback y health gate
- [x] 1.2 Ejecutar spike de host WebView2 sin agregar Electron
- [x] 1.4 Separar chrome nativo WebView2 de chrome simulado y formalizar mock navigation DEV/productivo
- [x] 1.3 Definir bridge tipado Core/UI y limites de privilegio
- [x] 1.5 Implementar bridge read-only para health y discovery reales; mantener mutaciones bloqueadas
- [x] 1.6 Conectar WebView2 en modo REAL_READONLY a health/discovery sin fallback silencioso a fixtures
- [x] 1.7 Habilitar configuración de perfil mediante bridge restringido y PATCH validado en `--ui-config-qa`
- [x] 1.8 Habilitar test print mediante bridge restringido y POST validado en `--ui-print-qa`
- [x] 1.9 Ejecutar y documentar QA físico de test print XP-58 en 58 mm
- [x] 1.10 Habilitar prueba de cajón certificada mediante bridge restringido en `--ui-drawer-qa`
- [x] 1.11 Ejecutar y documentar QA físico de apertura de cajón XP-58

## 2. Shell visual

- [x] 2.1 Crear InstallerShell con tema oscuro y paleta aprobada
- [x] 2.2 Crear InstallerHeader, StatusBadge, PrimaryAction y layout responsive

## 3. Progreso instalación

- [x] 3.1 Implementar modelo explícito de estados y eventos
- [x] 3.2 Renderizar InstallationProgress e InstallationStep
- [ ] 3.3 Implementar detalles técnicos, cancelación confirmada y retry

## 4. Dispositivos

- [ ] 4.1 Conectar discovery existente al DeviceList
- [x] 4.2 Crear PrinterDeviceCard y GenericPeripheralCard
- [x] 4.3 Mostrar no detectado sin fallar instalación

## 5. Configuración impresora

- [ ] 5.1 Renderizar perfiles reales incluyendo THERMAL_58MM
- [ ] 5.2 Persistir asociación con PATCH /devices/:id
- [x] 5.3 Conectar test print sin exponer URLs internas

## 6. Cajón

- [x] 6.1 Crear CashDrawerCard con capability y certificación fail-closed
- [ ] 6.2 Conectar prueba de apertura al contrato existente

## 7. Estados y errores

- [ ] 7.1 Mapear errores técnicos a mensajes operativos en español
- [ ] 7.2 Implementar InstallationError y estados warning/skipped

## 8. Terminal lista

- [x] 8.1 Crear InstallationComplete con checklist de salud
- [ ] 8.2 Preparar CTA Manus POS y panel administrativo sin implementar kiosk

## 9. Responsive

- [ ] 9.1 Validar 1024x768, 1280x720, 1366x768 y 1920x1080
- [ ] 9.2 Garantizar scroll interno y acciones accesibles

## 10. QA Windows

- [ ] 10.1 Tests de componentes para pending/running/success/error/retry
- [ ] 10.2 Tests de XP-58, THERMAL_58MM, cajón y periféricos ausentes
- [ ] 10.3 Validar host en Windows limpio sin PowerShell manual
- [ ] 10.4 Documentar launcher/kiosk como change futuro

## 11. Fase 7 — flujo productivo

- [x] 11.1 Definir modelo tipado de estado del Installer Core para la UI
- [x] 11.1a Implementar reducer/harness no destructivo para eventos y rollback
- [x] 11.1b Añadir `--ui-core-flow-qa` con escenarios deterministas y push WebView2
- [x] 11.1c Generar artefacto QA no destructivo para los flujos Core
- [x] 11.1d Corregir estado inicial, handshake UI_READY y renderer dinámico CoreFlow
- [x] 11.1e Ajustar copy y CTA terminales del harness sin afirmar Terminal lista
- [x] 11.1f Conectar `requestClose()` a `WebView2.Terminate()` con política Core
- [x] 11.1g Instrumentar operaciones Core reales con eventos observacionales
- [x] 11.1h Proteger WM_CLOSE/Alt+F4 con la politica Core
- [x] 11.1i Conectar observer real al WebView productivo tras UI_READY
- [x] 11.1j Aislar el harness CoreFlow de operaciones productivas y cerrar CTA/native close
- [x] 11.1k Implementar staging transaccional para same-version repair y preflight inconsistente
- [x] 11.1l Separar cleanup de uninstall en helper externo fuera de Program Files
- [x] 11.1m Ejecutar QA fisico de uninstall estandar y `--remove-data`
- [x] 11.1n Corregir preflight para ignorar ProgramData persistente y limpiar padre Manus vacio
- [x] 11.1o Corregir cleanup diferido del helper TEMP usando working directory externo y rutas con espacios
- [ ] 11.2 Conectar eventos reales del Core al host WebView2 sin simular progreso
- [ ] 11.3 Activar discovery y periféricos únicamente después del health gate
- [ ] 11.4 Validar cancelación protegida, rollback visible y flujo sin efectos duplicados
- [ ] 11.5 Ejecutar QA manual del instalador integrado (requiere aprobación)
