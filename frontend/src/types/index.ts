export type Role = 'ADMIN' | 'FACTURACION' | 'VENDEDOR' | 'DEPOSITO';
export type BillingType = 'OFFICIAL' | 'INTERNAL';
export type InvoiceType = 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'PRESUPUESTO';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'PREPARED' | 'DELIVERED' | 'CANCELLED';
export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';
export type TransactionType = 'INCOME' | 'OUTCOME';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';

export interface User {
  id: number;
  username: string;
  role: Role;
  isActive: boolean;
}

export interface Persona {
  id: number;
  name: string;
  cuit?: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  rubro?: string;
  isClient: boolean;
  isProvider: boolean;
  isSeller: boolean;
  isCommissionAgent: boolean;
  creditLimit: number | string;
  maxUnpaidInvoices: number | string;
  priceList: string;
  discount: number | string;
  outstandingBalance: number | string;
  route?: string;
  saleRouteId?: number;
  routeSequence?: number;
  latitude?: number;
  longitude?: number;
  sellerId?: number;
  iibbAliquot: number | string;
  paymentTermDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductLot {
  id: number;
  productId: number;
  product?: Product;
  lotNumber: string;
  expirationDate: string;
  stock: number;
  location: string;
}

export interface Rubro {
  id: number;
  name: string;
  description?: string;
  profitMargin: number | string;
  pickingZone: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  costPrice: number | string;
  listPrice: number | string;
  listPriceB: number | string;
  listPriceC: number | string;
  profitMargin?: number | string;
  stock: number;
  minStock: number;
  isPesable: boolean;
  unitsPerBox: number;
  minOrderQuantity?: number;
  approximateWeight?: number | string;
  imageUrl?: string;
  isActive: boolean;
  rubroId?: number;
  rubro?: Rubro;
  providerId?: number;
  lots?: ProductLot[];
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  product?: Product;
  quantity: number;
  weight?: number | string;
  unitPrice: number | string;
  subtotal: number | string;
  isEmergencyOverride?: boolean;
  orderItemLots?: any[];
}

export interface DeliveryRoute {
  id: number;
  driverName: string;
  vehiclePlate: string;
  status: string;
  date: string;
}

export interface Order {
  id: number;
  movementId: number;
  personaId: number;
  persona?: Persona;
  clientId?: number;
  client?: Persona;
  sellerId: number;
  seller?: User;
  billingType: BillingType;
  invoiceType: InvoiceType;
  invoiceNumber?: string;
  cae?: string;
  caeDueDate?: string;
  status: OrderStatus;
  totalAmount: number | string;
  netAmount: number | string;
  taxAmount: number | string;
  percepcionAmount: number | string;
  percepcionIvaAmount: number | string;
  bultosCount: number;
  bultosDetails?: any;
  deliveryRouteId?: number;
  deliveryRoute?: DeliveryRoute;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface Transaction {
  id: number;
  movementId: number;
  orderId?: number;
  order?: Order;
  personaId?: number;
  persona?: Persona;
  userId: number;
  user?: User;
  billingType: BillingType;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  amount: number | string;
  description?: string;
  receiptNumber?: string;
  cashDrawerId?: number;
  bankAccountId?: number;
  createdAt: string;
  verified: boolean;
}

export interface CashDrawer {
  id: number;
  userId: number;
  user?: User;
  branch: string;
  drawerType?: string; // "DEPOSITO" | "VENDEDOR" | "REPARTIDOR"
  routeNote?: string; // Pueblo o Ruta de cobro (ej: "Villegas / Bunge")
  notes?: string; // Observaciones de arqueo
  openingBalance: number | string;
  closingBalance?: number | string;
  realBalance?: number | string;
  status: string;
  openedAt: string;
  closedAt?: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string;
}

export interface Expense {
  id: number;
  amount: number | string;
  date: string;
  description: string;
  categoryId: number;
  category?: ExpenseCategory;
  userId: number;
  user?: User;
  paymentMethod: PaymentMethod;
  cashDrawerId?: number;
  bankAccountId?: number;
  vehicleId?: number;
  transactionId?: number;
}

export interface SaleRoute {
  id: number;
  name: string;
  sellerId?: number;
  seller?: User;
  dayOfWeek?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
