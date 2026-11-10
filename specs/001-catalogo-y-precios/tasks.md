# Lista de Tareas Ejecutables: 001 - Catálogo Maestro y Motor de Precios

> **Fase Spec-Kit**: `3. Tasks (Ejecución Secuencial)`
> **Regla**: Ninguna tarea se marca `[x]` sin compilación limpia (`tsc --noEmit`) y tests en verde (`vitest run`).

---

## Bloque 1: Motor Matemático Puro y Tests Unitarios (`Vitest`)
- [x] **T001**: Definir contratos y validadores `Zod` en `backend/src/modules/catalog/catalog.schema.ts` (< 120 líneas).
- [x] **T002**: Implementar `backend/src/modules/catalog/pricing.engine.ts` con `Decimal.js` (Mini-calculadora de proveedor, recálculo de margen real, cálculo de `Lista 4`, `Lista Especial 1 (-3% Melincué)`, `Lista Especial 2 (-5% Melincué)`, regla híbrida por caja `unitsPerBox` y simulador de aumento masivo).
- [x] **T003**: Crear y ejecutar suite `backend/src/modules/catalog/pricing.engine.test.ts` usando casos reales de `Maestro1.xlsx` (`0001` Barra Tybo Melincué, `0028` Baggio, `0100` Fiambre Cerdo) hasta lograr **100% pass en `Vitest`**.

## Bloque 2: Esquema Prisma, Saneador de Datos Reales y API (`Express + Zod`)
- [x] **T004**: Actualizar `backend/prisma/schema.prisma` con los modelos `Category`, `Product`, `PriceHistory` y `AuditLog` (tipos exactos `Decimal(14,2)` y `Decimal(12,3)`).
- [x] **T005**: Construir el importador/saneador `backend/src/modules/catalog/catalog.seed-importer.ts` que unifica los 424 productos reales de `OFERTAS APP` con los costos, proveedores (`REMOTTI`, `CREMIGAL`, `R.P.B`, `SODECAR`) y zonas (`FRIO` / `SECO`) de `Maestro1.xlsx`, corrigiendo todos los márgenes y redondeando centavos residuales.
- [x] **T006**: Implementar `backend/src/modules/catalog/catalog.service.ts`, `catalog.controller.ts` y `catalog.routes.ts` (búsqueda fonética instantánea, edición individual con `PriceHistory` + `AuditLog`, aumento masivo por Proveedor/Rubro con preview y exportación CSV/Excel).

## Bloque 3: Interfaz Operativa Rápida (`React + Tailwind + Teclado`) y Joyas Rescatadas
- [x] **T007**: Crear `SupplierCostCalculatorModal.tsx` y `BulkPriceUpdateModal.tsx` (< 250 líneas c/u) con vista previa comparativa *Antes vs. Después*.
- [x] **T008**: Construir `CatalogPage.tsx` y `CatalogToolbar.tsx` (< 250 líneas c/u) con buscador fonético (`F2`), filtros por Proveedor y Zona (`FRIO`/`SECO`), columnas de `Lista 4`, `Especial 1` y `Especial 2`, navegación por teclado (`↑/↓`, `Enter`, `Esc`) y botón de descarga de Backup Excel/CSV.
- [x] **T009**: Extender Backend (`catalog.schema.ts`, `catalog.service.ts`, `catalog.controller.ts`, `catalog.routes.ts`) con alta de `+ Nuevo Producto`, filtro `statusFilter` (`all` | `active` | `inactive`), activación/desactivación (`PATCH /products/:sku/status`) y tests unitarios en `Vitest`.
- [x] **T010**: Crear `Sidebar.tsx` con fuente `Plus Jakarta Sans` y logo oficial `logo_dv_clean.png` + `QuickPriceSearchModal.tsx` (`Ctrl + Q`).
- [x] **T011**: Crear `PriceListPrintModal.tsx` (Impresor Oficial de `Lista 4` agrupado por `1 - REMOTTI`, `1.1 - LECHES`, `1.2 - SANCOR y CREMIGAL`, `2.7 - BEBIDAS / Bodegas`), `ProductFormModal.tsx` (`+ Nuevo Producto`) y `PhotoLightboxModal.tsx`.
- [x] **T012**: Incorporar en `CatalogPage.tsx` los globitos de emoji por categoría (`🧀`, `🥓`, `❄️`, `🥤`, `🍷`, `🍝`), edición rápida con 1 clic en la celda (`Inline Edit` con Costo Sagrado) y botón `Desactivar / Reactivar`.
- [x] **T013**: Verificación integral de punta a punta con el Usuario (`tsc --noEmit` 0 errores + `vitest` 100% en verde).
