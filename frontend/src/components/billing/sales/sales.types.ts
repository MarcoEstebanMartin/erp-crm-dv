export type SalesInvoiceTypeFilter = 'ALL' | 'OFFICIAL' | 'INTERNAL';

export interface SalesBillingTabProps {
  salesInvoices: any[];
  personas: any[];
  products: any[];
  bankAccounts: any[];
  activeDrawers: any[];
  loading: boolean;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  handleCreateCreditNoteFromInvoice: (invoice: any) => void;
}

export interface DirectInvoiceFormState {
  personaId: string;
  billingType: string;
  immediatePayment: boolean;
  paymentMethod: string;
  cashDrawerId: string;
  bankAccountId: string;
  checkNumber: string;
  checkIssuer: string;
  isEcheq: boolean;
}

export interface DirectCartItem {
  product: any;
  quantity: number | '';
  weight: number | null;
  unitPrice: number;
  subtotal: number;
  isEmergencyOverride?: boolean;
}

export interface DirectBillingTotals {
  net: number;
  tax: number;
  percepcion: number;
  percepcionIva: number;
  total: number;
}

export const INITIAL_DIRECT_INVOICE_FORM: DirectInvoiceFormState = {
  personaId: '',
  billingType: 'INTERNAL',
  immediatePayment: true,
  paymentMethod: 'CASH',
  cashDrawerId: '',
  bankAccountId: '',
  checkNumber: '',
  checkIssuer: '',
  isEcheq: false
};
