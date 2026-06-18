# Backlog post-v0.0.1

## Regla de fase

Todo lo listado aqui queda despues del corte `v0.0.1`. No debe entrar al sellado inicial salvo documentacion o validacion sin cambio funcional.

## Prioridad P0 post-corte

| Item | Tipo | Depende de compra/certificado | Comentario |
| --- | --- | --- | --- |
| Congelar tag/version `0.0.1` y release notes | Gestion | No | Despues de revision humana. |
| Resolver test API `InventoryService product mapping` | Tecnico | No | Falla actual: `RangeError: Invalid time value` por `image_updated_at` indefinido. |
| QA visual autenticado web | Tecnico | No | Validar rutas principales con usuarios reales/QA. |
| Runbook de despliegue staging/QA | Tecnico | No | Sin tocar PRD. |
| Confirmar envs y secrets reales no fallback | Seguridad | No | `JWT_SECRET`, CORS, URLs publicas. |
| Confirmar migraciones aplicadas por runner oficial | Tecnico/DB | No | Solo en ambiente aprobado; no en este change. |
| SCA/npm audit planificado | Seguridad | No | Especialmente FE/DIAN dependencies. |

## Prioridad P1

| Item | Tipo | Se puede antes de compras | Comentario |
| --- | --- | --- | --- |
| Hardening POS UX y atajos | Producto | Si | Seguir `pos-visual-operability-redesign`. |
| Dashboard/home de producto | Producto | Si | KPIs ejecutivos y entrada operativa. |
| Mejorar CRM customers | Producto | Si | Segmentacion, historial, contacto, reportes. |
| Promocion activa fixture QA | QA | Si | Para validar descuento aplicado de punta a punta. |
| Reporteria UX y filtros | Producto | Si | Mejorar consultas y exportables. |
| Observabilidad runtime | Tecnico | Si | Logs, health, errores 4xx/5xx. |
| Documentar rollback completo | Ops | Si | App + DB + reporteria + perifericos. |

## Prioridad P2

| Item | Tipo | Depende de compra/certificado | Comentario |
| --- | --- | --- | --- |
| Perifericos hardware real | Hardware | Si | Impresora, cajon, balanza, scanner, drivers. |
| Electron | Plataforma | Parcial | Puede prototiparse antes; validacion hardware depende de equipos. |
| Capacitor | Plataforma | Parcial | Puede prototiparse antes; QA real necesita dispositivos. |
| DIAN real / facturacion electronica | Fiscal | Si | P12/PFX, WSDL, habilitacion, aprobacion. |
| Proveedor/fuente fiscal suppliers | Fiscal/Negocio | Si | Decision externa. |
| Produccion fiscal | Fiscal/Ops | Si | Despues de habilitacion y auditoria. |

## Trabajo que puede hacerse antes de comprar hardware

- Seguir usando `backend-perifericos` en `MOCK`.
- Mejorar panel `/admin/peripherals`.
- Preparar contratos para impresora/cajon/balanza/scanner.
- Preparar Electron shell sin activar hardware real.
- QA con mocks y feature flags.
- Documentar matriz de modelos de hardware candidatos.

## Trabajo que puede hacerse antes de certificado DIAN

- Mantener `DIAN_GET_ACQUIRER_HTTP_ENABLED=false`.
- Completar mock fiscal.
- Fortalecer loader de configuracion y secret handling sin usar secreto real.
- Ejecutar SCA/npm audit en ambiente permitido.
- Preparar fixtures anonimizados.
- Definir circuit breaker, timeouts, retries y logging seguro.
- Documentar proceso de habilitacion.

## No debe entrar en v0.0.1

- SQL nuevo.
- Cambios de permisos.
- Cambios de API contracts.
- Cambios de logica POS, caja, inventario, pedidos o compras.
- Hardware real.
- DIAN real.
- Electron/Capacitor productivo.
- CRM completo.
- Deploy PRD.
- Remediaciones npm automaticas que cambien dependencias sin change dedicado.

## Siguiente fase recomendada

Abrir un change post-release separado para `hardening-release-0-0-1`, con foco en:

- QA visual autenticado.
- Release notes.
- Checklist staging.
- Observabilidad basica.
- Limpieza de warnings no funcionales si el equipo lo aprueba.
