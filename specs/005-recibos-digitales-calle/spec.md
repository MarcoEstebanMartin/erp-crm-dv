# Especificación de Módulo (Spec-Kit): Recibos Digitales en Calle, Modo Offline y WhatsApp (`005-recibos-digitales-calle`)

> **Estado**: Borrador para revisión y validación del usuario  
> **Módulo**: `specs/005-recibos-digitales-calle/`  
> **Depende de**: `004-cuentas-corrientes-tesoreria` (`AccountLedger`, `Decimal.js` en pesos enteros)

---

## 1. Propósito y Resumen Ejecutivo (Qué y Por Qué)
Eliminar el talonario físico de papel de **vendedores y repartidores** en **Distribuidora Don Venancio**, reemplazándolo por un circuito de **Recibos Digitales Inmutables** emitidos desde celular/tablet en la calle y enviados automáticamente al cliente por **Meta WhatsApp Cloud API (Opción 1)**.

### Principios Innegociables
1. **Dinero en Tránsito vs. Dinero Rendido**: Lo que cobra un repartidor o vendedor en la calle **no** entra directo a `Caja Grande (Central)` ni a `Banco`. Queda registrado en su **Cartera / Caja en Tránsito** personal hasta que el tesorero/cajero lo recibe y aprueba la **Rendición** en la distribuidora.
2. **Numeración Exclusiva del Servidor**: El celular nunca genera números oficiales de recibo. Con señal, el backend asigna el número correlativo al instante. Sin señal, el celular emite un **Código Provisorio único** (`idempotencyKey`) y el servidor asigna el número definitivo al sincronizar, evitando duplicados.
3. **Inmutabilidad Total**: Un recibo guardado (incluso en la cola offline del celular) **no se puede editar ni borrar**. Toda corrección requiere anulación auditada en el servidor con contra-asiento automático en `AccountLedger`.
4. **Pagos Parciales, A Cuenta y Combinados (Sin Restricciones)**:
   - Se acepta **todo tipo de cobro**: cancelación total, **pagos parciales** sobre un comprobante o **pagos a cuenta** sobre el saldo general del cliente en `AccountLedger`.
   - Un mismo recibo puede combinar distintos medios de pago (ej. parte en efectivo + parte en transferencia + cheque).
5. **Reglas por Medio de Pago**:
   - **Efectivo**: Baja la deuda del cliente y suma a la *Caja en Tránsito* del cobrador.
   - **Transferencia**: Exige **foto del comprobante** (y nro. de referencia). Entra como **"Pendiente de verificación bancaria"** hasta que administración confirma el ingreso en `Caja y Cobranzas`. Si se rechaza por no acreditarse, revive automáticamente la deuda del cliente.
   - **Cheque (Físico / eCheq)**: Exige banco, nro. de cheque, CUIT emisor, fecha de pago, monto y **foto frente/dorso** (en físicos). Entra en *Cartera de Cheques en Tránsito* del cobrador. Si el banco rechaza el cheque más adelante, el ERP revierte el pago y revive la deuda del cliente.
6. **Modo Offline Seguro (Sin Señal)**:
   - Al iniciar el día con WiFi, el celular precarga la ruta, clientes y saldos pendientes.
   - Sin señal, guarda los cobros en una cola local persistente y muestra un comprobante provisorio.
   - Al recuperar 4G/WiFi, sincroniza automáticamente sin intervención del chofer y dispara el envío por WhatsApp.
   - **Regla de cierre**: Ningún cobrador puede cerrar su rendición diaria si su dispositivo aún tiene cobros pendientes de sincronizar.
7. **Entrega Automática por Meta WhatsApp Cloud API**:
   - Apenas el recibo obtiene su número oficial en el servidor, se genera un **PDF inalterable** con código/QR de verificación y se envía automáticamente al WhatsApp registrado del cliente mediante una plantilla **Utilidad** de Meta.
   - Se registra el estado de envío (`PENDING`, `SENT`, `DELIVERED`, `FAILED`) para poder reintentar o reenviar si falló.

---

## 2. Escenarios de Uso y Criterios de Aceptación (Given / When / Then)

### Escenario 1: Cobro en Efectivo con Señal y Envío por WhatsApp
- **Dado (Given)** un repartidor autenticado en la vista móvil frente a un cliente con saldo deudor de `$120.000`,
- **Cuando (When)** registra un cobro en **Efectivo** por `$120.000` con conexión a internet,
- **Entonces (Then)** el servidor asigna el número oficial correlativo, asienta el `CREDIT` en `AccountLedger` (saldo del cliente pasa a `$0`), suma `$120.000` a la **Caja en Tránsito** del repartidor, genera el PDF del recibo y lo envía automáticamente al WhatsApp del cliente vía Meta Cloud API.

### Escenario 2: Cobro por Transferencia y Verificación Bancaria
- **Dado (Given)** un vendedor que cobra `$85.000` por **Transferencia Bancaria**,
- **Cuando (When)** adjunta la foto del comprobante y confirma el cobro,
- **Entonces (Then)** el recibo se emite y envía al cliente aclarando *"Sujeto a verificación bancaria"*, y el movimiento queda en estado **Pendiente de verificación** en `Caja y Cobranzas`.
  - Si administración lo **Acredita**, pasa firme al saldo del Banco.
  - Si administración lo **Rechaza** (el dinero nunca entró), el sistema anula el recibo, genera el contra-asiento y revive los `$85.000` en la cuenta corriente del cliente.

### Escenario 3: Cobro con Cheque Físico y Eventual Rechazo
- **Dado (Given)** un cliente que entrega un cheque físico a 30 días por `$200.000`,
- **Cuando (When)** el repartidor carga banco, número, CUIT, fecha de vencimiento, monto y fotos del cheque,
- **Entonces (Then)** el cheque queda en **Cartera de Cheques en Tránsito** del repartidor hasta su entrega física en tesorería. Si posteriormente el cheque es marcado como **Rechazado** en tesorería, el ERP revierte automáticamente la cancelación y restituye la deuda de `$200.000` al cliente.

### Escenario 4: Cobro en Zona Sin Señal (Modo Offline)
- **Dado (Given)** un repartidor con la ruta precargada que ingresa a un comercio sin señal de datos,
- **Cuando (When)** registra un cobro de `$40.000` en efectivo,
- **Entonces (Then)** el dispositivo guarda el cobro de forma local e inalterable con un **Código Provisorio único** (ej. `PROV-...`), muestra el comprobante provisorio en pantalla y lo deja en cola. Apenas el teléfono recupera señal, sincroniza automáticamente con el servidor, obtiene el número oficial definitivo y dispara el PDF por WhatsApp al cliente (sin duplicar el cobro si la señal es intermitente).

### Escenario 5: Rendición Diaria en la Distribuidora
- **Dado (Given)** un repartidor que regresa al depósito al finalizar la jornada,
- **Cuando (When)** el tesorero abre la **Rendición de Reparto** en `Caja y Cobranzas`,
- **Entonces (Then)** el sistema verifica que no queden cobros offline sin sincronizar en el dispositivo del chofer y muestra el detalle exacto a rendir: total en efectivo físico, lista de cheques físicos a entregar y transferencias pendientes de banco. Al confirmar la entrega, el efectivo pasa de la *Caja en Tránsito* del chofer a `Caja Grande (Central)` y los cheques pasan a la *Cartera Central de Cheques*.

### Escenario 6: Anulación de Recibo por Error de Carga
- **Dado (Given)** un recibo ya emitido por `$50.000` donde el vendedor se equivocó de cliente o de monto,
- **Cuando (When)** un usuario con permiso de administración solicita la anulación indicando el motivo,
- **Entonces (Then)** el recibo pasa a estado `ANULADO` (nunca se borra), se registra el contra-asiento automático en `AccountLedger` y en la cartera en tránsito correspondiente, quedando todo auditado con usuario, fecha y hora.
