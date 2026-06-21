# Modelos de despliegue Web/Electron

Fecha: 2026-06-20  
Alcance: conceptual. No modifica build, runtime, dependencias ni deploy real.

## Principios

- La API cloud sigue siendo la fuente de verdad para ventas, inventario, caja, pedidos, clientes, proveedores, permisos y reportes.
- Web y Electron no deben duplicar reglas de negocio.
- Electron se analiza en esta fase como contenedor desktop online.
- Offline queda fuera de alcance.
- No se crean instaladores ni pipelines en esta fase.

## Tipo A: Web 100%

### Modelo

```text
Usuario -> Navegador moderno -> Web cloud -> API cloud -> PostgreSQL
```

### Build y deploy conceptual

1. Ejecutar build web en CI/CD o ambiente aprobado.
2. Publicar frontend en QA/produccion.
3. Configurar URL de API cloud.
4. Operar desde navegador moderno.
5. Actualizar de forma centralizada con cada deploy.

### Operacion

- Sin instalacion local.
- Sin offline.
- Compatible con Windows, Linux y macOS mediante navegador moderno.
- Recomendado para administracion, consulta, compras, inventario, clientes, proveedores, reportes y operacion con conectividad estable.

### Actualizaciones

- Centralizadas.
- El usuario recibe cambios al recargar o abrir nueva sesion.
- No requiere instalador.

### Validaciones necesarias

- Login y refresh.
- Rutas tenant.
- Permisos/menu.
- POS web si se usa.
- Reporteria.
- Compatibilidad visual en navegadores objetivo.

## Tipo B: Electron 100%

### Modelo

```text
Usuario -> App Electron online -> API cloud -> PostgreSQL
```

Electron funciona como shell desktop. No contiene backend de negocio. No contiene motor offline. No reemplaza la API.

### Build y deploy conceptual futuro

1. Usar la web existente como URL de entrada para Electron online.
2. Crear Electron shell minimo en `desktop/electron/`.
3. Configurar endpoints cloud, tenant, sucursal y terminal.
4. Empaquetar instalador por sistema operativo.
5. Instalar en terminal POS.
6. Validar login, sesion POS, caja y venta online.
7. Validar perifericos por OS y por modelo de hardware.

### Configuracion por terminal

Cada instalacion Electron debe tener una configuracion operativa clara:

- Tenant.
- Sucursal.
- Terminal.
- URL API cloud.
- URL o modo de perifericos si aplica en fase futura.
- Version Electron instalada.
- Usuario autorizado para operar POS.

La configuracion no debe saltarse RBAC ni permisos API. La API sigue validando usuario, tenant, sesion y permisos.

### Operacion

- Desktop online.
- Foco inicial en POS/caja.
- API cloud obligatoria.
- Sin offline en esta fase.
- Sin service worker.
- Sin sync queue.

### Actualizaciones conceptuales

Opciones futuras:

- Instalador manual versionado.
- Auto-update con canal QA/produccion.
- Distribucion controlada por soporte.

Cualquier estrategia debe respetar matriz de compatibilidad Electron/Web/API.

### Validaciones necesarias

- Login y refresh en Electron.
- Seleccion tenant/sucursal/terminal.
- Apertura y uso de sesion POS.
- Venta online.
- Caja y pagos.
- Tickets/perifericos cuando existan fases validadas.
- Comportamiento sin internet: debe fallar controlado, no operar offline.

## Tipo D: Web + Electron

### Modelo

```text
Administracion -> Navegador -> Web cloud -> API cloud -> PostgreSQL
Caja/POS       -> Electron -> API cloud -> PostgreSQL
```

### Flujo de despliegue conceptual

1. Desplegar Web cloud para administracion.
2. Desplegar API cloud compatible.
3. Empaquetar Electron por sistema operativo en fase futura.
4. Instalar Electron en terminales POS.
5. Configurar tenant/sucursal/terminal por caja.
6. Validar operacion caja online.
7. Mantener matriz de versiones Web/Electron/API.

### Distribucion de responsabilidades

| Responsabilidad | Web | Electron | API |
| --- | --- | --- | --- |
| Administracion | Si | No recomendado como canal principal | Valida y persiste |
| POS/caja | Posible | Recomendado | Valida y persiste |
| Reportes | Si | Solo operativos si aplica | Calcula/expone |
| Configuracion terminal | Si | Consume configuracion local/remota | Valida |
| Reglas de negocio | No | No | Si |
| Offline | No | No en esta fase | No cambia |

### Sincronizacion operativa

En esta fase, "sincronizacion" significa uso normal de API cloud mientras existe conectividad. No significa cola offline ni reconciliacion local.

### Matriz de compatibilidad conceptual

| API | Web | Electron | Estado |
| --- | --- | --- | --- |
| v0.0.1 compatible | Web v0.0.1 | Sin Electron | Estado actual |
| API futura compatible | Web futura | Electron online Windows | Fase Electron base |
| API futura compatible | Web futura | Electron Windows/Linux/macOS | Fase multiplataforma |

Cada release Electron debe declarar:

- Version del shell.
- Version web embebida o endpoint web remoto, segun diseno futuro.
- Version minima API.
- Sistema operativo soportado.
- Cambios de configuracion.

## Proceso conceptual por tipo

### Tipo A

- Web build.
- Deploy QA/produccion.
- Operacion desde navegador.
- Actualizacion centralizada.

### Tipo B

- Web existente cargada por URL configurable.
- Electron shell minimo en `desktop/electron/`.
- Instalador por sistema operativo.
- Configuracion por tenant/sucursal/terminal.
- Estrategia conceptual de actualizaciones.
- Validacion de perifericos por sistema operativo.

### Tipo D

- Ambos flujos.
- Coordinacion de versiones Web/Electron/API.
- Administracion en Web.
- Operacion caja/POS en Electron.
- Matriz de compatibilidad por version.

## Recomendacion

Adoptar Tipo D como modelo objetivo para clientes con caja fisica. Mantener Tipo A como modelo principal para administracion y clientes sin caja fisica critica. Usar Tipo B solo para clientes que realmente operan todo desde terminal desktop dedicada.
