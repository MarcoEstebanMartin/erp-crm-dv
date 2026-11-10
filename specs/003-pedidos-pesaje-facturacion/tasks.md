# Checklist de Implementación (`003-pedidos-pesaje-facturacion`)

- [x] **T001**: Extraer y normalizar el padrón real de **1.626 clientes** y **6 vendedores** desde `reference/erp-crm-dv/prisma/clients_data.json` hacia `backend/src/modules/orders/data/raw-don-venancio-clients.json`.
- [x] **T002**: Implementar contratos `Zod` (`orders.schema.ts`) y el motor matemático `OrderEngine` (`orders.engine.ts`) con cálculo de pesables, detector de coma faltante (`detectWeightAnomalies`), congelamiento de snapshots y desglose fiscal AFIP (`calculateAfipBreakdown`).
- [x] **T003**: Crear y ejecutar suite unitaria `orders.engine.test.ts` en `Vitest`.
- [x] **T004**: Implementar `OrdersService` (`orders.service.ts`) conectado con `CatalogService` y `StockService` (con los 18 pedidos iniciales listos para armar, descuento real en `StockLedger` al facturar y reversión al cancelar) + tests `orders.service.test.ts`.
- [x] **T005**: Implementar `orders.controller.ts`, `orders.routes.ts` y montar `/api/orders` en `backend/src/app.ts`.
- [x] **T006**: Construir módulo Frontend `frontend/src/modules/orders/` (`types.ts`, `api.ts`, `printHelpers.ts`, `FulfillmentKanbanTab.tsx`, `OrderFulfillmentModal.tsx`, `OrdersHistoryTab.tsx`, `BillingInvoicesTab.tsx`, `OrderPosModal.tsx` y `OrdersBillingPage.tsx`).
- [x] **T007**: Conectar `Pedidos y Facturación` en `App.tsx` y vincular los contadores en vivo (`18 PEDIDOS RECIBIDOS`, `EN ARMADO / PICKING`, `FACTURADOS & DESPACHOS`) y botones `Tomar Pedido` / `Facturar Directo` en `DashboardPage.tsx`. Verificar `tsc --noEmit` (0 errores) y `vitest run` (100% green).
