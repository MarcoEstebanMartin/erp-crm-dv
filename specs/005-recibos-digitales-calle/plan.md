# Plan Técnico de Implementación (`005-recibos-digitales-calle`)

## 1. Arquitectura en 4 Capas y Reglas de Código
Se respeta estrictamente la separación de responsabilidades de `AGENTS.md`:
- Archivos objetivo: `150–300` líneas (techo máximo `450` por cohesión).
- Cálculos monetarios exclusivamente en `Decimal.js` (`ROUND_HALF_UP`, 0 decimales).
- Migración Prisma generada con `--create-only`, verificando que no exista `DROP SEQUENCE movement_seq` antes de `migrate deploy`.

---

## 2. Fases de Implementación (Paso a Paso)

### Fase A — Base de Datos y Motor Matemático (Backend Core)
1. **Migración Prisma**: Agregar `FieldReceipt`, `FieldReceiptPayment`, `CollectorSettlement` y sus enums en `backend/prisma/schema.prisma`.
2. **`fieldReceipts.engine.ts`** (< 220 líneas):
   - Validación de suma de medios de pago (`Efectivo + Transferencias + Cheques === Total del Recibo`) en `Decimal.js`.
   - Cálculo de totales esperados para `CollectorSettlement` (efectivo a rendir, cheques físicos a entregar, transferencias pendientes, diferencia de arqueo).
   - Lógica pura de reversión ante rechazo de transferencia/cheque o anulación.
3. **`fieldReceipts.engine.test.ts`**: Cobertura al 100% en `Vitest` de todas las cuentas, redondeos, idempotencia y reversiones.

### Fase B — Servicios de Negocio, PDF y WhatsApp Cloud API (Backend)
1. **`fieldReceipts.schema.ts`** (< 150 líneas): Validaciones `Zod` (fotos obligatorias en transferencias y cheques físicos, `provisionalCode` requerido, motivo obligatorio en anulaciones).
2. **`fieldReceipts.service.ts`** (< 350 líneas):
   - `getOfflineBundle(userId)`: clientes, saldos de `AccountLedger` y facturas pendientes.
   - `syncReceipt(payload)` dentro de `prisma.$transaction`: idempotencia por `provisionalCode`, asignación de número oficial correlativo, asiento `CREDIT` en `AccountLedger`, actualización de cartera en tránsito.
   - `verifyTransfer`, `rejectCheck`, `voidReceipt`, `approveSettlement`.
3. **`receiptPdf.service.ts`** (< 200 líneas): Generación de PDF oficial inalterable con detalle de medios de pago, saldo restante y código de verificación.
4. **`whatsappDispatch.service.ts`** (< 180 líneas): Integración directa con **Meta WhatsApp Cloud API** (plantilla `Utility` + adjunto PDF) con manejo de estados (`PENDING`, `SENT`, `DELIVERED`, `FAILED`) y webhook de confirmación de entrega.
5. **`fieldReceipts.controller.ts` & `fieldReceipts.routes.ts`** (< 120 líneas cada uno).

### Fase C — Vista Móvil + Cola Offline Segura (Frontend PWA)
1. **Almacenamiento Offline (`offlineReceiptQueue.ts`)** (< 200 líneas):
   - IndexedDB local para guardar el *bundle* de clientes/saldos y la cola de cobros sin señal.
   - Sin botones de borrado ni edición local.
   - Detector de conectividad (`online` / `offline`) con sincronización automática en segundo plano al recuperar señal.
2. **Vista de Cobranza en Calle (`FieldCollectionPage.tsx` + `FieldCollectModal.tsx`)** (< 280 líneas cada uno):
   - Diseño minimalista pensado para usar con una mano en celular.
   - Selector de cliente -> facturas/saldo -> medio(s) de pago -> cámara directa para foto de cheque/transferencia -> confirmar.
   - Indicador claro de estado de sincronización (*"3 cobros pendientes de señal"*).

### Fase D — Panel de Rendiciones y Verificación en Oficina (Frontend Admin)
1. **`SettlementsTab.tsx` / extensión en `Caja y Cobranzas`** (< 280 líneas):
   - Vista de **Rendición de Reparto / Vendedor**: muestra recibos del día, bloqueo si quedan cobros offline sin sincronizar en el teléfono, conteo de efectivo, recepción de cheques físicos y botón de aprobación.
   - Bandeja de **Transferencias por Verificar** (con visor de foto del comprobante y botones `Acreditar` / `Rechazar`).
   - Gestión de **Cheques en Cartera** (con opción de marcar `Rechazado` y aviso automático).
   - Monitor de **Envíos WhatsApp** (reintentar envío si un número falló).
