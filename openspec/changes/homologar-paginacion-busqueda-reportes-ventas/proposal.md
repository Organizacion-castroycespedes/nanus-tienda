## Why

Las tablas de reportería usan paginación distinta y `operations/sales` consulta
automáticamente mientras el usuario edita filtros. El módulo operativo también
necesita un reporte propio, independiente del reporte POS.

## What Changes

- Estandarizar el componente visual y de interacción `Pagination` sin romper
  consumidores existentes.
- Aplicar paginación común a POS, Clientes, Pedidos, Compras, Caja Arqueos y
  Ventas operativas, respetando la estrategia real de cada módulo.
- Separar filtros editables y aplicados en `operations/sales`; consultar solo
  con Buscar.
- Mover Acciones al primer lugar en las tablas solicitadas y añadir solo Ver
  detalle en Ventas operativas si la ruta no tiene columna.
- Definir un reporte PDF/XLSX operativo con alcance propio. No reutilizar
  `/reports/pos-sales` ni `report_resolve_pos_scope`.

## Non-Goals

- No mezclar `/reporteria/pos` con `/operations/sales`.
- No cambiar callbacks, permisos, consultas POS, reglas comerciales, DIAN,
  Electron, Peripheral Agent, impresión física o base de datos sin necesidad
  demostrada.
- No recopilar páginas desde el navegador ni introducir exportación insegura.

## Contract and safety note

La fuente de verdad operativa es `OperationalSaleScopeService`, usado por
`OperationalSalesController` y `OperationalSalesService`. La infraestructura
actual de `backend-reporteria` para `/reports/pos-sales` usa otro contrato y
`report_resolve_pos_scope`; por eso no es compatible automáticamente. Si no se
puede propagar el alcance operativo de forma autenticada y verificable, el
reporte operativo queda BLOCKED y las demás tareas continúan.

Resultado de inspección: BLOCKED. No existe hoy un mecanismo API→reportería
autenticado que transporte y revalide el alcance operativo, y la API no tiene
motores PDF/XLSX. No se habilita el botón ni se inventa un endpoint inseguro.

## Impact

Frontend en `web/components/design-system` y módulos de reportería/ventas.
Backend solo si existe un contrato mínimo independiente y seguro. El reporte
POS permanece sin cambios funcionales.

## Design-only result

Esta ejecución solo documenta la arquitectura objetivo. La exportación sigue
BLOCKED y el botón no se habilita. El contrato API↔reportería, sus credenciales,
su ruta interna y sus motores aún no están implementados.

La implementación también queda bloqueada por replay: no existe en el árbol una
tabla o servicio compartido que consuma `jti` de forma atómica. La tabla
`sale_creation_idempotency` pertenece a otro dominio y no se reutiliza.
