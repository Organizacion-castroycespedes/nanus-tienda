# Matriz de contratos Web-API POS — B4.2

| Acción UI | Componente/función | Cliente y contrato | Backend/controles | Efecto y error |
|---|---|---|---|---|
| Cargar productos | `PosScreen` / `getPosProducts` | `GET /products?branchId=` | Productos e inventario; autorización backend | Catálogo local; error de carga |
| Cargar clientes | `getPosCustomers` | `GET /customers` | Clientes tenant | Lista local; error de catálogo |
| Vista previa de línea | `refreshCartItemPricing` | `POST /pricing/preview-line`, canal `POS` | Pricing, impuestos y promociones | Línea `READY`, `PENDING` o `ERROR` |
| Seleccionar contexto | `PosContextSelector` | `GET /auth/context`, caja y sesión actual | Tenant, sucursal, terminal, caja | Redux `pos`; error bloquea contexto |
| Abrir caja | `handleConfirm` | Servicio de cash session | Reglas de caja y permisos | Caja abierta; error visible |
| Crear sesión POS | `createPosSessionRequest` | `POST /pos/session` | Sesión POS | Guarda `posSessionId` |
| Agregar por scanner | `handleScannerCodeRead` | Catálogo ya cargado; no API directa | Matching local | Incrementa carrito o toast |
| Confirmar venta | `submitSale` / `createSale` | `POST /sales`, `Idempotency-Key`, `includePosSession` | Guards, precio, pagos, stock, caja, outbox | Venta persistida o estado incierto |
| Reconciliar venta | `reconcileUnknownSale` / `reconcileSale` | `GET /sales/idempotency/:key` | Tenant + clave | Confirma o conserva `UNKNOWN` |
| Imprimir ticket | `runSalePeripheralOperations` | Contrato periférico después de 2xx | Agent/Electron según entorno | Feedback; no rollback |
| Abrir cajón | `runSalePeripheralOperations` | Contrato periférico si hay efectivo | Agent/Electron según entorno | Feedback; no rollback |

## Propagación

`apiClient` agrega `Authorization: Bearer`. Para `createSale` y reconciliación
agrega `x-pos-session-id` desde el estado persistido. El cuerpo lleva tenant,
sucursal, terminal y caja según DTO/contexto, pero el backend vuelve a validar.

La vista previa de precio no es una reserva. El scanner no crea una venta. La
impresión no forma parte del commit de `POST /sales`.

## Diferencias verificadas

- Web envía `price` y taxes de la previsualización, pero B4.1 confirma que el
  backend calcula y valida el snapshot autoritativo.
- Web marca `CONFIRMED` y limpia carrito al recibir respuesta exitosa; la
  impresión ocurre después y puede fallar sin cambiar ese estado.
- La UI exige total cubierto incluso cuando el backend distingue `CASH` y `CREDIT`.
  La venta parcial no queda demostrada como experiencia soportada por este POS.
