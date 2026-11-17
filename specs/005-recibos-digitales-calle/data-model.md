# Modelo de Datos y Contratos API (`005-recibos-digitales-calle`)

> **Base existente**: Se apoya en `Persona`, `Order`, `Transaction`, `CashDrawer`, `BankAccount` y `AccountLedger` de `backend/prisma/schema.prisma`.

---

## 1. Nuevas Entidades y Extensiones en PostgreSQL (Prisma)

### 1.1. Recibo Digital en Calle (`FieldReceipt`)
Representa cada recibo emitido por un vendedor o repartidor (online u offline). **Es inmutable**: no se borra ni se edita; solo cambia de estado por flujos auditados.
- `id`: `Int @id @default(autoincrement())`
- `receiptNumber`: `String? @unique` (asignado exclusivamente por el servidor al confirmar/sincronizar, ej. `REC-0001-00004512`)
- `provisionalCode`: `String @unique` (UUID / `idempotencyKey` generado en el dispositivo, ej. `PROV-12-1731840000-a1b2`)
- `personaId`: `Int` (Cliente)
- `collectorUserId`: `Int` (Vendedor o Repartidor que cobró)
- `deliveryRouteId`: `Int?` (Ruta de reparto asociada, si aplica)
- `billingType`: `BillingType` (`INTERNAL` | `OFFICIAL`)
- `totalAmount`: `Decimal @db.Decimal(12, 2)` (Peso entero `ROUND_HALF_UP`)
- `status`: `FieldReceiptStatus` (`ISSUED` | `PENDING_VERIFICATION` | `VERIFIED` | `VOIDED`)
- `voidReason`: `String?`
- `voidedByUserId`: `Int?`
- `voidedAt`: `DateTime?`
- `gpsLat`: `Decimal?` / `gpsLng`: `Decimal?` (opcional, coordenadas del cobro)
- `capturedAt`: `DateTime` (fecha/hora en el celular al momento del cobro)
- `syncedAt`: `DateTime @default(now())` (fecha/hora en el servidor)
- `settlementId`: `Int?` (Rendición diaria a la que pertenece)
- `transactionId`: `Int? @unique` (Vínculo con `Transaction` y `AccountLedger`)
- `whatsappStatus`: `WhatsAppDispatchStatus` (`PENDING` | `SENT` | `DELIVERED` | `FAILED`)
- `whatsappMessageId`: `String?` (ID devuelto por Meta Cloud API)
- `whatsappError`: `String?`
- `pdfUrl`: `String?` (ruta/hash del PDF oficial generado)

### 1.2. Ítems de Medio de Pago del Recibo (`FieldReceiptPayment`)
Un mismo recibo puede combinar medios de pago (ej. parte efectivo + parte transferencia).
- `id`: `Int @id @default(autoincrement())`
- `fieldReceiptId`: `Int`
- `paymentMethod`: `PaymentMethod` (`CASH` | `BANK_TRANSFER` | `CHECK`)
- `amount`: `Decimal @db.Decimal(12, 2)` (Peso entero)
- `status`: `PaymentVerificationStatus` (`IN_TRANSIT` | `PENDING_BANK` | `CLEARED` | `REJECTED`)
- **Para Transferencia**:
  - `bankAccountId`: `Int?`
  - `transferReference`: `String?`
  - `proofImageUrl`: `String?` (foto obligatoria del comprobante)
- **Para Cheque / eCheq**:
  - `checkBank`: `String?`
  - `checkNumber`: `String?`
  - `checkIssuerCuit`: `String?`
  - `checkDueDate`: `DateTime?`
  - `checkFrontImageUrl`: `String?`
  - `checkBackImageUrl`: `String?`
  - `isEcheq`: `Boolean @default(false)`
  - `rejectionReason`: `String?`

### 1.3. Rendición Diaria de Cobrador (`CollectorSettlement`)
Agrupa todo lo que un vendedor o repartidor tiene en tránsito hasta que lo entrega en tesorería.
- `id`: `Int @id @default(autoincrement())`
- `collectorUserId`: `Int`
- `deliveryRouteId`: `Int?`
- `status`: `SettlementStatus` (`OPEN` | `SUBMITTED` | `APPROVED` | `DISCREPANCY`)
- `expectedCash`: `Decimal @db.Decimal(12, 2)`
- `declaredCash`: `Decimal? @db.Decimal(12, 2)`
- `cashDifference`: `Decimal? @db.Decimal(12, 2)` (sobrante/faltante auditable)
- `expectedChecksCount`: `Int`
- `expectedChecksAmount`: `Decimal @db.Decimal(12, 2)`
- `pendingTransfersAmount`: `Decimal @db.Decimal(12, 2)`
- `approvedByUserId`: `Int?`
- `approvedAt`: `DateTime?`
- `notes`: `String?`

---

## 2. Contratos API Principales (`/api/field-receipts`)

1. `GET /api/field-receipts/offline-bundle`
   - Descarga la hoja de ruta del cobrador: clientes asignados, saldos reales (`AccountLedger`) y facturas pendientes para operar sin señal.
2. `POST /api/field-receipts/sync`
   - Recibe un cobro (o lote de cobros offline) con `provisionalCode` + fotos.
   - Idempotente: si el `provisionalCode` ya existe, devuelve el recibo ya creado sin duplicarlo.
   - Asigna `receiptNumber`, impacta `AccountLedger`, suma a la cartera en tránsito del cobrador y encola generación de PDF + envío por Meta WhatsApp Cloud API.
3. `POST /api/field-receipts/:id/verify-transfer`
   - Administración marca una transferencia como `CLEARED` (acredita en `BankAccount`) o `REJECTED` (revierte recibo y revive deuda en `AccountLedger`).
4. `POST /api/field-receipts/:id/reject-check`
   - Tesorería marca un cheque como `REJECTED`, revierte el pago y revive la deuda del cliente.
5. `POST /api/field-receipts/:id/void`
   - Anulación auditada de recibo con motivo obligatorio y contra-asiento automático.
6. `GET /api/field-receipts/settlements/current` & `POST /api/field-receipts/settlements/:id/approve`
   - Consulta y aprobación de la rendición diaria del repartidor/vendedor (traspaso de *En Tránsito* a *Caja Grande* / *Cartera Central*).
7. `POST /api/field-receipts/:id/resend-whatsapp`
   - Reintento manual de envío de PDF por Meta Cloud API si falló o el cliente cambió de teléfono.
