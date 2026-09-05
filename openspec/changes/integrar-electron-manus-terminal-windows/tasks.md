## 1. Discovery y contratos

- [ ] 1.1 Confirmar entrypoints, configuración, seguridad y versión de `desktop/electron`.
- [ ] 1.2 Definir URL HTTPS productiva, allowlist de origins y página de error offline.
- [ ] 1.3 Definir contrato Agent/Electron para loopback, CORS, CSP, mixed content e IPC.

## 2. Build Electron Windows

- [ ] 2.1 Configurar versión y metadatos productivos del POS sin cambiar el runtime certificado del Agent.
- [ ] 2.2 Generar paquete autocontenido con Electron runtime, `app.asar`, DLLs, locales, iconos y configuración.
- [ ] 2.3 Validar ejecución en Windows limpio sin Node/npm y registrar tamaño/hash del paquete.

## 3. Integración con Installer Core

- [ ] 3.1 Diseñar seam único para staging y validación coordinada de Agent y POS.
- [ ] 3.2 Implementar activación versionada y rollback conjunto sin mutar targets live.
- [ ] 3.3 Integrar reparación preservando configuración y datos de usuario aprobados.
- [ ] 3.4 Mantener health gate, service registration y semántica de 7.1 sin duplicar operaciones.

## 4. Shortcuts y primer lanzamiento

- [ ] 4.1 Crear y validar shortcuts Desktop y Start Menu con icono y target controlados.
- [ ] 4.2 Implementar CTA explícita `Abrir Manus POS` después de instalación exitosa.
- [ ] 4.3 Definir comportamiento de instancia existente, cierre y errores de primer lanzamiento.

## 5. Uninstall y ciclo de vida

- [ ] 5.1 Extender standard uninstall para eliminar POS y shortcuts preservando ProgramData contratado.
- [ ] 5.2 Extender `--remove-data` para eliminar POS, Agent, datos aplicables y residuos temporales.
- [ ] 5.3 Probar reinstall, reboot/relaunch y recuperación tras fallo sin modificar Agent qa.4.

## 6. Validación y QA físico

- [ ] 6.1 Añadir pruebas de packaging, seguridad Electron, staging, rollback y ausencia de side effects.
- [ ] 6.2 Validar fresh install, repair, uninstall y remove-data en máquina Windows limpia.
- [ ] 6.3 Ejecutar QA físico de primer lanzamiento y carga frontend; periféricos permanecen fuera de alcance.
- [ ] 6.4 Documentar artifact, hashes, riesgos pendientes y decisión de release.

## 7.2A Gates de discovery

- [ ] 7.2A1 Aprobar URL frontend por canal y bloquear producción mientras sea UNKNOWN.
- [ ] 7.2A2 Aprobar esquema `resources/manus-shell.config.json` y allowlist de origins.
- [ ] 7.2A3 Aprobar frontera preload/IPC para Agent loopback y resolver CORS/CSP/PNA.
- [ ] 7.2A4 Aprobar payload `win-unpacked`, manifiesto POS y validación de archivos.
- [ ] 7.2A5 Aprobar seam Installer Core, shortcuts y lanzamiento en sesión interactiva.

## 8. Implementación posterior

- [ ] 8.1 Implementar configuración productiva Electron.
- [ ] 8.2 Implementar health bridge IPC con timeout y normalización.
- [ ] 8.3 Integrar packaging y payload versionado en Installer Core.
- [ ] 8.4 Implementar shortcuts, repair, uninstall y `--remove-data`.
- [ ] 8.5 Ejecutar QA físico Electron sin periféricos.
## Estado de implementación 7.2B

- [x] Configuración QA versionada y validada.
- [x] Preload IPC mínimo para shell info y health.
- [x] Navegación, downloads y permissions con política segura.
- [x] Packaging `win-unpacked` y manifiesto mínimo inspeccionados.
- [ ] Integración Installer Core, shortcuts, launch elevado y QA físico.
- [x] Ventana frameless, adaptive display bounds, Alt+F4 protection y single-instance lock.
- [x] Renderer recovery con límite de 3 intentos por 60 segundos.
- [ ] Maintenance exit confiable, watchdog y autostart interactivo.
## Lifecycle terminal 7.2B

- [x] Aplicar ventana frameless, display-adaptive y no minimizable.
- [x] Bloquear Alt+F4/cierre normal y mantener renderer sin autoridad de cierre.
- [x] Aplicar single-instance lock y foco de primera instancia.
- [x] Aplicar recuperaciÃ³n bounded de renderer.
- [ ] Implementar maintenance exit, watchdog y autostart interactivo.

## Avance vertical integrado 7.2B

### Transporte Electron/Agent

- [x] Transporte Electron explÃ­cito para health, listado y discovery.
- [x] IPC fijo para `/health`, `/devices` y `/devices/discover`.
- [x] Transporte explÃ­cito para configuraciÃ³n, impresiÃ³n, cajÃ³n, scanner, balanza y logs mediante IPC fijo.
- [ ] QA E2E fÃ­sico de hardware y persistencia de configuraciÃ³n.
- [x] Wizard productivo consulta discovery real y filtra dispositivos MOCK en modo REAL.
- [ ] Certificar fÃ­sicamente mÃºltiples impresoras, scanner, cajÃ³n y persistencia wizard/POS.

- [x] Payload `win-unpacked` inventariado y copiado bajo `POS\\versions\\<posVersion>`.
- [x] Activación `POS\\current` y validación de ejecutable, `app.asar` y shell config.
- [x] Cleanup del payload POS en uninstall.
- [x] CTA `Abrir Manus POS` enlazada al host.
- [ ] Shortcuts, lanzamiento interactivo seguro, rollback conjunto y QA físico integrado.
