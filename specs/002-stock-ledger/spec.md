# Especificación de Módulo: 002 - Libro Mayor de Stock, Valorización Real y Mapa de Depósito (WMS)

> **Fase Spec-Kit**: `1. Specify (Qué y Por Qué)`
> **Estado**: Validado con el Usuario (`/grill-me` completado el 07/11/2026)
> **Módulos Relacionados**: `specs/001-catalogo-y-precios`, `specs/01-invariantes-contables-y-afip.md`

---

## 1. Objetivo de Negocio (El "Por Qué")
En una distribuidora mayorista de lácteos, fiambres y almacén (**Don Venancio**), el inventario físico es el segundo activo financiero más grande después de la cuenta corriente.
En el ERP anterior (`StockDashboard.tsx`, 1.877 líneas) se detectaron **2 problemas críticos** que hoy quedan resueltos de raíz:
1. **Error de Subvaluación en Pesables (Quesos y Fiambres)**: El sistema anterior multiplicaba las unidades físicas directamente por el precio por kilo (`displayedStock * costPrice`), subvaluando 4 veces las hormas de queso (ej. 10 hormas de Barra Tybo Melincué de `4.2 kg` a `$8.350/kg` figuraban como `$83.500` en vez de `$350.700`).
2. **Saldos Mutables sin Invariante de Libro Mayor**: El stock se sobrescribía en variables sueltas. En `ERP-DV`, todo cambio de stock genera un movimiento inmutable en el **Libro Mayor de Stock (`StockLedger`)** (`IN`, `OUT`, `ADJUSTMENT`), garantizando que la suma histórica de movimientos coincida el **100% de las veces** con el stock físico actual y el stock por lote/ubicación.

---

## 2. Reglas de Dominio Validadas (`/grill-me`)

### Regla 1: Conteo en Unidades / Piezas y Valorización Financiera Exacta (`Decimal.js`)
- **Conteo Físico en Galpón**: Tanto los artículos por unidad como los productos pesables (hormas de queso, piezas de fiambre) se cuentan y registran en **Unidades / Piezas Físicas enteras** (ej. `10 u.` = 10 hormas).
- **Fórmula de Valorización de Stock (`StockEngine`)**:
  - **Productos No Pesables (`isWeighable == false`)**:
    $$\text{Valor Costo} = \text{round\_half\_up}(\text{Unidades} \times \text{Costo Neto Unitario}, 0)$$
    $$\text{Valor Venta (Lista 4)} = \text{round\_half\_up}(\text{Unidades} \times \text{Precio Lista 4}, 0)$$
  - **Productos Pesables (`isWeighable == true` y `approxWeightKg > 0`)**:
    $$\text{Kilos Estimados} = \text{Unidades} \times \text{approxWeightKg}$$
    $$\text{Valor Costo} = \text{round\_half\_up}(\text{Unidades} \times \text{approxWeightKg} \times \text{Costo Neto por Kg}, 0)$$
    $$\text{Valor Venta (Lista 4)} = \text{round\_half\_up}(\text{Unidades} \times \text{approxWeightKg} \times \text{Precio Lista 4 por Kg}, 0)$$
  - **Margen Latente ($ y %)**:
    $$\text{Margen Latente (\$)} = \text{Valor Venta Total} - \text{Valor Costo Total}$$

### Regla 2: Agilidad Operativa en Lotes, Vencimientos (FEFO) y Slots del Mapa
- **Opcionales al Ajustar**: El usuario puede realizar un **Inventario Rápido** o un **Ajuste Individual** sin estar obligado a cargar lote o vencimiento. Si no se indica lote, el sistema asigna automáticamente el lote general `'S/L'` (Sin Lote) con vencimiento neutro (`2036-12-31`).
- **Trazabilidad Completa Cuando se Requiere**: En cualquier ingreso o ajuste se puede especificar opcionalmente:
  - `lotNumber` (ej. `L-2411`)
  - `expirationDate` (Fecha de vencimiento para alertas FEFO a 30 días y vencidos)
  - `locationSlot` (Código de slot de los 210 slots reales de `mapadeposito.xlsx`, ej. `D1-R06-C07-A`).

### Regla 3: Las 4 Pestañas Integradas en `Productos y Stock`
Dentro de la sección **`Productos y Stock`** conviven las 4 pestañas minimalistas del diseño original:
1. **`Lista de Productos`** (Catálogo activo y precios).
2. **`Control y Valorización de Stock`** (5 tarjetas KPI, filtros por estado `Todos / Stock Bajo / Agotados / Vencimientos`, `Modo Inventario Rápido` en lote, `Auditoría Global` y tabla con lotes en góndola, físico, valor costo y valor venta).
3. **`🗺️ Mapa Interactivo Depósito`** (Plano gráfico 2D de los **210 slots reales** en `Planta Completa`, `Depósito 1`, `Depósito 2`, `Depósito 3`, filtros por `Cámara 1/2/3/Estantería` e inspector de los 3 niveles `A, B, C` para asignar o mover mercadería en el galpón).
4. **`Productos Inactivos`** (Artículos pausados con reactivación en 1 clic).

---

## 3. Criterios de Aceptación (Escenarios de Prueba)
- **Escenario 1 (Valorización de Hormas Pesables)**: Dado el producto `0001` (`MELINCUÉ BARRA TYBO`, pesable, `approxWeightKg = 4.2 kg`, `costPrice = $6.680`, `priceList4 = $8.350`), si el stock físico es `10 unidades (hormas)`, el motor calcula exactamente `42 kg estimados`, `Valor Costo = $280.560`, `Valor Venta = $350.700` y `Margen Latente = $70.140 (+25%)`.
- **Escenario 2 (Invariante de Libro Mayor `StockLedger`)**: Cada ajuste individual o en lote (`Modo Inventario Rápido`) crea un asiento inmutable en `StockLedger` con `previousStock`, `quantityDelta`, `resultingStock`, `lotNumber`, `locationSlot` y `reason`. La suma de los lotes activos de un producto es siempre igual a su stock físico total.
- **Escenario 3 (Asignación a Slot del Mapa 2D/3D)**: Al asignar un lote de un producto al slot `D1-R01-C07-A` (`Cámara 1`, Nivel A), el slot se ilumina como ocupado en el Mapa Interactivo del Depósito y muestra las unidades almacenadas en ese nivel.
