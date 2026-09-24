# Inventario de componentes AS-IS

## Matriz principal

| Componente | Ubicación | Tecnología | Responsabilidad | Dependencias | Estado |
|---|---|---|---|---|---|
| Web SaaS | `web/` | Next.js 14, React 18, Redux Toolkit | UI por tenant, POS, inventario, caja, reportes y administración | API `/api`, browser storage | Implementado; QA funcional por flujo |
| API principal | `api/` | NestJS 10, TypeScript, `pg` | Owner de operación, auth, RBAC, catálogo, ventas, compras, caja y contexto POS | PostgreSQL; servicios internos | Implementado |
| Base SQL histórica | `api/database/` | PostgreSQL SQL | Esquema base, auth, menú y auditoría histórica | `psql` | Implementado/configuración histórica |
| Pipeline SQL | `scripts/database/` | Bash, `psql`, SQL | Migraciones versionadas, seeds, rollback y bootstrap | PostgreSQL, env externo | Configurado; ejecución externa no verificada |
| Dump QA | `database/manus_tienda_qa.sql` | PostgreSQL dump | Evidencia de estado QA | Base QA | Evidencia; no es runner |
| ReporterÍa | `backend-reporteria/` | NestJS, `pg`, PDFMake, ExcelJS | Reportes, exportaciones y tickets | PostgreSQL, JWT | Implementado; despliegue no verificado |
| Facturación electrónica | `backend-facturacion-electronica/` | NestJS, `pg` | Bounded context fiscal, eventos, estados y proveedores | API, PostgreSQL, provider configurado | Implementado parcial; mock/fixture |
| Integration Outbox | `api/src/modules/integration-outbox/` | Servicios NestJS + SQL | Publicar eventos de ventas hacia facturación con retry | `integration_outbox_events`, backend FE | Implementado/configurado |
| Electron shell | `desktop/electron/` | Electron, TypeScript | Cargar web online y exponer IPC limitado | URL web, agente local | Implementado online |
| Peripheral Agent | `backend-perifericos/` | NestJS, TypeScript | Dispositivos, impresión, cajón, scanner y balanza | OS, drivers, loopback | Implementado; MOCK por defecto |
| Instalador Windows | `backend-perifericos/windows-installer/` | Go, WebView/UI, recursos empaquetados | Instalación y runtime Windows | Windows, recursos POS | Código/artefactos presentes; QA no ejecutado |
| Drivers | `util/driver/impresoras/` | Paquetes de terceros | Soporte de impresoras XPrinter | OS y licencias externas | Presente; licencias por revisar |

## Módulos de negocio conocidos

Confirmados en API y/o frontend:

- Autenticación, refresh tokens y sesiones activas.
- Tenants, branding, sucursales y ubicaciones.
- Usuarios, roles, menú y permisos.
- Terminales y sesiones POS.
- Productos, categorías, subcategorías, unidades e impuestos.
- Clientes y proveedores.
- Precios, historial de precios y promociones.
- Inventario, lotes, FEFO, ubicaciones, saldos y ajustes.
- Compras y recepción parcial.
- Pedidos, domicilios, conductores y estados de despacho.
- Ventas POS, pagos, cancelación e idempotencia.
- Caja, sesiones, arqueos, movimientos y métodos de pago.
- ReporterÍa operacional, inventario, compras, pedidos, ventas y caja.
- Documentos y estados de facturación electrónica.

## Fuera de alcance confirmado

- Offline y sincronización offline.
- Aplicación Android nativa.
- DIAN productivo certificado.
- Auto-update Electron.
- Firma productiva de instaladores.
- Hardware físico certificado para todos los modelos.
