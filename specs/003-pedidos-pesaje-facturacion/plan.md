# Plan Técnico de Implementación (`003-pedidos-pesaje-facturacion`)

## 1. Mapa de Archivos Modulares (< 250 Líneas por Archivo)

### Backend (`backend/src/modules/orders/`)
1. `orders.schema.ts` (< 120 líneas): Contratos `Zod` para creación de pedidos, cambio de estado, pesaje/confirmación de armado y facturación directa.
2. `orders.engine.ts` (< 220 líneas): Motor matemático puro con `Decimal.js`:
   - `calculateOrderItemSubtotal`: Calcula subtotal entero (`quantity * unitPrice` para no pesables; `actualWeightKg * unitPrice` o `quantity * approxWeightKg * unitPrice` para pesables).
   - `detectWeightAnomalies`: Detecta desvíos de balanza (`> 2x` o `< 0.3x` del peso esperado) y calcula `possibleDecimalFix` (`/ 10` o `/ 100`).
   - `calculateAfipBreakdown`: Calcula desglose técnico AFIP (`netoGravado`, `ivaAmount`, `iibbPerceptionAmount`, `totalAmount`) garantizando `neto + iva + iibb == totalAmount` al centavo.
3. `orders.engine.test.ts` (< 180 líneas): Suite `Vitest` probando pesajes en balanza, detector de coma faltante, snapshots inmutables y desglose AFIP.
4. `orders.service.ts` (< 250 líneas): Servicio de dominio que carga los 1.626 clientes reales, gestiona los pedidos en memoria/DB, ejecuta el descuento de stock en `StockService` al facturar y revierte stock al cancelar.
5. `orders.service.test.ts` (< 150 líneas): Pruebas integrales de flujo de pedido -> armado con pesaje -> descuento en `StockLedger` -> cancelación y reversión de stock.
6. `orders.controller.ts` & `orders.routes.ts` (< 120 líneas cada uno): Controladores HTTP delgados montados en `/api/orders`.

### Frontend (`frontend/src/modules/orders/`)
1. `types.ts` & `api.ts` (< 160 líneas cada uno): Tipos y cliente HTTP tipado.
2. `utils/printHelpers.ts` (< 230 líneas): Impresores limpios en ventana de impresión para:
   - `printBatchPickingA4` (Lote de Picking A4)
   - `printConsolidatedPickingA4` (Consolidado de Depósito A4)
   - `printShippingLabelsBultos` (Rótulos adhesivos para bultos)
   - `printInvoiceA4` (Factura Oficial A4 con CAE / Boleta Remito X A4)
   - `printOrderTicket80mm` (Ticket térmico de 80mm)
3. `components/FulfillmentKanbanTab.tsx` (< 240 líneas): Pestaña `Armado de Pedidos` con barra de filtros de alta densidad (`Ruta`, `Vendedor`, `Zona: ❄️ Frío / 📦 Cajas / 🍾 Tabla`), botones `Lote A4`, `Consolidado` y `🏷️ Rótulos Bultos`, y las 3 columnas Kanban (`Pendientes`, `En Picking`, `Facturados Hoy`).
4. `components/OrderFulfillmentModal.tsx` (< 240 líneas): Modal `Confirmar Armado y Facturar` con inputs de kg para ítems pesables, banner `⚠️ Advertencia: Peso muy superior al promedio esperado` + botón `🪄 Corregir coma faltante`, y selector `Sucursal X` / `Sucursal A`.
5. `components/OrdersHistoryTab.tsx` (< 190 líneas): Pestaña `Historial` con buscador, filtro de estados, tabla limpia y acciones.
6. `components/BillingInvoicesTab.tsx` (< 190 líneas): Pestaña `Facturación` con filtro `Todos / Oficiales (A/B) / Internos (Presup.)`, tabla con desglose de Neto, IVA, IIBB y Total, y botón `+ Emitir Factura Directa`.
7. `components/OrderPosModal.tsx` (< 240 líneas): Modal ágil de `Tomar Pedido` / `Emitir Factura Directa` con buscador fonético de los 1.626 clientes y 424 productos.
8. `OrdersBillingPage.tsx` (< 130 líneas): Contenedor principal con las 3 pestañas minimalistas (`Armado de Pedidos`, `Historial`, `Facturación`).
