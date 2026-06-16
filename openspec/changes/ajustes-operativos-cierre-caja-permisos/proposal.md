## Why

El cierre de caja permite capturar el efectivo contado, pero la UI usa un campo numerico sin formato monetario claro. En operacion local se necesita aceptar decimales controlados y mostrar el contexto de moneda sin enviar strings formateados al API.

Tambien hay vistas operativas de inventario donde `ADMIN` debe poder completar acciones permitidas por producto: ubicaciones, lotes, productos y promociones. El frontend y algunos controllers backend aun limitan acciones genericas de inventario a roles superiores.

## What Changes

- Ajustar el campo `Efectivo contado` para aceptar valores monetarios con maximo dos decimales.
- Mostrar el campo con prefijo visual `$`.
- Mantener el payload de cierre de caja como numero.
- Habilitar acciones completas para `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` en ubicaciones, lotes, productos y promociones.
- Mantener `config/terminals` para `SUPER_USER` y `SUPER_ADMIN`.
- Restaurar el menu dinamico desde base de datos para catalogos de inventario y terminales, sin atajos locales que reemplacen la respuesta de `/me/menu`.
- Mantener bloqueo para `USER` en acciones administrativas.

## Out of Scope

- Produccion.
- Deploy.
- SQL destructivo o de negocio. Solo se permite SQL idempotente de menu/permisos si la matriz de base de datos no contiene los items esperados.
- Cambios de calculo contable, inventario, facturacion o caja.
- Cambios de contratos API.
- Cambios de permisos para `USER`.
