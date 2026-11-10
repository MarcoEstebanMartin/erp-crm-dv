import { adminUsersSubService } from './admin/admin-users.service';
import { adminFinanceSubService } from './admin/admin-finance.service';
import { adminChannelsSubService } from './admin/admin-channels.service';
import { adminProfitabilitySubService } from './admin/admin-profitability.service';
import { adminZonesSubService } from './admin/admin-zones.service';
import { adminExecutiveSubService } from './admin/admin-executive.service';
import { adminSellerMeetingSubService } from './admin/admin-seller-meeting.service';

export class AdminService {
  // 1. Reportes Financieros y Semanales (con unitCostSnapshot CMV Histórico)
  getFinancialReports = (year?: number, month?: number) =>
    adminFinanceSubService.getFinancialReports(year, month);

  getAutofillSalesForWeek = (weekStart: string) =>
    adminFinanceSubService.getAutofillSalesForWeek(weekStart);

  getWeeklyReports = () => adminFinanceSubService.getWeeklyReports();

  saveWeeklyReport = (data: {
    weekStart: string;
    purchases: any[];
    sales: any[];
    credit: number;
    buffer: number;
  }) => adminFinanceSubService.saveWeeklyReport(data);

  deleteWeeklyReport = (weekStart: string) =>
    adminFinanceSubService.deleteWeeklyReport(weekStart);

  getSuggestedCreditForWeek = (weekStart: string) =>
    adminFinanceSubService.getSuggestedCreditForWeek(weekStart);

  // 2. Usuarios y Logs de Auditoría
  getAuditLogs = (page = 1, limit = 50) =>
    adminUsersSubService.getAuditLogs(page, limit);

  getDocumentAuditLogs = (entityType: string, entityId: number) =>
    adminUsersSubService.getDocumentAuditLogs(entityType, entityId);

  getUsers = () => adminUsersSubService.getUsers();

  createUser = (data: any, adminId?: number) =>
    adminUsersSubService.createUser(data, adminId);

  toggleUserStatus = (id: number, adminId?: number) =>
    adminUsersSubService.toggleUserStatus(id, adminId);

  updateUser = (id: number, data: any, adminId?: number) =>
    adminUsersSubService.updateUser(id, data, adminId);

  deleteUser = (username: string, adminId?: number) =>
    adminUsersSubService.deleteUser(username, adminId);

  // 3. Reportes de Zonas, Rentabilidad y Canales
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

  getSalesChannelStats = (year?: number, month?: number) =>
    adminChannelsSubService.getSalesChannelStats(year, month);

  // 4. Reportes Ejecutivos PDF y Reuniones de Vendedores
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
