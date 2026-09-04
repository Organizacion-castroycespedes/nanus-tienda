# Risks

| Riesgo | Mitigacion |
| --- | --- |
| WebView2 no disponible | Spike previo y fallback seguro; no afirmar soporte hasta QA Windows limpio |
| Bridge expone privilegios | API minima tipada; UI sin comandos arbitrarios |
| Reusar Next aumenta bundle | Extraer primitives; no embebir toda la aplicacion |
| Cancelacion deja instalacion parcial | Confirmacion y rollback del Installer Core |
| Usuario ve datos tecnicos | Vista principal sanitizada; detalles bajo demanda |
| Kiosk se mezcla con instalacion | Launcher, Startup y Edge kiosk quedan en change posterior |
| Contratos fisicos cambian | Consumir endpoints existentes; no modificar Agent en este change |
| WebView2 Runtime ausente | Detectar inicializacion y mostrar fallback; no descargar silenciosamente |
| Navegacion externa o JS remoto | Cargar solo HTML embebido; bloquear URLs externas y servidor localhost |
| Same-version repair muta el target live | Staging validado, servicio detenido antes de activacion, backup independiente y rollback transaccional |
| Metadata VERSION.json ausente oculta instalacion rota | Preflight marca `INCONSISTENT` cuando existen footprints sin metadata valida |
| Uninstaller borra su propio payload en uso | Helper externo en TEMP espera la salida del padre antes del cleanup y conserva registry hasta confirmacion |
| Log externo de remove-data queda como residuo | Final cleaner separado, fuera de target/log, con retries acotados y retencion solo en fallo |

## Fase 7 — integración Core/UI

- [ ] La conexión de eventos debe respetar el orden del Core, health gate,
  instalación versionada y rollback; no simular progreso desde JavaScript.
- [ ] El artefacto integrado tiene efectos reales de instalación y requiere
  aprobación manual antes de ejecutarse.
- [ ] El cierre durante un paso crítico debe pasar por `requestClose()` y la
  decisión de cancelación del Core.
- [ ] El observer real todavía no está conectado al WebView productivo; no
  ejecutar el instalador integrado hasta completar ese puente y revisar la X nativa.
