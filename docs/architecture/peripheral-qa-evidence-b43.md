# Evidencia QA de Electron y periféricos — B4.3

## Evidencia existente en repositorio

| Área | Evidencia | Qué demuestra | Estado |
|---|---|---|---|
| Electron config/window | `desktop/electron/*.spec.ts` | Validación de configuración, ventana, recovery y contrato runtime | Prueba automatizada existente; no ejecutada |
| Agent health/config | `backend-perifericos/test/health.spec.ts`, `peripherals-config.spec.ts` | Parseo y respuesta health | Prueba automatizada; no ejecutada |
| Network ESC/POS | `backend-perifericos/test/network-escpos.spec.ts` | Resolver, bytes, socket, error y timeout simulados | Prueba automatizada; no hardware |
| USB printer | `backend-perifericos/test/usb-printer.spec.ts` | Contrato de cola/adaptador simulado | Prueba automatizada; no cola real |
| Thermal renderer | `thermal-escpos.renderer.spec.ts` | Formato ESC/POS, QR, imagen y corte | Prueba automatizada; no impresora |
| Cash drawer | `cash-drawer-via-printer.spec.ts`, `pos-sale-integration.spec.ts` | Pulso, routing y feedback | Prueba automatizada; no apertura física |
| Scanner | `pos-scanner*.spec.ts`, `scanner-capture.spec.ts` | Wedge, matching y captura | Prueba automatizada; no HID certificado |
| Scale | `mock-simulator.spec.ts`, `scale` modules | Respuesta simulada | Simulación |
| Installer | `windows-installer/*_test.go`, scripts de validación | Flujo y manifest del instalador | Evidencia de código; no ejecución B4.3 |
| Historical README | `backend-perifericos/README.md`, `desktop/electron/README.md` | Puertos, flags, comandos y limitaciones declaradas | Evidencia documental histórica |

No se encontró evidencia suficiente en este turno con dispositivo físico, modelo,
serie, sistema operativo, fecha y resultado vigente. Por eso no se certifican
impresoras, cajón, scanner, balanza ni instalador.

## QA físico pendiente

| Caso | Datos mínimos requeridos | Resultado esperado |
|---|---|---|
| Ticket POS | dispositivo, perfil, OS, Agent y versión | ticket visible y bytes/estado |
| Impresora NETWORK | host autorizado, puerto, perfil | impresión y timeout controlado |
| Impresora USB | cola Windows, transport RAW/GDI, OS | impresión y corte según certificación |
| Cajón | impresora padre, pulso certificado | apertura física y no doble pulso |
| Scanner HID | modelo, layout teclado, Electron/Web | una lectura por código |
| Balanza | modelo, unidad, estabilidad | peso correcto y rechazo inestable |
| Agent recovery | reinicio y pérdida de conexión | warning, health y recuperación manual |
| Installer | versión, hash, OS, firma | instalación, servicio y desinstalación |

Estas pruebas requieren autorización y hardware. No se ejecutaron.
