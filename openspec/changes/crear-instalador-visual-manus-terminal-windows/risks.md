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
