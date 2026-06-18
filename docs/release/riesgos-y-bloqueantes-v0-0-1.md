# Riesgos y bloqueantes v0.0.1

## Bloqueantes por compra o aprobacion externa

| Bloqueante | Impacto | Modulos afectados | Estado |
| --- | --- | --- | --- |
| Hardware POS real no comprado/validado | No se puede certificar impresion, cajon, balanza o scanner real | Perifericos, POS, Caja | `BLOQUEADO_EXTERNO` |
| Drivers/protocolo de hardware no definido | Adapters reales no pueden activarse con seguridad | backend-perifericos, Electron futuro | `BLOQUEADO_EXTERNO` |
| Certificado P12/PFX DIAN real ausente | No se puede probar GetAcquirer real ni facturacion electronica real | FE, Customers fiscales | `BLOQUEADO_EXTERNO` |
| WSDL/endpoint DIAN habilitacion no aprobado | No se puede ejecutar habilitacion | FE/DIAN | `BLOQUEADO_EXTERNO` |
| Secret manager/proceso de claves no aprobado | Riesgo de exposicion de certificado/password | FE/DIAN, Ops | `BLOQUEADO_EXTERNO` |
| Dispositivos moviles reales no definidos | No se puede validar Capacitor | Capacitor/POS mobile | `BLOQUEADO_EXTERNO` |

## Bloqueantes tecnicos

| Bloqueante | Impacto | Mitigacion |
| --- | --- | --- |
| Changes activos con tareas incompletas | No mezclar cierre con evolucion funcional | Mantener este change documental separado. |
| Drift de DB/seeds entre ambientes | Permisos o menus pueden diferir | Validar migraciones por runner oficial antes de deploy. |
| Test unitario API fallido en inventario | Suite API no queda verde para el corte | Corregir en change separado: `image_updated_at` ausente en fixture o mapper debe tolerar `undefined`. |
| Warnings frontend preexistentes | Ruido en build/lint | Reportar; corregir en change dedicado. |
| Smoke visual autenticado no siempre completo | Riesgo UX no detectado | Ejecutar QA visual post-corte. |
| Perifericos reales desactivados | No certifica operacion fisica | Mantener MOCK en v0.0.1. |
| DIAN real desactivado | No certifica facturacion electronica real | Mantener mock/disabled en v0.0.1. |
| Promocion activa ausente en fixture QA integral | Pricing funciona, pero descuento aplicado no siempre se ve en QA final | Crear fixture post-v0.0.1 si negocio exige demo. |

## Riesgos conocidos por area

| Area | Riesgo | Severidad | Estado |
| --- | --- | --- | --- |
| Auth/security | Env inseguro o `JWT_SECRET` fallback fuera de local/test | Alta | Hardening documentado; confirmar env destino. |
| RBAC | Permisos DB pueden quedar desalineados con route rules | Alta | Matriz documentada; no cambiar en corte. |
| POS | Carrito local no es colaborativo y puede divergir contra stock | Media | Mantener como UX; evaluar draft server-side post-release. |
| Caja | Conciliacion avanzada y auditoria completa quedan futuras | Media | Flujos base validados. |
| Inventario | Consolidacion de lotes/ubicaciones sigue activa | Media | No bloquear v0.0.1. |
| Compras | Recepcion parcial requiere QA continuo | Media | Evidencia existente PASS. |
| Reporteria | Depende de funciones SQL y backend separado | Media | QA E2E confirma endpoints principales. |
| Perifericos | REAL/HYBRID modelado pero no probado | Alta | No activar real adapters. |
| FE/DIAN | Dependencias XML/certificados requieren SCA | Alta | Ejecutar SCA antes de habilitacion. |
| UX | Dashboard/home aun no producto-final | Media | Roadmap post-v0.0.1. |

## Condiciones de no avance

Detener cualquier fase si aparece:

- Necesidad de SQL no aprobada.
- Cambio de permisos requerido.
- Cambio de contrato API requerido.
- Activacion de PRD.
- Uso de certificado real sin aprobacion.
- Activacion de hardware real sin compra/prueba controlada.
- Necesidad de mezclar este change con otro OpenSpec activo.

## Riesgos aceptables para sellar v0.0.1

- Perifericos en MOCK.
- FE/DIAN en mock/disabled.
- Electron y Capacitor pendientes.
- CRM parcial.
- Home/dashboard producto parcial.
- Promociones sin fixture activa obligatoria en QA integral.

Estos riesgos son aceptables solo si quedan fuera del alcance de `v0.0.1` y pasan al roadmap.
