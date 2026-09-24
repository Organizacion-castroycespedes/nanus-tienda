# Inventario de componentes frontend POS — B4.2

| Área | Componentes reales | Responsabilidad | Estado |
|---|---|---|---|
| Ruta | `web/app/[tenant]/pos/page.tsx`, `select-context/page.tsx` | Entrada POS y selección de contexto | Implementado |
| Pantalla | `web/modules/pos/components/PosScreen.tsx` | Orquestación de catálogo, carrito, cobro, scanner y feedback | Implementado |
| Contexto | `PosContextSelector.tsx`, `useRequirePosSession.ts`, `usePosContext.ts` | Tenant, sucursal, terminal, caja y sesión POS | Implementado; backend manda |
| Store contexto | `web/store/pos.ts` | Estado y persistencia de contexto POS | Implementado |
| Store carrito | `web/store/posCart.ts`, `usePosCartStore.ts` | Ítems, pagos, cliente y estado de envío | Implementado |
| Cobro | `PaymentDialog.tsx`, `PaymentSummarySidebar.tsx`, `pos-payment-rules.ts` | Distribución visual, validación y confirmación | Implementado; validación final backend |
| Catálogo | `pos.service.ts`, servicios de productos/clientes/taxes | Carga de datos auxiliares | Implementado |
| Precio | `previewPosLinePrice`, `refreshCartItemPricing` | Previsualización por línea | Implementado; no autoritativo |
| Scanner | `pos-scanner.ts`, `pos-scanner-wedge.ts`, `pos-scanner-hid.ts` | Normalización, matching y captura rápida | Implementado/configurado |
| Balanza | lógica de `handleReadScaleForProduct` y contratos periféricos | Aplicar peso al producto pesable | Configurado/simulado según flags |
| Periféricos | `pos-sale-integration.ts`, `contracts.ts` | Ticket y cajón después de venta | Contrato implementado; Agent/hardware no verificados |
| Filtros | `usePosFiltersStorage.ts` | Persistencia de filtros de UI | Implementado |
| UX | `useDraggableFloatingControl.ts`, `product-added-sound.ts` | Controles flotantes y feedback local | Implementado |

## Pruebas existentes

Se encontraron pruebas unitarias para `posCart`, `pos`, contexto de sesión,
scanner wedge/HID, clasificación de producto, reglas de pago, descuentos y
contratos periféricos. No se ejecutaron por restricción de la fase. No sustituyen
prueba E2E de venta, caja, timeout, Agent o hardware.

## Límites

No se encontró un store frontend que reserve stock remoto. Tampoco se encontró
un mecanismo frontend que confirme impresión antes de marcar venta confirmada.
