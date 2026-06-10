## Why

Manus POS ya tiene los bloques principales para operar como Web POS, pero necesita una fase de estabilizacion integral antes de venderse como MVP comercial. El foco cambia de hardware/perifericos reales a estabilidad operativa, facturacion electronica, reportería, despliegue, soporte, monitoreo y experiencia diaria multiusuario/multisucursal.

Ademas, el MVP no debe saltar de desarrollo local a PRD. Antes de cualquier despliegue productivo debe existir un ambiente QA AWS listo para validar migraciones, rollback, smoke tests remotos y evidencias operativas.

## What Changes

- Crear una iniciativa OpenSpec nueva para preparar Manus POS como MVP WEB listo para operacion real.
- Agregar formalmente `QA AWS Environment Readiness` como etapa previa a cualquier despliegue PRD.
- Definir arquitectura de ambientes `Local -> QA AWS -> PRD`.
- Definir estrategia de migraciones para QA AWS, incluyendo validacion, historial y no aplicacion directa en PRD.
- Definir estrategia de rollback para cambios de aplicacion y migraciones.
- Definir smoke tests remotos sobre QA AWS.
- Definir evidencias QA obligatorias para ambiente remoto.
- Definir gates de QA operativo para ventas, compras, pedidos, inventario, clientes, proveedores, caja y reportería.
- Fortalecer facturacion electronica: clientes FE, proveedores FE, GetAcquirer, eventos, validaciones y reportería FE.
- Completar reportería operativa para compras, pedidos, clientes, productos, inventario, caja y rentabilidad.
- Fortalecer operacion: terminales, configuracion, auditoría, trazabilidad, monitoreo y soporte tecnico.
- Exponer version, release, build y estado de migraciones desde UI y/o endpoints controlados.
- Crear checklist formal de salida MVP y evidencia de QA final.
- Mantener perifericos MOCK funcionando sin depender de hardware fisico.
- No implementar impresora real, scanner real, balanza real, caja real, Electron, Capacitor, USB, serialport, HID ni drivers.

## Capabilities

### New Capabilities

- `mvp-web`: readiness operativo del MVP WEB, incluyendo QA AWS environment readiness, QA integral, FE hardening, reportería, versionamiento, auditoría, health monitoring y checklist final.

### Modified Capabilities

- Ninguna en esta propuesta. Las capacidades existentes (`productos`, `inventario`, `precios`, `reporteria-inventario`, `peripherals`, `dian-third-party-lookup`, `electronic-invoicing-customers`) pueden ser usadas o endurecidas por implementacion, pero esta iniciativa define el contrato MVP transversal en `mvp-web`.

## Impact

- Afecta principalmente `api/`, `web/`, `scripts/database/`, `docs/`, OpenSpec y configuracion de release.
- Agrega requisitos de ambiente QA AWS antes de PRD, sin implementar infraestructura en esta fase documental.
- Puede tocar `backend-perifericos/` solo para bugs que rompan perifericos MOCK ya mergeados.
- No debe tocar `backend-reporteria/` salvo que una fase posterior lo autorice explicitamente.
- No debe romper ventas, compras, pedidos, inventario ni perifericos MOCK.
- No introduce dependencias de hardware fisico.
