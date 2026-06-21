## 1. Discovery

- [ ] 1.1 Revisar implementacion actual de `api/src/modules/deliveries/**` para estados, endpoints, DTOs, historial y timestamps existentes.
- [ ] 1.2 Revisar `web/modules/deliveries/**` y `web/app/[tenant]/deliveries/**` para acciones, filtros, detalle y mensajes.
- [ ] 1.3 Confirmar si la DB actual usa valores ingleses, constraints o campos faltantes para `failed_at` y actores.
- [ ] 1.4 Confirmar que no se requiere tocar caja, POS, facturacion electronica, pagos, repartidores ni reglas funcionales de pedidos.

## 2. Backend State Management

- [ ] 2.1 Definir enum/mapeo canonico `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO`, `CANCELADO` con compatibilidad para valores legados si existen.
- [ ] 2.2 Actualizar `DeliveryStateMachineService` con transiciones permitidas, estados finales y bloqueo de transiciones invalidas.
- [ ] 2.3 Agregar soporte para `CREADO -> DESPACHADO` y `NO_ENTREGADO -> DESPACHADO` solo cuando el reintento este permitido.
- [ ] 2.4 Completar o agregar API de cambio de estado para preparacion, despacho, entregado, no entregado, reintento y cancelacion.
- [ ] 2.5 Registrar `dispatched_at`, `delivered_at`, `cancelled_at` y `failed_at` cuando aplique.
- [ ] 2.6 Registrar actor en campos existentes o en `delivery_status_history`.
- [ ] 2.7 Mantener filtros tenant-safe por estado, incluyendo compatibilidad con datos legados si aplica.
- [ ] 2.8 Agregar migracion SQL segura/aditiva solo si faltan columnas, constraints o compatibilidad de estado; no usar SQL destructivo.
- [ ] 2.9 Actualizar pruebas backend de state machine, servicio y controlador para transiciones validas/invalidas.

## 3. Frontend List And Detail

- [ ] 3.1 Actualizar tipos/helpers de estado para mostrar etiquetas operativas y ocultar valores tecnicos.
- [ ] 3.2 Mostrar acciones en listado segun estado, permisos y regla de reintento.
- [ ] 3.3 Mostrar acciones equivalentes en detalle y refrescar datos luego de una transicion exitosa.
- [ ] 3.4 Mostrar mensajes claros de exito/error para cambio de estado e intento invalido.
- [ ] 3.5 Mantener filtro por estado con valores operativos y compatibilidad si hay registros legados.
- [ ] 3.6 Mostrar timestamps relevantes en detalle: despacho, entrega, cancelacion y no entregado.
- [ ] 3.7 Mantener responsive sin overflow horizontal en listado, detalle y acciones.
- [ ] 3.8 Agregar o actualizar pruebas frontend de helpers/acciones cuando sea practico.

## 4. Docs And QA

- [ ] 4.1 Crear `docs/evidencia-qa-gestionar-estados-domicilios.md` con checklist y resultados reales.
- [ ] 4.2 Documentar que caja, POS, facturacion electronica, pagos y pedidos funcionales no cambiaron.
- [ ] 4.3 Ejecutar QA manual esperado o dejarlo como pendiente explicito si no hay ambiente/datos.

## 5. Validation

- [ ] 5.1 Run `C:\nvm4w\nodejs\openspec.cmd validate gestionar-estados-domicilios --type change --strict`.
- [ ] 5.2 Run `C:\nvm4w\nodejs\openspec.cmd validate --all --strict`.
- [ ] 5.3 Run backend/API tests si se toca backend.
- [ ] 5.4 Run `cd web && npm run lint`.
- [ ] 5.5 Run `cd web && npm run build`.
- [ ] 5.6 Run `git diff --check`.
