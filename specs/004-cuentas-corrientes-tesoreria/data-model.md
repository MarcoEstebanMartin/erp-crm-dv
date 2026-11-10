# Modelo de Datos y Contratos API (`004-cuentas-corrientes-tesoreria`)

## 1. Entidades Contables (`AccountLedgerEntry`, `TreasuryTransaction`, `CashDrawer`, `BankAccount`)

### 1.1. Asiento de Cuenta Corriente (`AccountLedgerEntry`)
- `id`: `number` (Nro de movimiento secuencial global)
- `customerId`: `string`
- `customerName`: `string`
- `customerCity`: `string`
- `sellerName`: `string`
- `type`: `'DEBIT' | 'CREDIT'`
- `billingType`: `'INTERNAL' | 'OFFICIAL'` (`Sucursal X` vs `Sucursal A`)
- `reference`: `string` (ej. `X-0001-00001001`, `A-0004-00001002`, `REC-000105`)
- `description`: `string`
- `amount`: `number` (Peso entero exacto `ROUND_HALF_UP`)
- `createdAt`: `string` (ISO 8601)

### 1.2. Movimiento de Tesorería (`TreasuryTransaction`)
- `id`: `number`
- `type`: `'INCOME' | 'OUTCOME'`
- `category`: `'RECEIPT' | 'DIRECT_SALE' | 'EXPENSE_FLEET' | 'EXPENSE_GENERAL'`
- `paymentMethod`: `'CASH' | 'BANK_TRANSFER' | 'CHECK'`
- `billingType`: `'INTERNAL' | 'OFFICIAL'`
- `amount`: `number`
- `description`: `string`
- `customerId`: `string | null`
- `customerName`: `string | null`
- `bankAccountId`: `number | null`
- `cashDrawerId`: `number | null`
- `checkNumber`: `string | null`
- `checkIssuer`: `string | null`
- `createdAt`: `string`

### 1.3. Cuentas Bancarias y Cajas Operativas (`BankAccount`, `CashDrawer`)
- `BankAccount`: `id`, `name` (`Banco Provincia`, `Banco Nación`, `Mercado Pago`), `cbuOrAlias`, `balance`.
- `CashDrawer`: `id`, `name` (`Caja Mostrador Villegas`, `Caja Reparto Ruta 1`, `Caja Grande Central`), `responsible`, `status` (`OPEN` | `CLOSED`), `openingBalance`, `expectedBalance`, `realBalance`, `openedAt`, `closedAt`.
