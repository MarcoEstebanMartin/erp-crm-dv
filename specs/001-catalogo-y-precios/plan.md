# Plan Técnico de Implementación: 001 - Catálogo Maestro y Motor de Precios

> **Fase Spec-Kit**: `2B. Plan (Cómo Técnico)`
> **Estado**: `COMPLETO`

---

## 1. Mapa de Archivos a Crear/Modificar (Regla Estricta < 250 Líneas por Archivo)

### Backend (`backend/`)
| Archivo | Líneas Est. | Responsabilidad Única |
| :--- | :--- | :--- |
| `backend/prisma/schema.prisma` | ~140 | Modelos `Category`, `Product`, `PriceHistory` y `AuditLog` con tipos exactos `Decimal(14,2)` y `Decimal(12,3)`. |
| `backend/src/modules/catalog/pricing.engine.ts` | ~160 | **Motor Puro de Dominio (`Decimal.js`)**: Mini-calculadora de costo de proveedor, cálculo de `Lista 4`, `Lista Especial 1`, `Lista Especial 2`, recálculo inverso de margen real, regla de volumen por caja (`unitsPerBox`) y simulador de aumento masivo (*Antes vs. Después*). Cero dependencia de base de datos. |
| `backend/src/modules/catalog/pricing.engine.test.ts` | ~180 | **Suite Unitaria `Vitest`**: Prueba con productos reales de Don Venancio (`0001` Barra Tybo Melincué, `0028` Baggio, `0100` Fiambre Cerdo) todas las invariantes de pesos enteros y márgenes exactos. |
| `backend/src/modules/catalog/catalog.schema.ts` | ~95 | Esquemas `Zod` para validación estricta de búsqueda fonética, edición individual, mini-calculadora y aumentos masivos. |
| `backend/src/modules/catalog/catalog.seed-importer.ts` | ~150 | Importador seguro y saneador que cruza los 329 productos reales de `OFERTAS APP` (`catalog_state_seed.json`) con los costos, proveedores y zonas de `Maestro1.xlsx`, corrigiendo márgenes automáticamente. |
| `backend/src/modules/catalog/catalog.service.ts` | ~190 | Servicio de aplicación (búsqueda fonética instantánea, guardado transaccional con `PriceHistory` + `AuditLog`, aumento masivo con preview y exportación CSV/Excel). |
| `backend/src/modules/catalog/catalog.controller.ts` | ~85 | Controlador HTTP delgado (valida con `Zod`, invoca a `catalog.service.ts` y responde). |
| `backend/src/modules/catalog/catalog.routes.ts` | ~35 | Rutas Express del módulo (`/api/catalog/products`, `/api/catalog/calculate-cost`, `/api/catalog/bulk-update`, `/api/catalog/export`). |

### Frontend (`frontend/`)
| Archivo | Líneas Est. | Responsabilidad Única |
| :--- | :--- | :--- |
| `frontend/src/modules/catalog/types.ts` | ~70 | Tipos TypeScript del Catálogo, Listas de Precios y Vista Previa de Aumentos Masivos. |
| `frontend/src/modules/catalog/api.ts` | ~80 | Cliente HTTP sincronizado para consultar productos, simular aumentos y guardar cambios. |
| `frontend/src/modules/catalog/components/SupplierCostCalculatorModal.tsx` | ~195 | Mini-calculadora interactiva (*Precio Proveedor - % Bonif + % IVA = Costo Neto*) y editor de fila con soporte `Enter` / `Esc`. |
| `frontend/src/modules/catalog/components/BulkPriceUpdateModal.tsx` | ~195 | Modal de Aumento Masivo por **Proveedor** (`REMOTTI`, `CREMIGAL`, etc.) o **Rubro**, con tabla comparativa **Antes vs. Después** antes de confirmar. |
| `frontend/src/modules/catalog/components/PriceListPrintModal.tsx` | ~210 | Impresor de **Lista de Precios Oficial (`Lista 4`)** agrupada por las secciones clásicas de Don Venancio (`1 - REMOTTI`, `1.1 - LECHES`, `1.2 - SANCOR y CREMIGAL`, `2.7 - BEBIDAS / Bodegas`). |
| `frontend/src/modules/catalog/components/QuickPriceSearchModal.tsx` | ~125 | Consultor rápido flotante global (`Ctrl + Q`) con buscador fonético instantáneo. |
| `frontend/src/modules/catalog/components/ProductFormModal.tsx` | ~175 | Modal para crear `+ Nuevo Producto` con cálculo en vivo de `Lista 4`, `Especial 1` y `Especial 2`. |
| `frontend/src/modules/catalog/components/PhotoLightboxModal.tsx` | ~85 | Visor de foto ampliada (`Lightbox`) con insignia de emoji por rubro y SKU. |
| `frontend/src/core/Sidebar.tsx` | ~130 | Menú lateral estilo Apple/Stripe con logo oficial `logo_dv_clean.png`, tipografía `Plus Jakarta Sans`, acceso rápido `Ctrl + Q` y navegación de módulos. |
| `frontend/src/modules/catalog/CatalogPage.tsx` | ~235 | Grilla principal de Catálogo y Precios: buscador fonético (`F2`), edición rápida `Inline Edit` con 1 clic en Costo/Margen/Lista 4 (Costo sagrado), filtro `Activos / Inactivos` con botón `Reactivar` y Backup Excel/CSV. |

---

## 2. Diseño del Motor de Dominio (`pricing.engine.ts` con `Decimal.js`)

Todas las funciones son **100% puras y determinísticas**:

1. **`calculateNetSupplierCost(input)`**:
   $$\text{CostoNeto} = \text{round\_2dec}\left(\text{PrecioBruto} \times \left(1 - \frac{\text{Bonif\%}}{100}\right) \times \left(1 + \frac{\text{IVA\%}}{100}\right)\right)$$
2. **`calculateRealMarginPct(costPrice, priceList4)`**:
   - Si `costPrice <= 0`, retorna `0.00` (y marca `hasValidCost = false`).
   - Si `costPrice > 0`:
     $$\text{MargenReal\%} = \text{round\_2dec}\left(\left(\frac{\text{PrecioLista4}}{\text{CostoNeto}} - 1\right) \times 100\right)$$
3. **`calculateProductPriceLists(input)`**:
   - **Modo A (Desde Costo + Margen)**:
     $$\text{priceList4} = \text{round\_integer}\left(\text{costPrice} \times \left(1 + \frac{\text{marginList4Pct}}{100}\right)\right)$$
   - **Modo B (Desde Precio Lista 4 Fijado Manualmente)**:
     $$\text{priceList4} = \text{round\_integer}(\text{manualPriceList4})$$
     $$\text{marginList4Pct} = \text{calculateRealMarginPct}(\text{costPrice}, \text{priceList4})$$
   - **Cálculo de `Lista Especial 1` y `Lista Especial 2` (Pesos Enteros)**:
     $$\text{priceSpecial1} = \text{round\_integer}\left(\text{priceList4} \times \left(1 + \frac{\text{special1VariationPct}}{100}\right)\right)$$
     $$\text{priceSpecial2} = \text{round\_integer}\left(\text{priceList4} \times \left(1 + \frac{\text{special2VariationPct}}{100}\right)\right)$$
   - **Cálculo Informativo de Precio Sin IVA**:
     $$\text{priceNetNoIva} = \text{round\_2dec}\left(\frac{\text{priceList4}}{1 + \frac{\text{ivaRate}}{100}}\right)$$
4. **`resolveApplicableUnitPrice(product, customerList, orderedQty)`**:
   - Implementa la **Regla Híbrida Validada**:
     - Si el cliente tiene `ESPECIAL_2` $\rightarrow$ devuelve `priceSpecial2`.
     - Si el cliente tiene `ESPECIAL_1` $\rightarrow$ devuelve `priceSpecial1`.
     - Si el cliente tiene `LISTA_4` (Base): verifica si el producto tiene `boxPrice > 0`, `unitsPerBox > 1` y `orderedQty >= unitsPerBox`. Si cumple, baja automáticamente a `boxPrice`; de lo contrario aplica `priceList4`.
5. **`simulateBulkPriceUpdate(products, increasePct, newMarginPct?)`**:
   - Recorre el lote de productos filtrados (por ej. proveedor `REMOTTI`), incrementa `costPrice` en `increasePct%`, recalcula las 3 listas en pesos enteros y devuelve la lista comparativa *Antes vs. Después* junto con el resumen de impacto.

---

## 3. Plan de Pruebas Automáticas (`pricing.engine.test.ts` en `Vitest`)

1. **Test de Saneamiento Real Don Venancio (SKU `0001` Barra Tybo Melincué)**:
   - Dado `costPrice = 9131.20` y `priceList4 = 11414`, verifica que el margen real calculado sea exactamente `25.00%` (corrigiendo el `35%` falso del Excel) y que `Lista Especial 1 (-3%)` dé `$11.072` enteros y `Lista Especial 2 (-5%)` dé `$10.843` enteros.
2. **Test de Eliminación de Centavos Residuales (SKU `0100` Fiambre de Cerdo)**:
   - Dado un precio importado con centavos `$6.169,98`, verifica que `roundToIntegerPeso` lo convierta en `$6.170` exactos.
3. **Test de Mini-Calculadora de Factura de Proveedor**:
   - Precio base `$10.000`, bonificación `10%`, más IVA `21%` $\rightarrow$ verifica `costPrice = $10.890,00`.
4. **Test de Regla Híbrida de Volumen por Caja (`unitsPerBox`)**:
   - Cliente en `LISTA_4` llevando `3` unidades (`unitsPerBox = 6`) paga `priceList4`; llevando `6` o más unidades baja automáticamente a `boxPrice`.
5. **Test de Simulación de Aumento Masivo por Proveedor (`CREMIGAL +8%`)**:
   - Verifica que todos los artículos del proveedor suban su costo un `8%`, mantengan su margen real y generen precios enteros exactos en las 3 listas.
