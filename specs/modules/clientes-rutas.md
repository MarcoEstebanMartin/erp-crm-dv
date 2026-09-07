# Especificación de Módulo: Clientes, Rutas y Liquidación FIFO de Deuda

Este documento define la gestión de clientes, rutas de preventa y reparto, control de cuentas corrientes y el algoritmo de imputación de deudas por FIFO (First In, First Out).

---

## 1. Modelo de Clientes y Organización por Rutas

Cada cliente (`Persona` de tipo `CLIENTE`) pertenece a una ruta logística de reparto y preventa:

- **Atributo `route`**: Cadena que identifica el recorrido de entrega (ej. `"Ruta 1 - Casco Urbano"`, `"Ruta 2 - Luján"`, `"Ruta 3 - Chivilcoy"`).
- **Sucursales**: Un mismo cliente fiscal (mismo CUIT / Razón Social) puede poseer múltiples puntos de entrega o sucursales físicas, cada una con su dirección y saldo individual.

---

## 2. Algoritmo de Liquidación de Deudas: Imputación FIFO

Para evitar inconsistencias en el seguimiento de mora, el sistema utiliza **estricto criterio FIFO** (lo primero facturado es lo primero cancelado):

```text
Facturas Emitidas (Orden Cronológico):
  1. Fac-001 ($10.000)  [Fecha: 01/08] ──► Cancelada al 100%
  2. Fac-002 ($15.000)  [Fecha: 15/08] ──► Cancelada $5.000, Saldo Pendiente: $10.000
  3. Fac-003 ($20.000)  [Fecha: 01/09] ──► Saldo Pendiente: $20.000 (Sin imputar)

Cobranza Recibida:
  Recibo RC-101 ($15.000) ──► Cancela Fac-001 ($10.000) y aplica remanente ($5.000) a Fac-002.
```

### Invariantes del Cálculo FIFO:
1. **Prioridad Cronológica**: Un cobro no puede cancelar una factura nueva mientras existan facturas anteriores con saldo pendiente, salvo indicación explícita de disputa comercial.
2. **Notas de Crédito**: Operan de igual manera que una cobranza, reduciendo la deuda viva de la factura asociada o de la más antigua impaga.
3. **Presupuestos / Comprobantes X**: Si el cliente opera con cuenta corriente mixta (fiscal e interna), los saldos se totalizan por canal contable pero se alertan de forma unificada en el reporte de calle.

---

## 3. Reporte de Deudores por Ruta

El reporte de deudores es la herramienta crítica del preventista antes de tomar un nuevo pedido y del transportista antes de bajar mercadería:

### Requerimientos de la Vista y API:
- **Filtro por Ruta**: Permite seleccionar una ruta específica o ver el consolidado general.
- **Agrupación por Sucursal**: Detalla qué local específico acumula la deuda.
- **Alerta de Múltiples Boletas**: Si un cliente acumula 2 o más comprobantes pendientes sin pagar, la interfaz debe mostrar un distintivo visual de atención (`Badge` de advertencia) para frenar la entrega de mercadería sin cobranza previa.
- **Antigüedad de Deuda**: Segmentación en tramos:
  - Al día (dentro del plazo acordado).
  - Vencido 1 a 15 días.
  - Vencido 16 a 30 días.
  - Mora crítica (+30 días).

---

## 4. Endpoints del Módulo

- `GET /api/personas/deudores?route=:ruta`: Lista consolidada de clientes con saldo deudor agrupados por ruta y sucursal.
- `GET /api/personas/:id/cuenta-corriente`: Detalle cronológico de comprobantes, cobros y saldo vivo acumulado.
- `POST /api/personas/cobranza`: Registra un recibo de pago e imputa automáticamente bajo algoritmo FIFO a los comprobantes más antiguos.
