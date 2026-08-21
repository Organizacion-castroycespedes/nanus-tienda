## 1. Discovery and contracts

- [x] 1.1 Revisar acciones Reporteria, modal PDF, Agent, ticket DTO y configuracion de terminal.
- [x] 1.2 Elegir terminal POS actual como destino de reimpresion historica.
- [x] 1.3 Confirmar que el dataset canonico actual requiere ruta JSON y campos de cierre de pago.

## 2. Canonical data and configuration

- [x] 2.1 Exponer dataset autorizado de ticket POS para impresion directa.
- [x] 2.2 Mapear datos canonicos a ticket termico sin recalcular negocio.
- [x] 2.3 Resolver configuracion real de terminal sin fallback mock silencioso.

## 3. Agent

- [x] 3.1 Descubrir USB al startup cuando adapters reales estan habilitados.
- [x] 3.2 Marcar corte fisico USB como no soportado por transporte de cola.
- [x] 3.3 Conservar errores controlados, eventos y logs de trabajo.

## 4. UI

- [x] 4.1 Retirar imprimir del preview PDF y conservar cerrar/descargar.
- [x] 4.2 Agregar accion directa Imprimir con estado procesando, exito y error.

## 5. Tests and evidence

- [x] 5.1 Cubrir datos canonicos, configuracion real y errores de Agent.
- [x] 5.2 Cubrir preview sin imprimir e integracion directa web donde el stack lo permita.
- [x] 5.3 Actualizar evidencia QA con impresion directa y corte pendiente.

## 6. Validation

- [x] 6.1 Ejecutar tests y builds afectados.
- [x] 6.2 Ejecutar lint, OpenSpec strict y git diff check.
- [x] 6.3 Registrar QA manual de XP-80 pendiente.

## 7. QA regression: Reporteria terminal resolution

- [x] 7.1 Eliminar el early return que bloqueaba Reporteria sin terminal Redux.
- [x] 7.2 Resolver `resolve-current` antes de enviar `POST /printer/print-ticket`.
- [x] 7.3 Cubrir terminal default, mock prohibido, Agent offline y device not found.
