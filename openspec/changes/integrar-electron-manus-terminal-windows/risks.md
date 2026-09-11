# Riesgos de integración Electron

- La URL productiva no está definida todavía; no usar `localhost:3000` en instalaciones reales.
- Electron 42 incluye Chromium y puede aumentar mucho el tamaño del instalador.
- El acceso HTTPS→HTTP loopback requiere una decisión explícita de CORS, CSP y mixed content.
- Agent y POS deben tener staging, backup y rollback independientes pero coordinados.
- La firma de código y SmartScreen quedan pendientes y bloquean distribución pública.
- El cierre de la ventana Electron durante una operación del Core debe reutilizar el contrato de cierre de 7.1.
- Ninguna prueba de esta planificación debe ejecutar instalación real ni periféricos.
## Estado 7.2B

- Health IPC implementado con destino fijo y errores sanitizados.
- El Agent auth local sigue pendiente; se conserva la frontera de máquina local.
- El paquete medido `win-unpacked` pesa 371174289 bytes.
- Frameless/display-sized window puede ocultar controles de recuperación → maintenance exit debe ser un canal local confiable.
- Single-instance lock no cubre Task Manager kill → watchdog futuro separado, bounded y deshabilitado durante maintenance.
## Lifecycle terminal

- La ventana frameless oculta controles nativos; el mantenimiento futuro debe tener un canal confiable fuera del renderer.
- `app.requestSingleInstanceLock()` evita duplicados normales, pero no protege contra terminaciÃ³n forzada del sistema.
- El proceso de smoke local iniciÃ³ sin error de preload; la validaciÃ³n visual de frontend remoto queda pendiente en mÃ¡quina QA.
## PerifÃ©ricos (7.2B)

- El renderer Electron no accede al loopback. Las operaciones se exponen
  mediante canales IPC explÃ­citos y rutas Agent fijas.
- El Agent conserva semillas MOCK para pruebas; el modo REAL filtra esos
  dispositivos. La validaciÃ³n fÃ­sica de SP-58, XP-80, scanner y cajÃ³n queda
  pendiente y no se afirma aquÃ­.
- No existe contrato de autenticaciÃ³n local; el lÃ­mite actual es loopback y
  el IPC allowlist. Se requiere hardening posterior.
