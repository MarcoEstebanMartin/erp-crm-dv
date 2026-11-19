import { apiClient } from './apiClient';
import {
  buildFieldReceiptWhatsAppMessage,
  buildOfficeReceiptWhatsAppMessage,
  buildWhatsAppDeepLink,
} from '../utils/receiptWhatsApp';

export type FieldPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK';
export type FieldReceiptStatus = 'ISSUED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'VOIDED';
export type PaymentVerificationStatus = 'IN_TRANSIT' | 'PENDING_BANK' | 'CLEARED' | 'REJECTED';
export type WhatsAppDispatchStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface OfflineBundleClient {
  id: number;
  name: string;
  cuit: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  route: string | null;
  saleRouteId: number | null;
  routeSequence: number | null;
  outstandingBalance: number;
  sellerId: number | null;
}

export interface OfflineBundleBankAccount {
  id: number;
  name: string;
  accountNumber: string | null;
}

export interface OfflineBundleResponse {
  generatedAt: string;
  collectorUserId: number;
  openSettlementId: number | null;
  clients: OfflineBundleClient[];
  bankAccounts: OfflineBundleBankAccount[];
}

export interface SyncFieldReceiptPaymentPayload {
  paymentMethod: FieldPaymentMethod;
  amount: number;
  bankAccountId?: number | null;
  transferReference?: string | null;
  proofImageUrl?: string | null;
  checkBank?: string | null;
  checkNumber?: string | null;
  checkIssuerCuit?: string | null;
  checkDueDate?: string | null;
  checkFrontImageUrl?: string | null;
  checkBackImageUrl?: string | null;
  isEcheq?: boolean;
}

export interface SyncFieldReceiptPayload {
  provisionalCode: string;
  personaId: number;
  deliveryRouteId?: number | null;
  billingType?: 'INTERNAL' | 'OFFICIAL';
  notes?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  capturedAt: string;
  payments: SyncFieldReceiptPaymentPayload[];
}

export interface FieldReceiptPaymentDTO {
  id: number;
  paymentMethod: FieldPaymentMethod;
  amount: number | string;
  status: PaymentVerificationStatus;
  bankAccountId: number | null;
  transferReference: string | null;
  proofImageUrl: string | null;
  checkBank: string | null;
  checkNumber: string | null;
  checkDueDate: string | null;
  checkFrontImageUrl: string | null;
  isEcheq: boolean;
  rejectionReason: string | null;
}

export interface FieldReceiptDTO {
  id: number;
  receiptNumber: string | null;
  provisionalCode: string;
  personaId: number;
  persona?: { id: number; name: string; phone?: string | null; outstandingBalance?: number | string };
  totalAmount: number | string;
  status: FieldReceiptStatus;
  capturedAt: string;
  whatsappStatus: WhatsAppDispatchStatus;
  whatsappError: string | null;
  pdfUrl: string | null;
  payments: FieldReceiptPaymentDTO[];
}

export interface CollectorSettlementDTO {
  id: number;
  collectorUserId: number;
  collector?: { id: number; username: string; role: string };
  status: 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'DISCREPANCY';
  expectedCash: number | string;
  declaredCash: number | string | null;
  cashDifference: number | string | null;
  expectedChecksCount: number;
  expectedChecksAmount: number | string;
  pendingTransfersAmount: number | string;
  createdAt: string;
  approvedAt: string | null;
  receipts: FieldReceiptDTO[];
}

export interface OfficeReceiptDTO {
  id: number;
  receiptNumber: string | null;
  amount: number | string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
  billingType: 'OFFICIAL' | 'INTERNAL';
  description: string | null;
  verified: boolean;
  createdAt: string;
  personaId: number | null;
  persona?: { id: number; name: string; phone?: string | null } | null;
  user?: { id: number; username: string } | null;
  order?: { id: number; invoiceNumber: string | null } | null;
  bankAccount?: { id: number; name: string } | null;
  shareToken?: string;
  verificationCode?: string;
  publicUrl?: string;
}

export function buildManualWhatsAppUrl(receipt: FieldReceiptDTO): string {
  const text = buildFieldReceiptWhatsAppMessage(receipt, window.location.origin);
  return buildWhatsAppDeepLink(receipt.persona?.phone, text);
}

export function buildOfficeReceiptWhatsAppUrl(receipt: OfficeReceiptDTO): string {
  const text = buildOfficeReceiptWhatsAppMessage(receipt, window.location.origin);
  return buildWhatsAppDeepLink(receipt.persona?.phone, text);
}

export const fieldReceiptsApi = {
  listOfficeReceipts(limit = 200): Promise<OfficeReceiptDTO[]> {
    return apiClient.get(`/collections/receipts?limit=${limit}`);
  },
  deleteOfficeReceipt(id: number): Promise<{ status: string; message: string }> {
    return apiClient.delete(`/collections/receipt/${id}`);
  },
  getOfflineBundle(): Promise<OfflineBundleResponse> {
    return apiClient.get('/field-receipts/offline-bundle');
  },
  syncReceipt(payload: SyncFieldReceiptPayload) {
    return apiClient.post<{ receipt: FieldReceiptDTO; alreadySynced: boolean; whatsapp: any }>(
      '/field-receipts/sync',
      payload as unknown as Record<string, unknown>,
    );
  },
  listMySettlements(): Promise<CollectorSettlementDTO[]> {
    return apiClient.get('/field-receipts/my-settlements');
  },
  listAllSettlements(): Promise<CollectorSettlementDTO[]> {
    return apiClient.get('/field-receipts/settlements');
  },
  approveSettlement(id: number, declaredCash: number, notes?: string) {
    return apiClient.post(`/field-receipts/settlements/${id}/approve`, { declaredCash, notes });
  },
  verifyTransfer(
    paymentId: number,
    action: 'CLEAR' | 'REJECT',
    bankAccountId?: number,
    rejectionReason?: string,
  ) {
    return apiClient.post(`/field-receipts/payments/${paymentId}/verify-transfer`, {
      action,
      bankAccountId,
      rejectionReason,
    });
  },
  rejectCheck(paymentId: number, rejectionReason: string) {
    return apiClient.post(`/field-receipts/payments/${paymentId}/reject-check`, { rejectionReason });
  },
  voidReceipt(receiptId: number, voidReason: string) {
    return apiClient.post(`/field-receipts/${receiptId}/void`, { voidReason });
  },
  resendWhatsApp(receiptId: number) {
    return apiClient.post(`/field-receipts/${receiptId}/resend-whatsapp`, {});
  },
};
