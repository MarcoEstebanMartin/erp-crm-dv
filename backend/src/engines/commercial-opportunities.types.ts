import { NumericInput } from '../core/money';

export interface OpportunityOrderItemInput {
  productId: number;
  quantity: NumericInput;
}

export interface OpportunityOrderInput {
  id: number;
  clientId: number;
  clientName: string;
  sellerName: string | null;
  createdAt: Date;
  totalAmount: NumericInput;
  items: OpportunityOrderItemInput[];
}

export interface OpportunityProductInput {
  id: number;
  sku: string;
  name: string;
  rubroName: string | null;
  stock: NumericInput;
  costPrice: NumericInput;
  listPrice: NumericInput;
  lastSoldAt: Date | null;
}

export interface OpportunityLotInput {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  lotNumber: string;
  expirationDate: Date;
  stock: NumericInput;
  costPrice: NumericInput;
}

export type ClientRiskReason = 'OVERDUE_CYCLE' | 'REVENUE_DROP' | 'OVERDUE_AND_DROP';

export interface ClientAtRiskItem {
  clientId: number;
  clientName: string;
  sellerName: string | null;
  ordersCount: number;
  daysSinceLastOrder: number;
  avgCycleDays: number;
  monthlyAvgAmount: number;
  recent30Amount: number;
  variationPct: number;
  lastOrderDate: string;
  reason: ClientRiskReason;
}

export interface StagnantProductItem {
  productId: number;
  sku: string;
  name: string;
  rubroName: string | null;
  stock: number;
  daysWithoutSale: number | null;
  capitalTiedUp: number;
  listPrice: number;
}

export type ExpiringLotStatus = 'EXPIRED' | 'CRITICAL' | 'SOON';

export interface ExpiringLotItem {
  lotId: number;
  productId: number;
  sku: string;
  productName: string;
  lotNumber: string;
  expirationDate: string;
  daysToExpire: number;
  stock: number;
  capitalAtRisk: number;
  status: ExpiringLotStatus;
}

export interface StoppedBuyingSuggestion {
  productId: number;
  sku: string;
  name: string;
  listPrice: number;
  stock: number;
  timesBought: number;
  daysSinceLastBought: number;
}

export interface CrossSellSuggestion {
  productId: number;
  sku: string;
  name: string;
  listPrice: number;
  stock: number;
  peerClientsCount: number;
  affinityPct: number;
  basedOnProductName: string;
}

export interface ClientRecommendationItem {
  clientId: number;
  clientName: string;
  sellerName: string | null;
  totalRevenue: number;
  stoppedBuying: StoppedBuyingSuggestion[];
  crossSell: CrossSellSuggestion[];
}

export interface CommercialOpportunitiesSummary {
  clientsAtRiskCount: number;
  clientsAtRiskMonthlyAmount: number;
  stagnantProductsCount: number;
  stagnantCapitalTotal: number;
  expiringLotsCount: number;
  expiredLotsCount: number;
  expiringCapitalTotal: number;
  clientsWithRecommendationsCount: number;
}

export interface CommercialOpportunitiesReport {
  generatedAt: string;
  filters: {
    stagnantDays: number;
    expiringDays: number;
  };
  summary: CommercialOpportunitiesSummary;
  clientsAtRisk: ClientAtRiskItem[];
  stagnantProducts: StagnantProductItem[];
  expiringLots: ExpiringLotItem[];
  recommendations: ClientRecommendationItem[];
}
