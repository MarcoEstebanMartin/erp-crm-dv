# Plan Técnico de Implementación (`004-cuentas-corrientes-tesoreria`)

## 1. Mapa de Archivos Modulares (< 250 Líneas por Archivo)

### Backend (`backend/src/modules/treasury/`)
1. `treasury.schema.ts` (< 120 líneas): Contratos `Zod` para creación de clientes, recibos de cobranza, gastos de flota/generales y arqueos de caja.
2. `treasury.engine.ts` (< 210 líneas): Motor matemático `LedgerEngine` con `Decimal.js`:
   - `buildCustomerRunningLedger`: Construye el estado de cuenta cronológico con `debit`, `credit` y `runningBalance` filtrable por `ALL | OFFICIAL | INTERNAL`.
   - `computeDebtorsByCityReport`: Agrupa saldos deudores (`> 0`) por localidad y sucursal (`officialBalance`, `internalBalance`, `totalBalance`).
   - `computeTreasuryKpis`: Calcula en pesos enteros los saldos de `Caja Grande`, `Cuentas Bancarias`, `Cartera de Cheques`, `Ingresos` y `Gastos`.
3. `treasury.engine.test.ts` (< 150 líneas): Suite `Vitest` probando la invariante `Saldo == Suma(Debe) - Suma(Haber)` y el desglose `Total == Sucursal A + Sucursal X`.
4. `treasury.service.ts` (< 250 líneas): Servicio persistente conectado con `OrdersService` para impactar facturas, anulaciones, recibos, gastos y cajas.
5. `treasury.controller.ts` & `treasury.routes.ts` (< 130 líneas cada uno): Rutas montadas en `/api/treasury`.

### Frontend (`frontend/src/modules/treasury/`)
1. `types.ts` & `api.ts` (< 160 líneas cada uno).
2. `utils/printTreasuryHelpers.ts` (< 200 líneas): Impresión limpia de `Resumen de Cuenta Corriente`, `Recibo Oficial de Cobro` y `Planilla de Deudores por Localidad`.
3. `components/AccountStatementModal.tsx` (< 200 líneas): Modal `Resumen de Cuenta Corriente` con filtro de fechas y canal (`Todos / Sucursal A / Sucursal X`).
4. `components/PaymentReceiptModal.tsx` (< 210 líneas): Modal `Cargar Recibo de Cobro` (Efectivo, Transferencia, Cheque/Echeq).
5. `components/CustomerFormModal.tsx` (< 200 líneas): Modal `Agregar / Editar Cliente` con las 24 localidades oficiales y rutas.
6. `components/DebtorsByRouteView.tsx` (< 210 líneas): Vista `📊 Deudores por Ruta` con filtro de localidades, vendedores y sucursales.
7. `ClientsAccountsPage.tsx` (< 240 líneas): Sección `Clientes y Cuentas` con las 5 píldoras (`Clientes`, `Vendedores`, `Comisionistas`, `📊 Deudores por Ruta`, `Rutas de Preventa`).
8. `TreasuryDashboardPage.tsx` (< 240 líneas): Sección `Caja y Cobranzas` con las 3 pestañas (`Finanzas General`, `Rendiciones y Arqueos`, `Control de Gastos`).
9. `ConfigPage.tsx` (< 160 líneas): Sección `Configuración` (Datos de Empresa, Cuentas Bancarias y Parámetros).
