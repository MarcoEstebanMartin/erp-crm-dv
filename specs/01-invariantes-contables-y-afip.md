# Spec 01: Invariantes Contables, Regla de Pesos Enteros y Motor AFIP

Este documento establece las leyes matemáticas y fiscales del sistema **ERP-DV**. Toda función de cálculo financiero debe validarse contra estas reglas mediante tests unitarios automáticos en `Vitest`.

---

## 1. Ley de Aritmética Decimal Exacta
- **Prohibición de Punto Flotante Binario**: Queda prohibido realizar multiplicaciones, divisiones, porcentajes o sumas de dinero y peso utilizando `Number` o `parseFloat` nativo de JavaScript.
- **Uso Obligatorio de `Decimal.js`**: Todo cálculo pasa por el módulo central `src/core/money.ts` configurado con `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })`.

---

## 2. Política de "Pesos Enteros en Origen" (Cero Centavos Fantasma)

Para garantizar una visualización limpia (`$101` en vez de `$101,45`) y que toda suma manual con calculadora coincida al 100% con lo que muestra la pantalla:

### 2.1. Precios Unitarios de Lista
Cuando se calcula un Precio de Lista a partir del Costo y el Margen de Ganancia:
$$\text{PrecioLista} = \text{round\_integer}\left(\text{Costo} \times \left(1 + \frac{\text{Margen\%}}{100}\right)\right)$$
- El precio resultante se **guarda en la base de datos ya redondeado como peso entero** (ej. `$101.00`).
- De esta forma, si un producto muestra `$101` en lista y se venden `10` unidades sin descuento, el subtotal es inexorablemente `$1.010`.

### 2.2. Cálculo de Renglón de Venta (`OrderItem`)
1. **Cantidad o Peso (`billableQty`)**:
   - Si el producto es **Por Unidad / Bulto** (`isWeighable = false`): se usa la cantidad entera (`quantity`, ej. `5` unidades).
   - Si el producto es **Pesable de Balanza** (`isWeighable = true`):
     - Al tomar el pedido preventivo, se estima con `quantity * approximateWeightKg`.
     - Al pasar por balanza en depósito, se registra el peso real exacto con **3 decimales** (`actualWeightKg`, ej. `3.845` kg).
2. **Precio Unitario Neto Aplicado (`netUnitPrice`)**:
   - Si hay un descuento porcentual en el renglón ($d\%$):
     $$\text{SubtotalRenglón} = \text{round\_integer}\left( \text{PrecioUnitarioLista} \times \left(1 - \frac{d}{100}\right) \times \text{billableQty} \right)$$
   - El **Subtotal del Renglón (`lineSubtotal`)** se redondea al **peso entero más cercano** en el propio renglón.

### 2.3. Total del Pedido / Comprobante
$$\text{SubtotalPedido} = \sum_{i=1}^{n} \text{lineSubtotal}_i$$
- Como cada `lineSubtotal` ya es un número entero en pesos, la suma de los renglones mostrados en pantalla coincide **siempre al 100%** con el total del pedido.

---

## 3. Congelamiento Histórico en Ventas (Invariante de Rentabilidad)

Para evitar que un aumento de precios de un proveedor hoy altere los reportes de ganancias de semanas anteriores, cada renglón de pedido (`erp.order_items`) guarda obligatoriamente en el momento de su creación:
- `unit_cost_snapshot`: El costo unitario del producto en ese instante exacto.
- `list_price_snapshot`: El precio de lista vigente en ese instante exacto.
- `discount_pct`: El porcentaje de descuento aplicado.
- `line_cost_total`: $\text{round\_integer}(\text{unit\_cost\_snapshot} \times \text{billableQty})$.
- `line_profit`: $\text{lineSubtotal} - \text{line\_cost\_total}$.

**Invariante de Auditoría**: La ganancia de cualquier pedido histórico es `SUM(line_profit)` y es 100% inmune a futuros cambios en el catálogo.

---

## 4. Compatibilidad Fiscal con WebService de AFIP (ARCA)

Cuando un pedido se factura por canal **Oficial (Factura Electrónica A, B o C)**:
1. El **Total del Comprobante (`total_amount`)** sigue siendo el número entero limpio acordado con el cliente (ej. `$121.000`).
2. Para cumplir con la validación estricta de AFIP (`ImpTotal = ImpNeto + ImpIVA + ImpTrib`), el motor fiscal desglosa hacia adentro con precisión de **2 decimales (`Decimal(14,2)`)**:
   - $\text{ImpNeto} = \text{round\_2dec}\left(\frac{\text{Total}}{1 + \text{AlícuotaIVA}}\right)$
   - $\text{ImpIVA} = \text{Total} - \text{ImpNeto}$ (absorbiendo cualquier milésima de redondeo para que `ImpNeto + ImpIVA == ImpTotal` sea exacto al centavo ante AFIP y jamás sea rechazado por error `10048 / 10018` de ARCA).
3. Estos valores fiscales (`afip_net_amount`, `afip_iva_amount`, `afip_tributes_amount`, `cae`, `cae_expiration`) quedan guardados en la factura electrónica para el Libro IVA Ventas y el PDF fiscal, mientras la cuenta corriente del cliente opera con el `total_amount` entero.

---

## 5. Invariantes de Libro Mayor (Stock y Cuentas Corrientes)

### 5.1. Invariante de Cuenta Corriente Unificada (`AccountLedger`)
Ningún código puede hacer `UPDATE customers SET balance = ...` de forma aislada.
- Toda factura/remito confirmado inserta un asiento `DEBIT` ($+$ deuda del cliente).
- Todo recibo de cobro o nota de crédito aprobada inserta un asiento `CREDIT` ($-$ deuda del cliente).
- **Cuenta Corriente Unificada con Filtro por Canal (`OFFICIAL` / `INTERNAL`)**: El cliente posee un único saldo real total en la calle, pero cada asiento registra su `billing_type` para permitir filtrar estados de cuenta por canal Oficial AFIP, canal Presupuesto/Interno o Vista Completa Unificada.
- **Fórmula Sagrada**:
  $$\text{SaldoActualCliente} = \sum \text{DEBIT} - \sum \text{CREDIT}$$

### 5.2. Invariante de Inventario (`StockLedger`) y Flexibilidad Operativa
- Toda compra/recepción inserta un movimiento `IN` ($+$).
- Toda entrega/venta inserta un movimiento `OUT` ($-$).
- Todo ajuste de inventario inserta un movimiento `ADJUSTMENT` ($+$ o $-$) con motivo y usuario auditor.
- **Fórmula Sagrada**:
  $$\text{StockActualProducto} = \sum \text{Movimientos}(+\text{IN}, -\text{OUT}, \pm\text{ADJUSTMENT})$$
- **Política de Stock en Ventas (No Bloqueante en ERP / Estricto en Web)**:
  - En el ERP interno, se permite confirmar y facturar ventas aunque el stock resultante sea `0` o negativo (caso típico: la mercadería física ya ingresó al galpón pero aún no se cargó el remito/factura del proveedor), emitiendo una alerta visual al operador.
  - Al sincronizar hacia `public.products` (`CHATBOT-DV`), la Tienda Online y el Bot solo ofrecen como disponibles los productos con `stock > 0`.
  - El control de lotes/vencimientos es informativo en las compras (alertas de próximo vencimiento) y **no bloquea ni exige selección manual de lote al facturar**, priorizando la velocidad operativa.

---

## 6. Criterio de Costo de Reposición y Formación de Precios (3 Listas)
- En contexto inflacionario mayorista, el costo rector es el **Costo de Reposición (Último Costo de Compra o actualización de lista de proveedor)**.
- Al actualizar el `cost_price` de un producto, el motor recalcula automáticamente las 3 listas activas manteniendo el porcentaje de margen configurado y redondeando cada precio final al peso entero (`ROUND_HALF_UP`):
  - **Lista A (`price_a`)**: Mayorista General / Tienda Web (sincronizada con `public.products.price`).
  - **Lista B (`price_b`)**: Caja Cerrada / Volumen (sincronizada con `public.products.box_price`).
  - **Lista C (`price_c`)**: Especial / Distribuidor.
