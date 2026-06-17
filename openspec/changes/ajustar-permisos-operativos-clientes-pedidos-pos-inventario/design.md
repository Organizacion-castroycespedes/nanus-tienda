## Context

Manus POS usa permisos de menu (`menu_items` + `role_menu_permissions`) para construir navegacion y tambien para proteger endpoints con `@RequirePermission`. En QA, `USER` no puede cargar productos ni impuestos en POS porque esos endpoints dependen de permisos administrativos de Inventario. En local hay drift de datos, por eso el bug no siempre reproduce igual.

Clientes, Orders y POS son flujos operativos. Inventario administrativo es otro alcance. El hotfix debe permitir lectura operativa sin abrir pantallas ni escrituras administrativas.

La pantalla real de `/customers` no consume solo `/api/customers`: tambien mezcla datos fiscales desde `/api/electronic-invoicing/customers` y guarda cambios fiscales con `POST/PATCH` sobre ese prefijo. Ese controller debe quedar alineado con la misma regla operativa de Customers, sin abrir proveedores ni otros modulos de facturacion electronica.

POS calcula cada linea con `POST /api/pricing/preview-line`. Ese endpoint lee producto, impuesto y promociones aplicables para devolver precio transaccional; no administra promociones. Debe quedar disponible para roles operativos del POS sin conceder `INVENTORY_PROMOTIONS WRITE`.

## Goals / Non-Goals

**Goals:**
- Permitir a `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` crear/editar clientes.
- Permitir a `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` listar/crear/editar datos fiscales basicos de clientes usados por `/customers`.
- Permitir a `USER` leer clientes, productos e impuestos para Orders/POS.
- Permitir a roles operativos ejecutar preview de precio/promocion para lineas POS/Orders.
- Bloquear menu y ruta administrativa `/inventory` para `USER`.
- Mantener escrituras administrativas de Inventario bloqueadas para `USER`.
- Mantener Roles solo `SUPER_ADMIN`.
- Mantener Terminales solo `SUPER_USER` y `SUPER_ADMIN`.
- Dejar SQL idempotente para alinear local/QA sin aplicar QA en este cambio.

**Non-Goals:**
- No desplegar ni tocar QA/produccion.
- No redisenar todo RBAC.
- No cambiar autenticacion JWT.
- No otorgar Inventario administrativo a `USER`.
- No otorgar Roles a `SUPER_USER`.
- No otorgar Terminales a `ADMIN` o `USER`.

## Decisions

1. Separar lectura operativa de visibilidad administrativa.
   - Decision: `GET` usados por POS/Orders pueden aceptar roles operativos cuando el endpoint solo entrega catalogo necesario.
   - Alternativa descartada: devolver Inventario a `USER` en DB/menu. Eso arregla 403 pero expone modulo administrativo.

2. Mantener escrituras protegidas por permisos administrativos.
   - Decision: `POST/PATCH/DELETE` de productos, impuestos, ubicaciones, lotes y acciones destructivas siguen requiriendo permisos de Inventario.
   - Alternativa descartada: permisos globales por rol sin menu key. Es mas rapido pero peligroso.

3. Alinear `electronic-invoicing/customers` con Customers operativo.
   - Decision: list/create/update/detail/default de clientes fiscales basicos declaran `operationalRoles` para `USER`, `ADMIN` y `SUPER_USER`; `SUPER_ADMIN` conserva bypass.
   - Decision: el SQL crea/usa `ELECTRONIC_INVOICING_CUSTOMERS` como permiso backend-only no visible.
   - Alternativa descartada: abrir todo electronic-invoicing o proveedores fiscales. No es necesario para `/customers`.

4. Alinear `pricing/preview-line` con POS operativo.
   - Decision: `POST /api/pricing/preview-line` declara `operationalRoles` para `USER`, `ADMIN` y `SUPER_USER`; `SUPER_ADMIN` conserva bypass.
   - Decision: no se agrega menu ni permiso administrativo de promociones para `USER`.
   - Alternativa descartada: otorgar `INVENTORY_PROMOTIONS` o inventario administrativo a `USER`. Eso corrige el 403 pero abre administracion indebida.

5. Arreglar frontend y backend en conjunto.
   - Decision: backend define el limite de seguridad y frontend solo mejora experiencia: botones, rutas y menu.
   - Alternativa descartada: solo ocultar botones en frontend. Eso no corrige 403 ni seguridad real.

6. SQL sera idempotente y correctivo.
   - Decision: agregar script que quite `USER` de Inventario administrativo y garantice permisos operativos requeridos donde correspondan.
   - Alternativa descartada: editar manualmente QA. No deja rastro ni idempotencia.

## Risks / Trade-offs

- Drift entre local y QA -> Mitigacion: SQL idempotente y evidencia de aplicacion local x2 antes de pedir QA.
- Endpoints compartidos por admin y operativo -> Mitigacion: permitir solo `GET` catalogo a roles operativos; escrituras quedan con `WRITE`.
- Menu dinamico puede traer permisos amplios desde DB -> Mitigacion: route permissions y filtro frontend bloquean `/inventory` para `USER` aunque haya drift.
- Tests existentes pueden ser pocos -> Mitigacion: agregar tests de metadata/guards y helpers de permisos donde el repo ya tiene patrones.

## Migration Plan

1. Aplicar SQL local una vez.
2. Aplicar SQL local segunda vez para comprobar idempotencia.
3. Ejecutar consultas de validacion local para roles/menu/permisos.
4. No aplicar QA ni produccion en este cambio.
5. Para QA futuro, ejecutar el mismo SQL con evidencia sin secretos.
