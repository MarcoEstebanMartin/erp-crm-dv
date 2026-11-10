# Lista de Tareas Ejecutables: 002 - Libro Mayor de Stock, Valorización y Mapa WMS

> **Fase Spec-Kit**: `3. Tasks (Ejecución Secuencial)`
> **Regla**: Ninguna tarea se marca `[x]` sin compilación limpia (`tsc --noEmit`) y tests en verde (`vitest run`).

---

## Bloque 1: Motor Matemático `StockEngine` y Tests Unitarios (`Vitest`)
- [x] **T001**: Actualizar `backend/prisma/schema.prisma` con `ProductLot` y `StockLedger` y definir contratos `Zod` en `backend/src/modules/stock/stock.schema.ts`.
- [x] **T002**: Implementar `backend/src/modules/stock/stock.engine.ts` con `Decimal.js` (valorización exacta de unidades y pesables `unidades * approxWeightKg * $/kg`, alertas FEFO a 30 días y verificación de invariante `Stock == Suma(Lotes)`).
- [x] **T003**: Crear y ejecutar suite `backend/src/modules/stock/stock.engine.test.ts` certificando que 10 hormas de Barra Tybo (`4.2 kg`) se valorizan exactamente en `$280.560` costo / `$350.700` venta y que ningún movimiento rompe la invariante del Libro Mayor.

## Bloque 2: Servicio `StockLedger`, Semilla de Lotes/Slots y API (`Express`)
- [x] **T004**: Implementar `backend/src/modules/stock/stock.service.ts`, `stock.controller.ts`, `stock.routes.ts` y crear `stock.service.test.ts` (`Vitest`), montando `/api/stock` en `backend/src/app.ts`.

## Bloque 3: Pestañas Minimalistas `Control y Valorización de Stock` + `🗺️ Mapa Interactivo Depósito`
- [x] **T005**: Crear `frontend/src/modules/stock/types.ts`, `api.ts`, `StockKpiCards.tsx`, `StockAdjustModal.tsx` y `StockDashboardTab.tsx` (< 240 líneas c/u).
- [x] **T006**: Extraer la matriz real de 210 slots (`D1`, `D2`, `D3`) a `frontend/src/modules/stock/data/deposito-mapa.json` y construir `WarehouseMapTab.tsx` + `Slot3DModal.tsx` (< 240 líneas c/u).
- [x] **T007**: Integrar las 4 pestañas (`Lista de Productos`, `Control y Valorización de Stock`, `🗺️ Mapa Interactivo Depósito`, `Productos Inactivos`) en `CatalogPage.tsx` y certificar `tsc --noEmit` (0 errores) + `Vitest` (100% pass).
