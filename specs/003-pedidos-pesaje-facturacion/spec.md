# Especificación de Módulo (Spec-Kit): Pedidos, Pesaje en Balanza y Facturación Híbrida (`003-pedidos-pesaje-facturacion`)

> **Estado**: Aprobado en `/grill-me` (Ronda 4)  
> **Módulo**: `specs/003-pedidos-pesaje-facturacion/`

---

## 1. Propósito y Resumen Ejecutivo (Qué y Por Qué)
El módulo **Pedidos, Pesaje y Facturación (`003-pedidos-pesaje-facturacion`)** gestiona el ciclo operativo completo de ventas de **Distribuidora Don Venancio**:
1. **Toma de Pedidos y Bandeja de Entrada**: Recepción de pedidos de preventa (vendedores en calle, tienda online / bot WhatsApp `CHATBOT-DV` o mostrador) vinculados a los **1.626 clientes reales** y **6 vendedores** (`DIEGO LEJARZA`, `RAMOS NORBERTO`, `ALBERCA MIGUEL`, `VIDELA MARIA JOSÉ`, `MAYA FABIAN`, `OFICINA`).
2. **Armado de Pedidos (Kanban 3 Columnas + Impresión de Depósito)**: Tablero operativo con columnas **Pendientes**, **En Picking** y **Facturados Hoy**, filtrable por **Ruta**, **Vendedor** y **Zona de Armado** (`❄️ Frío`, `📦 Cajas`, `🍾 Tabla`), con impresión de Lote A4, Consolidado de Depósito y Rótulos de Bultos.
3. **Pesaje Real con Detector de Coma Faltante y Descuento en `StockLedger`**: Al confirmar el armado, el operador carga los **kg reales de balanza** de los quesos y fiambres pesables. El motor incluye un **detector automático de anomalías de pesaje** (ej. si tipean `42` en vez de `4.2` kg para una horma de 4 kg, alerta y ofrece el botón `🪄 Corregir coma faltante`). En ese exacto instante de confirmación y facturación se registra el egreso (`OUT_SALE`) en `StockLedger`. Si un pedido facturado se cancela/anula, se revierte automáticamente con un ingreso (`IN_PURCHASE` / reversión) en `StockLedger`.
4. **Facturación Híbrida (`Sucursal X` vs `Sucursal A` AFIP/ARCA) e Inmutabilidad (`Snapshots`)**: Congela costos y precios vigentes en cada renglón (`unitCostSnapshot`, `listPriceSnapshot`) y calcula el total en **pesos enteros en origen** (`ROUND_HALF_UP`), generando además el desglose técnico de 2 decimales (`Neto + IVA + Percepción IIBB == Total`) cuando se emite por `Sucursal A (Oficial AFIP)`.

---

## 2. Escenarios de Uso y Criterios de Aceptación (Given / When / Then)

### Escenario 1: Cálculo de Pedido con Productos Pesables y Detector de Coma Faltante
- **Dado (Given)** un pedido que incluye `2 u.` de `0001 — MELINCUE BARRA TYBO x KG` (`isWeighable = true`, `approxWeightKg = 4`, precio Lista 4 = `$11.414 / kg`),
- **Cuando (When)** el pedido está en estado `PENDING` o `PREPARING` (antes de pesar),
- **Entonces (Then)** el subtotal estimado del renglón se calcula como `round(2 * 4 kg * $11.414) = $91.312`.
- **Cuando (When)** el encargado de depósito abre `Confirmar Armado y Facturar` e ingresa accidentalmente `82` kg (olvidando la coma de `8.2` kg),
- **Entonces (Then)** el motor detecta que `82 kg > 2 * 8 kg` (supera el doble del peso esperado) y propone la corrección automática `8.2 kg` (`🪄 Corregir coma faltante`). Al aplicar `8.2 kg`, el subtotal definitivo pasa a ser `round(8.2 * $11.414) = $93.595`.

### Escenario 2: Confirmación de Armado, Congelamiento de Snapshots y Descuento en `StockLedger`
- **Dado (Given)** un pedido en armado cuyos pesos reales ya fueron verificados,
- **Cuando (When)** el operador confirma la facturación (`Sucursal X` o `Sucursal A`),
- **Entonces (Then)**:
  1. Se congelan en cada renglón `unitCostSnapshot` y `listPriceSnapshot`.
  2. Se descuenta automáticamente del inventario mediante movimientos inmutables `OUT_SALE` en `StockLedger` (descontando las unidades físicas/hormas del lote disponible según FEFO).
  3. Si posteriormente se cancela el pedido, el sistema genera el contra-asiento en `StockLedger` restaurando el stock físico.

### Escenario 3: Facturación Oficial AFIP (`Sucursal A`) con Cuadratura Exacta
- **Dado (Given)** un pedido o factura directa por `$100.000` finales emitida por `Sucursal A (Oficial)`,
- **Cuando (When)** se solicita autorización CAE a AFIP/ARCA,
- **Entonces (Then)** el motor fiscal desglosa internamente con `Decimal.js` el `Neto Gravado` (`$82.644,63`) y el `IVA 21%` (`$17.355,37`) de modo que `Neto + IVA == $100.000,00` sin diferencia de centavos, asignando número de comprobante oficial y CAE.

---

## 3. Invariantes Contables y Reglas de Dominio
- **Prohibido `Number()` / `parseFloat()` en importes**: Todo cálculo de renglón, pesaje e IVA usa exclusivamente `Decimal.js` (`src/core/money.ts`).
- **3 Pestañas Minimalistas en `Pedidos y Facturación`**:
  1. `Armado de Pedidos` (Kanban 3 columnas: `Pendientes`, `En Picking`, `Facturados Hoy`).
  2. `Historial` (Tabla general de pedidos con filtro de estados, vista rápida, impresión de ticket y cancelación).
  3. `Facturación` (Tabla de comprobantes emitidos con filtro `Todos` / `Oficiales (A/B)` / `Internos (Presup.)` y botón `+ Emitir Factura Directa`).
