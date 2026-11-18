import { adminUsersSubService } from './admin/admin-users.service';
import { adminAuditSubService, AuditLogFilters } from './admin/admin-audit.service';
import { adminFinanceSubService } from './admin/admin-finance.service';
import { adminProfitabilitySubService } from './admin/admin-profitability.service';
import { adminZonesSubService } from './admin/admin-zones.service';
import { adminExecutiveSubService } from './admin/admin-executive.service';
import { adminSellerMeetingSubService } from './admin/admin-seller-meeting.service';

export class AdminService {
  // 1. Reporte Financiero Consolidado (con unitCostSnapshot CMV Histórico)
  getFinancialReports = (
    paramsOrYear?: number | { year?: number; month?: number; startDate?: string; endDate?: string },
    month?: number,
  ) => adminFinanceSubService.getFinancialReports(paramsOrYear, month);

  // 2. Usuarios y Logs de Auditoría
  getAuditLogs = (page = 1, limit = 50, filters?: AuditLogFilters) =>
    adminAuditSubService.getAuditLogs(page, limit, filters);

  getDocumentAuditLogs = (entityType: string, entityId: number) =>
    adminAuditSubService.getDocumentAuditLogs(entityType, entityId);

  getUsers = () => adminUsersSubService.getUsers();

  createUser = (data: any, adminId?: number) =>
    adminUsersSubService.createUser(data, adminId);

  toggleUserStatus = (id: number, adminId?: number) =>
    adminUsersSubService.toggleUserStatus(id, adminId);

  updateUser = (id: number, data: any, adminId?: number) =>
    adminUsersSubService.updateUser(id, data, adminId);

  deleteUser = (username: string, adminId?: number) =>
    adminUsersSubService.deleteUser(username, adminId);

  getUserPasswordVersion = (id: number) =>
    adminUsersSubService.getUserPasswordVersion(id);

  // 3. Reportes de Zonas y Rentabilidad
  getZoneReports = (filters: {
    sellerId?: number;
    city?: string;
    cities?: string[];
    startDate?: string;
    endDate?: string;
  }) => adminZonesSubService.getZoneReports(filters);

  getProfitabilityReport = (filters: {
    startDate?: string;
    endDate?: string;
    sellerId?: number;
    city?: string;
    rubroId?: number;
    billingType?: string;
  }) => adminProfitabilitySubService.getProfitabilityReport(filters);

  // 4. Reportes Ejecutivos PDF y Fichas de Vendedores
  getExecutivePdfReportData = (startDateStr?: string, endDateStr?: string) =>
    adminExecutiveSubService.getExecutivePdfReportData(startDateStr, endDateStr);

  getSellerMeetingPdfReportData = (
    sellerId: number,
    startDateStr?: string,
    endDateStr?: string,
  ) =>
    adminSellerMeetingSubService.getSellerMeetingPdfReportData(
      sellerId,
      startDateStr,
      endDateStr,
    );
}

export const adminService = new AdminService();
