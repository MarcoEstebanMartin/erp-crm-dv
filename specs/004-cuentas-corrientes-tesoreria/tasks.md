# Checklist de Implementación (`004-cuentas-corrientes-tesoreria`)

- [x] **T001**: Implementar `treasury.schema.ts`, `treasury.engine.ts` (`LedgerEngine` con `Decimal.js`) y `treasury.engine.test.ts` en `Vitest`.
- [x] **T002**: Implementar `treasury.service.ts` integrado con `OrdersService` (asiento automático al facturar o cancelar pedidos, alta de clientes, recibos de cobranza, bancos, cheques, cajas y gastos) + `treasury.controller.ts` y `treasury.routes.ts`.
- [x] **T003**: Construir componentes Frontend de `Clientes y Cuentas` (`ClientsAccountsPage.tsx`, `AccountStatementModal.tsx`, `PaymentReceiptModal.tsx`, `CustomerFormModal.tsx`, `DebtorsByRouteView.tsx`).
- [x] **T004**: Construir componentes Frontend de `Caja y Cobranzas` (`TreasuryDashboardPage.tsx`) y `Configuración` (`ConfigPage.tsx`).
- [x] **T005**: Conectar todas las secciones y accesos directos del `Panel Principal` (`Agregar Cliente`, `Cuentas Corrientes`, `Cargar Recibo`, `Gasto de Flota`, `Auditar Rendiciones`) en `App.tsx` y `DashboardPage.tsx`. Verificar `tsc --noEmit` (0 errores) y `vitest run` (100% green).
