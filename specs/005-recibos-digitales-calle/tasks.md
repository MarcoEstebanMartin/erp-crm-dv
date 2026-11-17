# Checklist de Implementación (`005-recibos-digitales-calle`)

- [x] **T001 (Fase A)**: Agregar modelos `FieldReceipt`, `FieldReceiptPayment`, `CollectorSettlement` y enums en `backend/prisma/schema.prisma`, generar migración con `--create-only` (verificando no eliminar `movement_seq`) y aplicar con `npx prisma migrate deploy`.
- [x] **T002 (Fase A)**: Implementar `fieldReceipts.engine.ts` (`Decimal.js` pesos enteros: suma de medios de pago combinados, pagos parciales/a cuenta, cálculo de rendición de reparto, diferencias de arqueo y reversiones) + `fieldReceipts.engine.test.ts` en `Vitest`.
- [x] **T003 (Fase B)**: Implementar `fieldReceipts.schema.ts` (`Zod`) y `fieldReceipts.service.ts` (`offline-bundle`, `sync` idempotente por `provisionalCode`, asiento `CREDIT` en `AccountLedger`, verificación/rechazo de transferencias y cheques, anulación auditada y aprobación de rendiciones).
- [x] **T004 (Fase B)**: Implementar `receiptPdf.service.ts` (PDF oficial inalterable con código de verificación) y `whatsappDispatch.service.ts` (integración directa con Meta WhatsApp Cloud API - plantilla `Utility` + webhook de estado).
- [x] **T005 (Fase B)**: Implementar `fieldReceipts.controller.ts` y `fieldReceipts.routes.ts` montados en `/api/field-receipts`.
- [x] **T006 (Fase C)**: Implementar cola offline segura en IndexedDB (`offlineReceiptQueue.ts`) con precarga de ruta/saldos, bloqueo de edición/borrado local y sincronización automática al recuperar señal.
- [ ] **T007 (Fase C)**: Construir vista móvil de cobranza en calle (`FieldCollectionPage.tsx` y `FieldCollectModal.tsx`) soportando pagos parciales, a cuenta, combinados y cámara directa para fotos de comprobantes/cheques.
- [ ] **T008 (Fase D)**: Construir panel de oficina en `Caja y Cobranzas` (`SettlementsTab.tsx` / verificación de transferencias, cartera de cheques, aprobación de rendiciones y monitor de envíos WhatsApp). Verificar `tsc --noEmit` + `vitest run`.
