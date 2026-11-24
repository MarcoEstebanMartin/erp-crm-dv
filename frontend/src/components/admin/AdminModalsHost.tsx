import { lazy, Suspense } from 'react';
import { AdminSummaryCardModal } from './AdminSummaryCardModal';
import { AdminOrderDetailsModal } from './AdminOrderDetailsModal';
import { AdminPaymentModal } from './AdminPaymentModal';
import { AdminQuickClientSearchModal } from './AdminQuickModals';
import type { useAdminController } from './useAdminController';

const PriceListModal = lazy(() => import('../PriceListModal'));
const SellerProfileModal = lazy(() => import('../modals/SellerProfileModal'));
const EditOrderModal = lazy(() => import('../modals/EditOrderModal'));
const ProductModal = lazy(() => import('../modals/ProductModal'));
const ClientModal = lazy(() => import('../modals/ClientModal'));
const ImportZipModal = lazy(() => import('../modals/ImportZipModal'));
const ResumenCuentaModal = lazy(() => import('../modals/ResumenCuentaModal'));
const QuickPriceSearchModal = lazy(() => import('../modals/QuickPriceSearchModal'));
const OrderFulfillmentModal = lazy(() => import('../modals/OrderFulfillmentModal'));
const AdminCreateQuickOrderModal = lazy(() =>
  import('./AdminCreateQuickOrderModal').then((m) => ({
    default: m.AdminCreateQuickOrderModal,
  })),
);
const AdminDirectInvoiceQuickModal = lazy(() =>
  import('./AdminDirectInvoiceQuickModal').then((m) => ({
    default: m.AdminDirectInvoiceQuickModal,
  })),
);

interface AdminModalsHostProps {
  c: ReturnType<typeof useAdminController>;
  setActiveTab: (tab: string) => void;
}

export function AdminModalsHost({ c, setActiveTab }: AdminModalsHostProps) {
  return (
    <>
      <AdminSummaryCardModal
        summaryCardModal={c.summaryCardModal}
        orders={c.orders}
        onClose={() => c.setSummaryCardModal(null)}
        onSelectOrderDetails={c.setOrderDetailsModal}
        onViewAllInOrdersTab={(cardKey) => {
          c.setOrderStatusFilter(cardKey);
          setActiveTab('orders');
          c.setSummaryCardModal(null);
        }}
        onNavigateOperationalTab={(tab) => {
          setActiveTab(tab);
          c.setSummaryCardModal(null);
        }}
        onOrderDelivered={c.fetchData}
        setErrorMsg={c.setErrorMsg}
        setSuccessMsg={c.setSuccessMsg}
      />

      <AdminOrderDetailsModal
        orderDetailsModal={c.orderDetailsModal}
        onClose={() => c.setOrderDetailsModal(null)}
        onFastInvoice={(order) => c.setFastInvoiceOrder(order)}
        fetchData={c.fetchData}
        onOrderUpdated={(updated) =>
          c.setOrderDetailsModal((prev: any) => (prev ? { ...prev, ...updated } : null))
        }
        setErrorMsg={c.setErrorMsg}
        setSuccessMsg={c.setSuccessMsg}
      />

      {c.editOrderModal?.open && (
        <Suspense fallback={null}>
          <EditOrderModal
            editOrderModal={c.editOrderModal}
            setEditOrderModal={c.setEditOrderModal}
            products={c.products}
            fetchData={c.fetchData}
            setSuccessMsg={c.setSuccessMsg}
            setErrorMsg={c.setErrorMsg}
          />
        </Suspense>
      )}
      {c.productModal?.open && (
        <Suspense fallback={null}>
          <ProductModal
            productModal={c.productModal}
            setProductModal={c.setProductModal}
            rubrosList={c.rubrosList}
            providersList={c.providersList}
            fetchData={c.fetchData}
            setSuccessMsg={c.setSuccessMsg}
            setErrorMsg={c.setErrorMsg}
          />
        </Suspense>
      )}
      {c.showResumenModal && (
        <Suspense fallback={null}>
          <ResumenCuentaModal
            client={c.showResumenModal}
            onClose={() => c.setShowResumenModal(null)}
          />
        </Suspense>
      )}
      {c.clientModal?.open && (
        <Suspense fallback={null}>
          <ClientModal
            clientModal={c.clientModal}
            setClientModal={c.setClientModal}
            availableSellers={c.availableSellers}
            availableSaleRoutes={c.availableSaleRoutes}
            fetchData={c.fetchData}
            setSuccessMsg={c.setSuccessMsg}
            setErrorMsg={c.setErrorMsg}
            setClientsVersion={c.setClientsVersion}
            setPaymentModal={c.setPaymentModal}
          />
        </Suspense>
      )}
      {c.importZipModalOpen && (
        <Suspense fallback={null}>
          <ImportZipModal
            isOpen={c.importZipModalOpen}
            onClose={() => {
              c.setImportZipModalOpen(false);
              c.fetchData();
            }}
          />
        </Suspense>
      )}
      {c.sellerProfileModal?.open && (
        <Suspense fallback={null}>
          <SellerProfileModal
            sellerId={c.sellerProfileModal.sellerId}
            onClose={() => c.setSellerProfileModal(null)}
            onOpenReport={() => setActiveTab('reports')}
          />
        </Suspense>
      )}

      <AdminPaymentModal
        paymentModal={c.paymentModal}
        clientProfileModal={
          c.clientModal?.open && c.clientModal?.mode === 'edit' && c.clientModal?.data?.id
            ? { open: true, client: c.clientModal.data, ledger: [] }
            : null
        }
        onClose={() => c.setPaymentModal(null)}
        onSuccess={async (clientId) => {
          if (c.clientModal?.open && c.clientModal?.mode === 'edit' && c.clientModal?.data?.id === clientId) {
            await c.handleRefreshClientProfile(clientId);
          }
          c.fetchData();
          c.setClientsVersion((prev) => prev + 1);
        }}
        setErrorMsg={c.setErrorMsg}
        setSuccessMsg={c.setSuccessMsg}
      />

      {c.fastInvoiceOrder && (
        <Suspense fallback={null}>
          <OrderFulfillmentModal
            order={c.fastInvoiceOrder}
            onClose={() => c.setFastInvoiceOrder(null)}
            onSuccess={() => {
              c.setFastInvoiceOrder(null);
              c.fetchData();
            }}
          />
        </Suspense>
      )}

      {c.isPriceListModalOpen && (
        <Suspense fallback={null}>
          <PriceListModal
            isOpen={c.isPriceListModalOpen}
            onClose={() => c.setIsPriceListModalOpen(false)}
          />
        </Suspense>
      )}
      {c.isQuickSearchModalOpen && (
        <Suspense fallback={null}>
          <QuickPriceSearchModal
            isOpen={c.isQuickSearchModalOpen}
            onClose={() => c.setIsQuickSearchModalOpen(false)}
          />
        </Suspense>
      )}

      <AdminQuickClientSearchModal
        clientSearchModal={c.clientSearchModal}
        clients={c.clients}
        quickClientQuery={c.quickClientQuery}
        setQuickClientQuery={c.setQuickClientQuery}
        onClose={() => c.setClientSearchModal(null)}
        onSelectClientAction={(action, client) => {
          if (action === 'ledger') c.setShowResumenModal(client);
          else if (action === 'payment')
            c.setPaymentModal({ open: true, clientId: client.id, clientName: client.name });
          else if (action === 'order')
            c.setCreateOrderModal({ open: true, client, cart: [], notes: '' });
        }}
      />

      {c.createOrderModal?.open && (
        <Suspense fallback={null}>
          <AdminCreateQuickOrderModal
            createOrderModal={c.createOrderModal}
            setCreateOrderModal={c.setCreateOrderModal}
            products={c.products}
            onSuccess={c.fetchData}
            setErrorMsg={c.setErrorMsg}
            setSuccessMsg={c.setSuccessMsg}
          />
        </Suspense>
      )}

      {c.isDirectInvoiceModalOpen && (
        <Suspense fallback={null}>
          <AdminDirectInvoiceQuickModal
            isOpen={c.isDirectInvoiceModalOpen}
            onClose={() => c.setIsDirectInvoiceModalOpen(false)}
            clients={c.clients}
            products={c.products}
            onSuccess={c.fetchData}
            setErrorMsg={c.setErrorMsg}
            setSuccessMsg={c.setSuccessMsg}
          />
        </Suspense>
      )}
    </>
  );
}
