# Especificación de Módulo (Spec-Kit): Cuentas Corrientes, Clientes y Tesorería (`004-cuentas-corrientes-tesoreria`)

> **Estado**: Aprobado en `/grill-me` (Ronda 5 + Refinamiento Visual Fiel Paso a Paso)  
> **Módulo**: `specs/004-cuentas-corrientes-tesoreria/`

---

## 1. Propósito y Resumen Ejecutivo (Qué y Por Qué)
El módulo **Cuentas Corrientes, Clientes y Tesorería (`004-cuentas-corrientes-tesoreria`)** cierra el circuito financiero de **Distribuidora Don Venancio** sobre un **Libro Mayor Inmutable de Partida Doble (`AccountLedger`)**:
1. **Prohibido Saldos Mutables Sueltos**: Ningún saldo de cliente se modifica con sumas o restas manuales sin respaldo. Todo saldo proviene exactamente de `Suma(DEBIT) - Suma(CREDIT)` en `AccountLedger` calculado con `Decimal.js` en pesos enteros.
2. **Doble Canal Integrado (`Sucursal A` Oficial vs `Sucursal X` Interno)**: Cada asiento en `AccountLedger` registra su canal (`OFFICIAL` o `INTERNAL`). El usuario visualiza el **Saldo Total Unificado** y puede filtrar en 1 clic por `Todos`, `Sucursal A` o `Sucursal X` tanto en el **Resumen de Cuenta** como en la planilla **📊 Deudores por Ruta**.
3. **Imputación Triple al Cargar Recibo**: Cuando se registra un cobro a un cliente (Efectivo, Transferencia o Cheque/Echeq), en una sola operación atómica:
   - Se asienta el `CREDIT` en la Cuenta Corriente del cliente (`AccountLedger`).
   - Ingresa el dinero en `Caja Central / Operativa`, `Cuenta Bancaria` o `Cartera de Cheques`.
   - Se habilita la impresión inmediata del **Recibo de Cobranza**.
4. **Estructura Visual Minimalista Idéntica al Diseño Original**:
   - En **`Clientes y Cuentas`**: 5 pestañas tipo píldora (`Clientes`, `Vendedores`, `Comisionistas`, `📊 Deudores por Ruta`, `Rutas de Preventa`).
   - En **`Caja y Cobranzas`**: 4 pestañas tipo píldora con ícono (`$ Finanzas General`, `🧾 Rendiciones y Arqueos`, `$ Control de Gastos`, `📈 Reportes y Analíticas`).
   - En **`$ Finanzas General`**:
     - Banner oscuro `Caja Grande (Central)` con `Saldo Disponible` en pesos enteros y acciones `🔒 Cerrar Caja Grande`, `☑️ Conciliación Bancaria` y `⊕ Registrar Gasto` (`#E30613`).
     - Sección `Rendimiento & Margen Financiero` con filtro de período (`Desde` / `Hasta` + refrescar) calculado en el backend.
     - 5 tarjetas interactivas de colores suaves (`Ingreso Efectivo`, `Ingreso Cheques`, `Ingreso Transferencias`, `Gastos (Egresos)`, `Recaudación Neta del Periodo`) con apertura de modal de desglose (`Ver N movimientos >`).
     - Tabla `Movimientos de Caja Grande` y doble panel inferior (`Cuentas Bancarias / Bancos` editable y `Cobros por Transferencia (Periodo)`).

---

## 2. Escenarios de Uso y Criterios de Aceptación (Given / When / Then)

### Escenario 1: Asiento Automático en Cuenta Corriente al Facturar Pedido
- **Dado (Given)** un pedido confirmado y facturado en condición `Cuenta Corriente` (`ACCOUNT`) por `$150.000` en `Sucursal X`,
- **Cuando (When)** se emite el comprobante `X-0001-00001001`,
- **Entonces (Then)** se genera automáticamente un asiento inmutable `DEBIT` por `$150.000` en `AccountLedger` para ese cliente, incrementando su saldo deudor en `$150.000`. Si el pedido se anula, se asienta el `CREDIT` de reversión.

### Escenario 2: Cobranza con Recibo e Impacto en Caja / Banco / Cheques
- **Dado (Given)** un cliente con saldo deudor de `$150.000`,
- **Cuando (When)** el administrador registra un Recibo de `$50.000` por Transferencia Bancaria (`Banco Provincia`),
- **Entonces (Then)** el motor registra un asiento `CREDIT` de `$50.000` en `AccountLedger`, el saldo acumulado del cliente baja exactamente a `$100.000`, y el saldo de `Banco Provincia` sube en `$50.000`.

### Escenario 3: Planilla de Deudores por Ruta y Localidad
- **Dado (Given)** el conjunto de clientes con saldo mayor a `$0`,
- **Cuando (When)** se abre la pestaña `📊 Deudores por Ruta` y se filtra por localidad o vendedor,
- **Entonces (Then)** el sistema agrupa los deudores por localidad mostrando `Saldo Sucursal A`, `Saldo Sucursal X` y `Saldo Total` exactos, permitiendo imprimir la hoja de cobranza para el repartidor o viajante.
