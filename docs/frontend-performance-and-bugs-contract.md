# Documento de Especificación Técnica: Diagnóstico de Errores, Evaluación de Carga y Contrato de Optimización Frontend

- **Proyecto**: ManusTienda Platform (`web/`)
- **Fecha**: 2026-09-27
- **Rama de Referencia**: `perf/frontend-modular-optimization` (worktree `nanus-tienda-perf-frontend`)
- **Estado**: Especificación y corrección documentada para aplicación / cutover

---

## 1. Resumen Ejecutivo y Diagnóstico de Errores en Consola

Durante el arranque y navegación en el frontend de Next.js, se detectaron las siguientes anomalías en consola y tiempos de reconstrucción:

```text
login:1 Autofocus processing was blocked because a document already has a focused element.
contracts.ts:612 WebSocket connection to 'ws://localhost:4050/peripherals' failed: WebSocket is closed before the connection is established.
hot-reloader-client.js:187 [Fast Refresh] rebuilding ... done in 1226ms
```

A continuación se detalla la causa raíz, impacto y parche exacto para cada uno de estos incidentes.

---

## 2. Catálogo Detallado de Bugs y Correcciones

### Bug 1: Advertencia de Autofocus Bloqueado en Login
- **Archivo afectado**: [`web/app/login/page.tsx`](file:///l:/Proyectos/sociedad/nanus-tienda/web/app/login/page.tsx)
- **Causa Raíz**: Conflicto de doble foco concurrente en el ciclo de vida del componente:
  1. En la línea 268, el `<input id="email">` poseía el atributo HTML nativo `autoFocus`.
  2. En las líneas 54-58, un efecto `useEffect(() => { emailInputRef.current?.focus(); }, [])` forzaba el foco imperativo al montarse.
  El motor de renderizado del navegador (Chromium/Gecko) bloqueaba el segundo evento generando la advertencia `Autofocus processing was blocked because a document already has a focused element`.
- **Solución Aplicada**: Eliminar el atributo `autoFocus` del elemento input y delegar el foco de forma limpia al `useEffect` con `ref`.
- **Diff de Corrección**:
```diff
--- a/web/app/login/page.tsx
+++ b/web/app/login/page.tsx
@@ -265,7 +265,6 @@ const LoginPageContent = () => {
                   id="email"
                   name="email"
                   type="email"
-                  autoFocus
                   ref={emailInputRef}
                   autoComplete="email"
                   value={email}
```

---

### Bug 2: Fallo y Bucle de Reconexión de WebSocket en Periféricos
- **Archivo afectado**: [`web/domains/peripherals/contracts.ts`](file:///l:/Proyectos/sociedad/nanus-tienda/web/domains/peripherals/contracts.ts)
- **Causa Raíz**:
  1. En React 18 StrictMode / Fast Refresh en desarrollo, los efectos se montan, desmontan y vuelven a montar (`legacyCommitDoubleInvokeEffectsInDEV`).
  2. Cuando la función de limpieza del efecto llamaba a `socket.close()` mientras el socket aún estaba en estado `WebSocket.CONNECTING` (handshake TCP pendiente), el navegador lanzaba `WebSocket connection to 'ws://localhost:4050/peripherals' failed: WebSocket is closed before the connection is established.`
  3. Al cerrarse, `socket.onclose` se disparaba sin verificar si el cierre fue intencional (`stopped = true`), programando un reintento síncrono inmediato y saturando la consola si el servicio de hardware local (`backend-perifericos` en puerto 4050) no estaba activo.
- **Solución Aplicada**:
  1. Guardas con bandera `stopped` en los callbacks `onopen`, `onmessage`, `onerror` y `onclose`.
  2. Limpieza de listeners de eventos (`onopen = null`, `onerror = null`, `onclose = null`) antes de invocar `close()`.
  3. Backoff exponencial de reconexión (iniciando en 2s hasta máximo 30s) para evitar sobrecarga en cliente cuando el agente está desconectado.
- **Diff de Corrección**:
```diff
--- a/web/domains/peripherals/contracts.ts
+++ b/web/domains/peripherals/contracts.ts
@@ -546,7 +546,7 @@ export const subscribePeripheralEvents = (
         return;
       }
 
-      const delayMs = Math.min(1000 * 2 ** reconnectAttempt, 10_000);
+      const delayMs = Math.min(2000 * 2 ** Math.min(reconnectAttempt, 4), 30_000);
       reconnectAttempt += 1;
       reconnectTimer = setTimeout(() => {
         reconnectTimer = null;
@@ -564,6 +564,14 @@ export const subscribePeripheralEvents = (
         socket = new WebSocket(config.wsUrl);
 
         socket.onopen = () => {
+          if (stopped) {
+            try {
+              socket?.close();
+            } catch {
+              // ignore
+            }
+            return;
+          }
           reconnectAttempt = 0;
           options.onStatus?.("CONNECTED");
         };
@@ -570,4 +578,7 @@ export const subscribePeripheralEvents = (
         socket.onmessage = (event) => {
+          if (stopped) {
+            return;
+          }
           callback(parseSocketEvent(event));
         };
 
@@ -574,3 +585,6 @@ export const subscribePeripheralEvents = (
         socket.onerror = () => {
+          if (stopped) {
+            return;
+          }
           options.onStatus?.("DISCONNECTED");
           emitSubscriptionError(
             callback,
@@ -581,6 +595,9 @@ export const subscribePeripheralEvents = (
 
         socket.onclose = () => {
           socket = null;
+          if (stopped) {
+            return;
+          }
           options.onStatus?.("DISCONNECTED");
           scheduleReconnect();
         };
@@ -587,3 +604,6 @@ export const subscribePeripheralEvents = (
       } catch (error) {
+        if (stopped) {
+          return;
+        }
         options.onStatus?.("DISCONNECTED");
         emitSubscriptionError(
           callback,
@@ -603,8 +623,24 @@ export const subscribePeripheralEvents = (
         reconnectTimer = null;
       }
       options.onStatus?.("DISCONNECTED");
-      socket?.close();
-      socket = null;
+      if (socket) {
+        const currentSocket = socket;
+        socket = null;
+        currentSocket.onopen = null;
+        currentSocket.onmessage = null;
+        currentSocket.onerror = null;
+        currentSocket.onclose = null;
+        if (
+          currentSocket.readyState === WebSocket.OPEN ||
+          currentSocket.readyState === WebSocket.CONNECTING
+        ) {
+          try {
+            currentSocket.close();
+          } catch {
+            // ignore
+          }
+        }
+      }
     };
   } catch (error) {
```

---

### Bug 3: Conexión Indiscriminada de Hardware en el Layout Global
- **Archivo afectado**: [`web/app/[tenant]/layout.tsx`](file:///l:/Proyectos/sociedad/nanus-tienda/web/app/[tenant]/layout.tsx)
- **Causa Raíz**: El componente `TenantLayout` iniciaba `subscribePeripheralEvents` y `getPeripheralDevices()` en **todas las páginas** de la aplicación (incluso en administración de usuarios, roles, catálogo, domicilios, etc.) sin validar previamente si las funciones de periféricos estaban habilitadas o si la ruta requería hardware activo.
- **Solución Aplicada**: Importar `getPeripheralFeatureFlags` y condicionar el inicio de sockets y llamadas HTTP de dispositivos a `flags.peripheralsEnabled`.
- **Diff de Corrección**:
```diff
--- a/web/app/[tenant]/layout.tsx
+++ b/web/app/[tenant]/layout.tsx
@@ -78,6 +78,7 @@ import { Toast, type ToastVariant } from "../../components/design-system/Toast";
 import type { CashSession } from "../../modules/finance/types";
 import {
   getPeripheralDevices,
+  getPeripheralFeatureFlags,
   subscribePeripheralEvents,
   type PeripheralSocketStatus,
 } from "../../domains/peripherals/contracts";
@@ -271,6 +272,11 @@ const TenantLayout = ({ children }: { children: ReactNode }) => {
   }, []);
 
   useEffect(() => {
+    const flags = getPeripheralFeatureFlags();
+    if (!flags.peripheralsEnabled) {
+      setPrinterSocketStatus("DISCONNECTED");
+      return;
+    }
     return subscribePeripheralEvents(() => undefined, {
       onStatus: setPrinterSocketStatus,
     });
@@ -279,7 +285,8 @@ const TenantLayout = ({ children }: { children: ReactNode }) => {
     let cancelled = false;
 
     const loadPrinterName = async () => {
-      if (!authUser?.tenantId) {
+      const flags = getPeripheralFeatureFlags();
+      if (!flags.peripheralsEnabled || !authUser?.tenantId) {
         setPrinterName(null);
         return;
       }
```

---

### Bug 4: Lag de Renderizado en Búsqueda de Catálogo POS
- **Archivo afectado**: [`web/modules/pos/components/PosScreen.tsx`](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/pos/components/PosScreen.tsx)
- **Causa Raíz**: En `PosScreen.tsx` (monolito de 3,319 líneas), la variable `query` estaba atada directamente al cálculo síncrono del hook `useMemo` de `filteredProducts`. En catálogos con cientos de productos, cada letra tipeada en el buscador bloqueaba el hilo principal de React recalculando textos, códigos de barras e imágenes.
- **Solución Aplicada**: Introducir `useDeferredValue(query)` de React 18 para desacoplar el renderizado del input del filtrado computacional intensivo del catálogo.
- **Diff de Corrección**:
```diff
--- a/web/modules/pos/components/PosScreen.tsx
+++ b/web/modules/pos/components/PosScreen.tsx
@@ -19,6 +19,7 @@ import {
 } from "lucide-react";
 import {
   useCallback,
+  useDeferredValue,
   useEffect,
   useMemo,
   useRef,
@@ -1119,9 +1120,11 @@ export const PosScreen = () => {
     };
   }, [products]);
 
+  const deferredQuery = useDeferredValue(query);
+
   const filteredProducts = useMemo(() => {
     return filterPosProductsForCatalog(products, {
-      query,
+      query: deferredQuery,
       stockFilter: activeStockFilter,
       categoryId: selectedProductCategoryId,
       subcategoryId: selectedProductSubcategoryId,
@@ -1132,8 +1135,8 @@ export const PosScreen = () => {
     });
   }, [
     activeStockFilter,
+    deferredQuery,
     products,
-    query,
     selectedProductCategoryId,
     selectedProductSubcategoryId,
   ]);
@@ -1144,7 +1147,7 @@ export const PosScreen = () => {
   useEffect(() => {
     setVisibleProductCount(POS_CATALOG_PAGE_SIZE);
   }, [
-    query,
+    deferredQuery,
     activeStockFilter,
     selectedProductCategoryId,
     selectedProductSubcategoryId,
```

---

## 3. Matriz de Evaluación de Carga por Módulo Frontend

A continuación se resume la auditoría de carga, costo de renderizado y recomendaciones arquitectónicas para los 9 módulos principales de la aplicación:

| Módulo | Tamaño / LOC | Peticiones HTTP en Carga | Cuellos de Botella Detectados | Plan de Mejora Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| **1. Shell & Root Layout** | 1,799 LOC (72.9 KB) | 8 peticiones en paralelo (`getTenantConfig`, `getTenantDetails`, `resolveTenantSettings`, `fetchProfile`, `fetchMenu`, `fetchPermissions`, `getCurrentCashSession`, `resolveCurrentPosTerminalConfig`) | Monolito de navegación. Re-renderizado completo de la shell ante cambios en estado del carrito o sesión. | Dividir `layout.tsx` en `TenantSidebar`, `TenantHeader`, `TenantProfileModals`. Consolidar bootstrap en un único endpoint de hidratación. |
| **2. Punto de Venta (POS)** | 3,319 LOC (114.1 KB) | `getPosProducts`, `getPosCustomers`, `getPosTaxes`, `listPaymentMethods`, `listFinancialInstitutions`, `getCurrentCashSession`, `fetchSystemVersion` | Carga de catálogo completo en memoria; filtrado lineal sin virtualización; listeners de teclado HID y WS concurrentes. | Modularizar en `PosCatalogHeader`, `PosProductGrid`, `PosFloatingControls`, `PosPaymentWorkflow`. Aplicar `useDeferredValue` (ya implementado) y evaluar `react-window` para >2,000 SKUs. |
| **3. Autenticación & Login** | 377 LOC (15.7 KB) | `/auth/login`, `/auth/replace-session`, `/auth/me` | Conflicto de doble foco al montar. | Resuelto con eliminación de `autoFocus` redundante. |
| **4. Configuración & Tenant** | 102.4 KB monolito | Configuración general, parámetros, facturación DIAN, plantillas de impresión | Componente masivo con decenas de campos reactivos sin memoizar; recompilaciones lentas de Fast Refresh. | Dividir en subrutas anidadas o tabs lazy (`configuracion/general`, `configuracion/dian`, `configuracion/impresion`) usando `next/dynamic`. |
| **5. Inventario, Catálogo & BI** | 6 componentes (220+ KB) | `listProducts`, `listCategories`, `listSubcategories`, `listLocations`, `listLots`, `listValuation` | Carga síncrona de librería de gráficos `recharts` aumentando el chunk inicial a 229 KB. | Carga diferida de gráficos con `next/dynamic({ ssr: false })` y modales de producto/proveedor bajo demanda. |
| **6. Finanzas & Arqueos** | 5 vistas (100+ KB) | `getCashSessions`, `getCurrentShift`, `listCashMovements`, `listPaymentMethods` | Recálculo en tiempo real de denominaciones de efectivo en formularios de cierre de caja. | Memoización de sumatorias de billetes/monedas con `React.memo` y selectores puros. |
| **7. Domicilios & Despachos** | 4 componentes (110+ KB) | `listOrders`, `listDeliveries`, `listDeliveryDrivers` | Renderizado reactivo repetido de tarjetas de despacho ante cambios de estado de un solo repartidor. | Memoizar `DeliveryRelationCard` y aislar mutaciones de socket/polling de asignaciones. |
| **8. Ventas Operativas & Facturación** | 3 vistas (60+ KB) | `listOperationalSales`, `getSaleDetail`, `previewInvoice` | Pasos de wizard de prefactura cargados juntos en el árbol inicial. | Hidratación diferida por paso en `PreInvoiceWizardModal`. |
| **9. Reportes & Analítica** | 6 páginas (70+ KB) | `/reporteria/caja`, `/clientes`, `/compras`, `/pedidos`, `/pos` | Generación síncrona de tablas grandes de auditoría y reportes. | Paginación del lado del servidor y exportación en streaming. |

---

## 4. Runbook de Verificación y Aplicación

Para aplicar o validar estos cambios en cualquier entorno:

1. **Revisar estado en el worktree**:
   ```bash
   cd L:\Proyectos\sociedad\nanus-tienda-perf-frontend\web
   git status
   ```
2. **Ejecutar Linter**:
   ```bash
   npm run lint
   ```
   *Debe arrojar: `✔ No ESLint warnings or errors`.*
3. **Ejecutar Pruebas Unitarias**:
   ```bash
   npx tsx --test **/*.spec.ts
   ```
   *Debe arrojar: `274 pass, 0 fail`.*
4. **Ejecutar Compilación de Producción**:
   ```bash
   npm run build
   ```
   *Debe compilar las 52 rutas estáticas y dinámicas sin errores de tipos TypeScript.*
