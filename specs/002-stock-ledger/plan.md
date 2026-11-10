# Plan de Arquitectura Técnica: 002 - Libro Mayor de Stock, Valorización y Mapa WMS

> **Fase Spec-Kit**: `2B. Plan (Cómo Técnico)`
> **Regla Anti-Espagueti**: En el ERP viejo, `StockDashboard.tsx` tenía **1.877 líneas** y `WarehouseMap.tsx` + `depositomapaData.ts` sumaban **9.375 líneas**. Aquí se divide en módulos cohesivos donde ningún archivo `.ts`/`.tsx` supera las **250 líneas** (los datos estáticos de la matriz viven en un `.json`).

---

## 1. Mapa de Archivos a Crear / Modificar (< 250 líneas por archivo)

### Backend (`backend/src/modules/stock/`)
1. `backend/prisma/schema.prisma`: Agregar modelos `ProductLot` y `StockLedger`.
2. `backend/src/modules/stock/stock.schema.ts` (~85 líneas): Validadores `Zod` para consulta de stock/valorización, ajuste individual, inventario rápido en lote y asignación de slot WMS.
3. `backend/src/modules/stock/stock.engine.ts` (~135 líneas): Motor matemático puro con `Decimal.js` para valorización de unidades vs. pesables (`unidades * approxWeightKg * $/kg`), cálculo de margen latente, estado de stock (`OK` | `LOW` | `OUT`) y estado FEFO de vencimiento (`OK` | `EXPIRING_SOON` | `EXPIRED`).
4. `backend/src/modules/stock/stock.engine.test.ts` (~120 líneas): Suite `Vitest` que certifica la valorización exacta de hormas pesables (`0001`), artículos por unidad (`0028`) y la invariante del Libro Mayor (`Stock Físico == Suma de Lotes == Suma de Movimientos`).
5. `backend/src/modules/stock/stock.service.ts` (~220 líneas): Gestión en memoria sincronizada con `catalogService` de lotes (`ProductLot`), movimientos inmutables (`StockLedger`), inventario rápido en lote y ubicación por slot (`D1`, `D2`, `D3`).
6. `backend/src/modules/stock/stock.controller.ts` (~95 líneas): Controlador delgado HTTP.
7. `backend/src/modules/stock/stock.routes.ts` (~35 líneas): Rutas Express montadas en `/api/stock`.

### Frontend (`frontend/src/modules/stock/`)
1. `frontend/src/modules/stock/types.ts` (~95 líneas): Tipos de Stock, Lotes, Kárdex (`StockLedgerEntry`), KPIs de Valorización y Slots del Mapa.
2. `frontend/src/modules/stock/api.ts` (~105 líneas): Cliente HTTP tipado para `/api/stock`.
3. `frontend/src/modules/stock/components/StockKpiCards.tsx` (~110 líneas): Las 5 tarjetas superiores minimalistas (`Unidades Físicas`, `Valorización Costo`, `Valorización Venta`, `Margen Latente`, `Catálogo de Productos`).
4. `frontend/src/modules/stock/components/StockAdjustModal.tsx` (~190 líneas): Modal limpio para ingreso/egreso/ajuste manual con lote, vencimiento y slot opcionales + vista de Kárdex (historial de movimientos del producto).
5. `frontend/src/modules/stock/components/StockDashboardTab.tsx` (~235 líneas): Barra de filtros (`Todos / Stock Bajo / Agotados / Vencimientos`), botón `📝 Modo Inventario Rápido` (edición masiva en grilla), botón `Auditoría Global` y tabla de valorización.
6. `frontend/src/modules/stock/data/deposito-mapa.json` + `deposito-mapa.ts` (~45 líneas): Los 210 slots reales de `mapadeposito.xlsx` (`D1`, `D2`, `D3` y cámaras).
7. `frontend/src/modules/stock/components/Slot3DModal.tsx` (~180 líneas): Inspector interactivo de los 3 pisos (`Nivel A - Suelo`, `Nivel B - Medio`, `Nivel C - Altura`) para ubicar o ajustar productos directamente en el rack.
8. `frontend/src/modules/stock/components/WarehouseMapTab.tsx` (~235 líneas): Plano gráfico 2D interactivo (`Planta Completa`, `Depósito 1`, `Depósito 2`, `Depósito 3` y filtros de `Cámara 1/2/3/Estantería`) con panel lateral de inspección.
