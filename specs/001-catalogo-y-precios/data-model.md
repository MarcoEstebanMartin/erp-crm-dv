# Modelo de Datos y Contratos: 001 - Catálogo Maestro y Motor de Precios

> **Fase Spec-Kit**: `2A. Data Model & Contracts`
> **Estado**: `COMPLETO`

---

## 1. Tablas del Esquema Contable (`backend/prisma/schema.prisma`)

Siguiendo la Constitución (Art. II y III), todas las tablas utilizan tipos exactos (`Decimal(14, 2)` para importes/porcentajes y `Decimal(12, 3)` para pesos de balanza) y prohíben el borrado físico (`active Boolean @default(true)`).

### 1.1. Enums Operativos Fundacionales
- **`UserRole`**: `ADMIN`, `FACTURACION`, `VENDEDOR`, `DEPOSITO`, `REPARTIDOR`
- **`StorageZone`**: `FRIO`, `SECO`
- **`PriceListCode`**: `LISTA_4` (Base Oficial), `ESPECIAL_1` (-3% Melincué / Nivel 1), `ESPECIAL_2` (-5% Melincué / Nivel 2)

### 1.2. Tabla `Category` (`categories` — Rubros, Subrubros y Categorías Comerciales)
| Columna | Tipo Prisma / PostgreSQL | Restricciones | Propósito |
| :--- | :--- | :--- | :--- |
| `id` | `Int` (`SERIAL`) | `@id @default(autoincrement())` | Identificador único. |
| `commercialCategory` | `String` (`VARCHAR(80)`) | `NOT NULL` | Categoría comercial web/catálogo (ej. `Melincué`, `Fiambres`, `Pastas Secas`). |
| `rubro` | `String` (`VARCHAR(80)`) | `NOT NULL` | Rubro maestro según `Maestro1.xlsx` (ej. `REMOTTI`, `CREMIGAL`, `FIAMBRES`). |
| `subrubro` | `String` (`VARCHAR(80)`) | `NOT NULL` | Subrubro (ej. `MELINCUE`, `QUESOS`, `EMBUTIDOS`). |
| `active` | `Boolean` | `@default(true)` | Baja lógica (`Soft Delete`). |

- **Índice Único Compuesto**: `@@unique([commercialCategory, rubro, subrubro])`

### 1.3. Tabla `Product` (`products` — Maestro Contable y Logístico de Productos)
| Columna | Tipo Prisma / PostgreSQL | Restricciones | Propósito |
| :--- | :--- | :--- | :--- |
| `id` | `Int` (`SERIAL`) | `@id @default(autoincrement())` | PK interna para claves foráneas rápidas en `stock_ledger` y `order_items`. |
| `sku` | `String` (`VARCHAR(32)`) | `@unique NOT NULL` | Código único compartido con `OFERTAS APP` y `Maestro1.xlsx` (ej. `'0001'`). |
| `barcode` | `String?` (`VARCHAR(64)`) | `@index` | Código de barras EAN-13 (ej. `'7791108000612'`). |
| `name` | `String` (`VARCHAR(180)`) | `NOT NULL` | Nombre comercial oficial (ej. `'MELINCUÉ BARRA TYBO X KG'`). |
| `supplierName` | `String` (`VARCHAR(100)`) | `@default("GENERAL") @index` | Proveedor directo para aumentos masivos (ej. `'REMOTTI'`, `'CREMIGAL'`). |
| `categoryId` | `Int?` | `FK -> categories.id` | Vínculo al Rubro/Subrubro normalizado. |
| `commercialCategory` | `String` (`VARCHAR(80)`) | `@default("General")` | Categoría rápida desnormalizada para filtros y sync con `OFERTAS APP`. |
| `rubro` | `String` (`VARCHAR(80)`) | `@default("GENERAL") @index` | Rubro directo (`Maestro1.xlsx`). |
| `subrubro` | `String` (`VARCHAR(80)`) | `@default("GENERAL") @index` | Subrubro directo (`Maestro1.xlsx`, usado también para regla `-3% / -5% MELINCUE`). |
| `cheeseType` | `String?` (`VARCHAR(40)`) | `NULL` | Tipo de queso si aplica (`SEMIBLANDO`, `BLANDO`, `SEMIDURO`, `DURO`). |
| `varieties` | `String?` (`TEXT`) | `NULL` | Sabores o variedades (sincronizado con `public.products.variedades`). |
| `storageZone` | `StorageZone` | `@default(SECO)` | Zona de armado de depósito (`FRIO` cámara vs `SECO` galpón). |
| `warehouseId` | `Int` | `@default(1)` | Depósito físico (`1` por defecto según `Maestro1.xlsx`). |
| `isWeighable` | `Boolean` | `@default(false)` | `true` si se vende por peso real de balanza (`PESABLE = 'SI'`). |
| `approxWeightKg` | `Decimal` (`NUMERIC(12,3)`) | `@default(0)` | Peso aproximado por horma/pieza en kg (ej. `4.000` kg). |
| `minSaleQty` | `Int` | `@default(1)` | Mínimo de venta (`MINIMO VENTA` en `Maestro1.xlsx`). |
| `unitsPerBox` | `Int` | `@default(1)` | Unidades por caja/bulto cerrado (`UNIDADES POR CAJA`, ej. `4`, `6`, `12`, `18`). |
| `minStockAlert` | `Decimal` (`NUMERIC(12,3)`) | `@default(0)` | Alerta de stock mínimo (`STOCK MINIMO` en `Maestro1.xlsx`). |
| `ivaRate` | `Decimal` (`NUMERIC(5,2)`) | `@default(21.00)` | Alícuota fiscal AFIP (`21.00`, `10.50`, `0.00`). |
| `costPrice` | `Decimal` (`NUMERIC(14,2)`) | `@default(0)` | Costo neto de reposición (hasta 2 decimales). |
| `marginList4Pct` | `Decimal` (`NUMERIC(8,2)`) | `@default(0)` | `%` de margen exacto que une `costPrice` con `priceList4`. |
| `priceNetNoIva` | `Decimal` (`NUMERIC(14,2)`) | `@default(0)` | Precio sin IVA informativo (`priceList4 / (1 + ivaRate/100)` a 2 dec). |
| `priceList4` | `Decimal` (`NUMERIC(14,2)`) | `@default(0)` | **Lista 4 (Precio Base Oficial)** — Siempre peso entero (`0` decimales). |
| `special1VariationPct`| `Decimal` (`NUMERIC(6,2)`) | `@default(0)` | Variación `%` de Lista Especial 1 respecto a Lista 4 (ej. `-3.00` en Melincué). |
| `priceSpecial1` | `Decimal` (`NUMERIC(14,2)`) | `@default(0)` | **Lista Especial 1** — Siempre peso entero (`0` decimales). |
| `special2VariationPct`| `Decimal` (`NUMERIC(6,2)`) | `@default(0)` | Variación `%` de Lista Especial 2 respecto a Lista 4 (ej. `-5.00` en Melincué). |
| `priceSpecial2` | `Decimal` (`NUMERIC(14,2)`) | `@default(0)` | **Lista Especial 2** — Siempre peso entero (`0` decimales). |
| `boxPrice` | `Decimal?` (`NUMERIC(14,2)`) | `NULL` | Precio unitario promocional llevando caja cerrada (`>= unitsPerBox`), peso entero. |
| `photoFile` | `String?` (`VARCHAR(255)`) | `NULL` | Nombre de archivo de imagen (ej. `'0001.jpg'`). |
| `hasPhoto` | `Boolean` | `@default(false)` | Indica si posee foto activa. |
| `badge` | `String?` (`VARCHAR(60)`) | `NULL` | Etiqueta comercial (`'DESTACADO'`, `'OFERTA'`). |
| `active` | `Boolean` | `@default(true) @index` | Estado activo (prohibido borrado físico). |
| `pendingSync` | `Boolean` | `@default(false)` | `true` si cambió precio/estado y falta sincronizar con `OFERTAS APP`. |
| `createdAt` | `DateTime` | `@default(now())` | Fecha de alta. |
| `updatedAt` | `DateTime` | `@updatedAt` | Última modificación. |

### 1.4. Tabla `PriceHistory` (`price_history` — Historial Inmutable de Cambios de Precios)
| Columna | Tipo Prisma / PostgreSQL | Propósito |
| :--- | :--- | :--- |
| `id` | `Int` (`SERIAL`) | PK. |
| `productId` | `Int` (`FK -> products.id`) | Producto modificado. |
| `oldCostPrice` | `Decimal(14,2)` | Costo anterior. |
| `newCostPrice` | `Decimal(14,2)` | Costo nuevo. |
| `oldMarginPct` | `Decimal(8,2)` | Margen anterior. |
| `newMarginPct` | `Decimal(8,2)` | Margen nuevo. |
| `oldPriceList4` | `Decimal(14,2)` | Precio Lista 4 anterior (entero). |
| `newPriceList4` | `Decimal(14,2)` | Precio Lista 4 nuevo (entero). |
| `newPriceSpecial1` | `Decimal(14,2)` | Precio Lista Especial 1 resultante (entero). |
| `newPriceSpecial2` | `Decimal(14,2)` | Precio Lista Especial 2 resultante (entero). |
| `changeReason` | `String` (`VARCHAR(160)`) | Motivo (ej. `'Aumento Masivo Proveedor CREMIGAL +6%'`, `'Ajuste Manual'`). |
| `changedByUserId` | `String?` (`VARCHAR(80)`) | ID/Nombre del usuario responsable. |
| `createdAt` | `DateTime` (`@default(now())`) | Fecha y hora exacta del cambio. |

### 1.5. Tabla `AuditLog` (`audit_logs` — Caja Negra del Sistema)
| Columna | Tipo Prisma / PostgreSQL | Propósito |
| :--- | :--- | :--- |
| `id` | `BigInt` (`BIGSERIAL`) | PK secuencial inmutable. |
| `module` | `String` (`VARCHAR(40)`) | Módulo (`'CATALOG'`, `'STOCK'`, `'SALES'`, `'TREASURY'`). |
| `action` | `String` (`VARCHAR(60)`) | Acción (`'PRODUCT_PRICE_UPDATE'`, `'BULK_PRICE_UPDATE'`, `'INITIAL_IMPORT'`). |
| `entityId` | `String` (`VARCHAR(64)`) | SKU o ID afectado. |
| `userId` | `String?` (`VARCHAR(80)`) | Usuario ejecutor. |
| `beforeJson` | `String?` (`TEXT`) | Snapshot JSON previo al cambio. |
| `afterJson` | `String?` (`TEXT`) | Snapshot JSON posterior al cambio. |
| `createdAt` | `DateTime` (`@default(now())`) | Timestamp inmutable. |

---

## 2. Interacción con `OFERTAS APP / CHATBOT-DV` (`public.products`)
- **Clave Única de Enlace**: `sku` (ej. `'0001'`).
- **Mapeo en Sincronización (`ERP` $\rightarrow$ `OFERTAS APP`)**:
  - `erp.products.priceList4` $\rightarrow$ `public.products.price` (entero) y `price_formatted` (`"$11.156"`).
  - `erp.products.boxPrice` $\rightarrow$ `public.products.box_price`.
  - `erp.products.approxWeightKg` $\rightarrow$ `public.products.peso_promedio`.
  - `erp.products.active` $\rightarrow$ `public.products.active` (`1` o `0`).

---

## 3. Contratos de Validación `Zod` (`backend/src/modules/catalog/catalog.schema.ts`)

1. **`CalculateSupplierCostSchema` (Mini-Calculadora de Costo Proveedor)**:
   - `rawSupplierPrice`: `number | string` ($> 0$)
   - `discountPct`: `number | string` ($0$ a $99.99$, default $0$)
   - `ivaRatePct`: `number | string` ($0$, $10.5$ o $21$, default $0$ si la factura ya tenía IVA incluido)
2. **`UpdateProductPricingSchema` (Actualización Individual)**:
   - `costPrice`: `number | string` ($\ge 0$)
   - `marginList4Pct`: `number | string` (opcional si se fija `manualPriceList4`)
   - `manualPriceList4`: `number | string` (opcional: si se envía, se redondea a peso entero y recalcula `marginList4Pct`)
   - `special1VariationPct`: `number | string` (default `-3` para `MELINCUE`, `0` resto)
   - `special2VariationPct`: `number | string` (default `-5` para `MELINCUE`, `0` resto)
   - `boxPrice`: `number | string | null` (opcional)
   - `reason`: `string` (default `'Actualización individual de precio'`)
3. **`BulkPriceUpdateSchema` (Aumento Masivo por Proveedor / Rubro / SKUs)**:
   - `filter`: `{ supplierName?: string; rubro?: string; subrubro?: string; skus?: string[] }`
   - `costIncreasePct`: `number | string` (ej. `6.5` para `+6.5%` sobre costo)
   - `newMarginList4Pct`: `number | string` (opcional si además se desea fijar nuevo margen)
   - `previewOnly`: `boolean` (`true` devuelve la tabla comparativa *Antes vs. Después* sin guardar; `false` ejecuta la transacción ACID).
4. **`CreateProductSchema` (Alta de `+ Nuevo Producto`)**:
   - `sku`: `string` (obligatorio, único)
   - `name`: `string` (obligatorio)
   - `supplierName`: `string` (default `'GENERAL'`)
   - `commercialCategory`: `string` (default `'General'`)
   - `rubro`: `string` (default `'GENERAL'`)
   - `subrubro`: `string` (default `'GENERAL'`)
   - `storageZone`: `'FRIO' | 'SECO'` (default `'SECO'`)
   - `isWeighable`: `boolean` (default `false`)
   - `approxWeightKg`: `number | string` (default `0`)
   - `unitsPerBox`: `number | string` (default `1`)
   - `ivaRatePct`: `number | string` (default `21`)
   - `costPrice`: `number | string` ($\ge 0$)
   - `marginList4Pct`: `number | string` (opcional)
   - `manualPriceList4`: `number | string` (opcional)
5. **`ToggleProductActiveSchema` (Desactivar / Reactivar `Soft Delete`)**:
   - `active`: `boolean` (`false` para desactivar, `true` para reactivar).
