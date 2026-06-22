## 1. Discovery

- [x] 1.1 Revisar implementacion actual de `api/src/modules/deliveries/**` para estados, endpoints, DTOs, historial y timestamps existentes.
- [x] 1.2 Revisar `web/modules/deliveries/**` y `web/app/[tenant]/deliveries/**` para acciones, filtros, detalle y mensajes.
- [x] 1.3 Confirmar si la DB actual usa valores ingleses, constraints o campos faltantes para `failed_at` y actores.
- [x] 1.4 Confirmar que no se requiere tocar caja, POS, facturacion electronica, pagos, repartidores ni reglas funcionales de pedidos.

## 2. Backend State Management

- [x] 2.1 Definir enum/mapeo canonico `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO`, `CANCELADO` con compatibilidad para valores legados si existen.
- [x] 2.2 Actualizar `DeliveryStateMachineService` con transiciones permitidas, estados finales y bloqueo de transiciones invalidas.
- [x] 2.3 Agregar soporte para `CREADO -> DESPACHADO` y `NO_ENTREGADO -> DESPACHADO` solo cuando el reintento este permitido.
- [x] 2.4 Completar o agregar API de cambio de estado para preparacion, despacho, entregado, no entregado, reintento y cancelacion.
- [x] 2.5 Registrar `dispatched_at`, `delivered_at`, `cancelled_at` y `failed_at` cuando aplique.
- [x] 2.6 Registrar actor en campos existentes o en `delivery_status_history`.
- [x] 2.7 Mantener filtros tenant-safe por estado, incluyendo compatibilidad con datos legados si aplica.
- [x] 2.8 Agregar migracion SQL segura/aditiva solo si faltan columnas, constraints o compatibilidad de estado; no usar SQL destructivo.
- [x] 2.9 Actualizar pruebas backend de state machine, servicio y controlador para transiciones validas/invalidas.

## 3. Frontend List And Detail

- [x] 3.1 Actualizar tipos/helpers de estado para mostrar etiquetas operativas y ocultar valores tecnicos.
- [x] 3.2 Mostrar acciones en listado segun estado, permisos y regla de reintento.
- [x] 3.3 Mostrar acciones equivalentes en detalle y refrescar datos luego de una transicion exitosa.
- [x] 3.4 Mostrar mensajes claros de exito/error para cambio de estado e intento invalido.
- [x] 3.5 Mantener filtro por estado con valores operativos y compatibilidad si hay registros legados.
- [x] 3.6 Mostrar timestamps relevantes en detalle: despacho, entrega, cancelacion y no entregado.
- [x] 3.7 Mantener responsive sin overflow horizontal en listado, detalle y acciones.
- [x] 3.8 Agregar o actualizar pruebas frontend de helpers/acciones cuando sea practico.

## 4. Docs And QA

- [x] 4.1 Crear `docs/evidencia-qa-gestion-estados-domicilios.md` con checklist y resultados reales.
- [x] 4.2 Documentar que caja, POS, facturacion electronica, pagos y pedidos funcionales no cambiaron.
- [x] 4.3 Ejecutar QA manual esperado o dejarlo como pendiente explicito si no hay ambiente/datos.

## 5. Validation

- [x] 5.1 Run `C:\nvm4w\nodejs\openspec.cmd validate gestionar-estados-domicilios --type change --strict`.
- [x] 5.2 Run `C:\nvm4w\nodejs\openspec.cmd validate --all --strict`.
- [x] 5.3 Run backend/API tests si se toca backend.
- [x] 5.4 Run `cd web && npm run lint`.
- [x] 5.5 Run `cd web && npm run build`.
- [x] 5.6 Run `git diff --check`.
