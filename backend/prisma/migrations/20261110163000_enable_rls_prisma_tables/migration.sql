-- Blindaje de Seguridad Supabase (PostgREST):
-- Habilita Row Level Security (RLS) en las 48 tablas gestionadas por Prisma.
-- Sin políticas permisivas para los roles públicos `anon` / `authenticated`,
-- la Data API pública de Supabase queda bloqueada por defecto (deny-all),
-- mientras que el Backend Express + Prisma (conectado como rol propietario `postgres`)
-- mantiene acceso transaccional completo sin afectación.

ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Persona" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProductLot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrderItemLot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CashDrawer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SupplierInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TaxWithholding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DeliveryRoute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PurchaseOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CreditNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CreditNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Rubro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WeeklyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PerceptionType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DiscountRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SplitBillingConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SaleRoute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SaleRouteVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VehicleMaintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VehicleExpiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExpenseCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProviderProductMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OfferCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OfferCampaignItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SalaryAdvance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payroll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmployeeVacation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmployeeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FuelLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CrmConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CrmMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CrmOrderDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WeeklySchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SystemSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RouteGpsPing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AccountLedger" ENABLE ROW LEVEL SECURITY;
