# Modelo de Datos y Contratos API (`003-pedidos-pesaje-facturacion`)

## 1. Entidades de Dominio (`Customer`, `Order`, `OrderItem`)

### 1.1. Clientes y Vendedores (`Customer`)
Importados desde el padrón real de Don Venancio (`1.626 clientes` y `6 vendedores`):
- `id`: `string`
- `legacyId`: `number`
- `name`: `string`
- `cuit`: `string | null`
- `address`: `string | null`
- `city`: `string` (`GENERAL VILLEGAS`, `AMEGHINO`, `BANDERALÓ`, `REALICÓ`, etc.)
- `route`: `string | null` (`AMEGHINO Y BLAQUIER`, `BANDERALÓ Y LARROUDÉ`, `ALVEAR`, etc.)
- `sellerName`: `string` (`DIEGO LEJARZA`, `RAMOS NORBERTO`, `ALBERCA MIGUEL`, `VIDELA MARIA JOSÉ`, `MAYA FABIAN`, `OFICINA`)
- `priceList`: `'LISTA_4' | 'ESPECIAL_1' | 'ESPECIAL_2'` (por defecto `'LISTA_4'`)
- `iibbPerceptionPct`: `number` (ej. `0` o `3.00`)

### 1.2. Pedido y Comprobante (`Order`)
- `id`: `number` (Nro correlativo de pedido, ej. `#1001..#1018`)
- `customerId`: `string`
- `customerName`: `string`
- `customerCuit`: `string | null`
- `customerAddress`: `string | null`
- `customerCity`: `string`
- `deliveryRoute`: `string`
- `sellerName`: `string`
- `status`: `'PENDING' | 'PREPARING' | 'BILLED' | 'DELIVERED' | 'CANCELLED'`
- `billingType`: `'INTERNAL' | 'OFFICIAL'` (`Sucursal X` vs `Sucursal A`)
- `invoiceType`: `'PRESUPUESTO_X' | 'FACTURA_A' | 'FACTURA_B' | null`
- `invoiceNumber`: `string | null` (ej. `X-0001-00001001` o `A-0004-00002415`)
- `cae`: `string | null`
- `caeExpirationDate`: `string | null`
- `paymentMethod`: `'ACCOUNT' | 'CASH' | 'BANK_TRANSFER' | 'CHECK'`
- `paymentDescription`: `string | null`
- `netoGravado`: `number` (2 decimales técnicos AFIP)
- `ivaAmount`: `number` (2 decimales técnicos AFIP)
- `iibbPerceptionAmount`: `number` (2 decimales técnicos AFIP)
- `totalAmount`: `number` (Peso entero exacto `ROUND_HALF_UP`)
- `createdAt`: `string` (ISO 8601)
- `updatedAt`: `string` (ISO 8601)
- `billedAt`: `string | null` (ISO 8601)
- `items`: `OrderItem[]`

### 1.3. Renglón de Pedido con Snapshots (`OrderItem`)
- `id`: `number`
- `productId`: `string`
- `sku`: `string`
- `productName`: `string`
- `rubro`: `string | null`
- `pickingZone`: `'FRIO' | 'CAJAS' | 'TABLA'`
- `isWeighable`: `boolean`
- `approxWeightKg`: `number | null`
- `quantity`: `number` (Unidades u hormas pedidas)
- `actualWeightKg`: `number | null` (Peso real de balanza en kg, 3 decimales)
- `unitCostSnapshot`: `number` (Costo sin IVA congelado al momento de la venta)
- `listPriceSnapshot`: `number` (Precio unitario o por kg final congelado en pesos enteros)
- `discountPctSnapshot`: `number`
- `ivaRatePct`: `'21.00' | '10.50' | '0.00'`
- `subtotal`: `number` (Subtotal entero del renglón `ROUND_HALF_UP`)

---

## 2. Contratos de Validación Zod (`orders.schema.ts`)
- `CreateOrderSchema`: valida `customerId`, `billingType`, `paymentMethod`, y el array `items` (`productId`, `quantity`, `actualWeightKg?`).
- `ConfirmFulfillmentSchema`: valida `weights` (`array` de `{ itemId, actualWeightKg }`), `billingType`, `paymentMethod`, `paymentDescription?`, `deferCae?`.
- `UpdateOrderStatusSchema`: valida cambio de estado (`PENDING`, `PREPARING`, `CANCELLED`).
