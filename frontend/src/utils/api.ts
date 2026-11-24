export {
  API_BASE_URL,
  type AuditLogQueryFilters,
  testServerConnection,
} from './api/httpClient';
import { authApi } from './api/auth.api';
import { productsApi } from './api/products.api';
import { personasApi } from './api/personas.api';
import { ordersApi } from './api/orders.api';
import { adminApi } from './api/admin.api';
import { financeApi } from './api/finance.api';
import { billingLogisticsApi } from './api/billing-logistics.api';
import { commercialApi } from './api/commercial.api';
import { hrCrmApi } from './api/hr-crm.api';

/**
 * Fachada unificada del cliente HTTP de ERP-CRM DV.
 * Los métodos viven organizados por dominio en `src/utils/api/*.api.ts`.
 */
export const api = {
  ...authApi,
  ...productsApi,
  ...personasApi,
  ...ordersApi,
  ...adminApi,
  ...financeApi,
  ...billingLogisticsApi,
  ...commercialApi,
  ...hrCrmApi,
};
