import React, { useMemo, useRef } from 'react';
import { WebChatWidget } from './WebChatWidget';
import {
  type CartItem,
  type ClientPortalProps,
  type ClientProfile,
  type PortalTab,
  type StoreProduct,
  checkShowAccountBalance
} from './portal/portal.types';
import { portalLayoutStyles as layoutStyles } from './portal/portalLayout.styles';
import { usePortalAuth } from './portal/usePortalAuth';
import { usePortalStore } from './portal/usePortalStore';
import { PortalLoginView } from './portal/PortalLoginView';
import { PortalHeaderAndTabs } from './portal/PortalHeaderAndTabs';
import { PortalCatalogView } from './portal/PortalCatalogView';
import { PortalAccountView, PortalOrdersView } from './portal/PortalAccountAndOrdersViews';
import { PortalCartDrawer, PortalFloatingCartBar } from './portal/PortalCartDrawer';

export type { ClientPortalProps, ClientProfile, StoreProduct, CartItem };

export const ClientPortal: React.FC<ClientPortalProps> = ({ onBackToStaffLogin }) => {
  const storeActionsRef = useRef<{
    setActiveTab: (tab: PortalTab) => void;
    handleMagicDraftLoaded: (products: StoreProduct[], draftItems: CartItem[]) => void;
    clearCart: () => void;
  } | null>(null);

  const auth = usePortalAuth({
    onTargetTab: (tab) => storeActionsRef.current?.setActiveTab(tab),
    onMagicDraftLoaded: (prods, items) => storeActionsRef.current?.handleMagicDraftLoaded(prods, items),
    onClearCart: () => storeActionsRef.current?.clearCart()
  });

  const store = usePortalStore({
    client: auth.client,
    expireSession: auth.expireSession
  });

  storeActionsRef.current = {
    setActiveTab: store.setActiveTab,
    handleMagicDraftLoaded: store.handleMagicDraftLoaded,
    clearCart: () => store.setCart([])
  };

  const showAccountBalance = useMemo(() => checkShowAccountBalance(auth.client), [auth.client]);

  if (!auth.client) {
    return (
      <PortalLoginView
        logoFailed={auth.logoFailed}
        setLogoFailed={auth.setLogoFailed}
        pendingClient={auth.pendingClient}
        setPendingClient={auth.setPendingClient}
        loginSearch={auth.loginSearch}
        setLoginSearch={auth.setLoginSearch}
        isLoggingIn={auth.isLoggingIn}
        loginError={auth.loginError}
        setLoginError={auth.setLoginError}
        availableClients={auth.availableClients}
        pinInput={auth.pinInput}
        setPinInput={auth.setPinInput}
        pinMessage={auth.pinMessage}
        hasPin={auth.hasPin}
        fetchAvailableClients={auth.fetchAvailableClients}
        handleSelectClient={auth.handleSelectClient}
        handlePinSubmit={auth.handlePinSubmit}
        onBackToStaffLogin={onBackToStaffLogin}
      />
    );
  }

  return (
    <div style={layoutStyles.portalContainer}>
      <PortalHeaderAndTabs
        client={auth.client}
        logoFailed={auth.logoFailed}
        setLogoFailed={auth.setLogoFailed}
        showAccountBalance={showAccountBalance}
        cartTotalItemsCount={store.cartTotalItemsCount}
        onOpenCart={() => store.setIsCartOpen(true)}
        onLogout={auth.handleLogoutClient}
        orderSuccessMessage={store.orderSuccessMessage}
        onClearSuccessMessage={() => store.setOrderSuccessMessage(null)}
        magicBanner={auth.magicBanner}
        onClearMagicBanner={() => auth.setMagicBanner(null)}
        activeTab={store.activeTab}
        setActiveTab={store.setActiveTab}
        recentOrdersCount={store.recentOrders.length}
      />

      {store.activeTab === 'catalog' && (
        <PortalCatalogView
          products={store.products}
          filteredProducts={store.filteredProducts}
          commercialGroups={store.commercialGroups}
          selectedGroupId={store.selectedGroupId}
          onSelectGroup={(groupId) => {
            store.setSelectedGroupId(groupId);
            store.setSelectedRubroId(null);
          }}
          onlyOffers={store.onlyOffers}
          setOnlyOffers={store.setOnlyOffers}
          searchQuery={store.searchQuery}
          setSearchQuery={store.setSearchQuery}
          isLoadingCatalog={store.isLoadingCatalog}
          cart={store.cart}
          imageErrors={store.imageErrors}
          onImageError={(id) => store.setImageErrors((prev) => ({ ...prev, [id]: true }))}
          onAddToCart={store.addToCart}
          onUpdateQty={store.updateCartQuantity}
        />
      )}

      {store.activeTab === 'account' && showAccountBalance && (
        <PortalAccountView
          client={auth.client}
          isLoadingAccount={store.isLoadingAccount}
          recentOrders={store.recentOrders}
        />
      )}

      {store.activeTab === 'orders' && (
        <PortalOrdersView
          recentOrders={store.recentOrders}
          onRepeatOrder={store.handleRepeatOrder}
        />
      )}

      <PortalCartDrawer
        isOpen={store.isCartOpen}
        onClose={() => store.setIsCartOpen(false)}
        clientName={auth.client.name}
        cart={store.cart}
        onUpdateQty={store.updateCartQuantity}
        orderNotes={store.orderNotes}
        setOrderNotes={store.setOrderNotes}
        cartTotalNeto={store.cartTotalNeto}
        cartTotalIva={store.cartTotalIva}
        cartTotalFinal={store.cartTotalFinal}
        isSubmittingOrder={store.isSubmittingOrder}
        onSubmitOrder={store.handleSubmitOrder}
      />

      <PortalFloatingCartBar
        cartTotalItemsCount={store.cartTotalItemsCount}
        cartTotalFinal={store.cartTotalFinal}
        isCartOpen={store.isCartOpen}
        onOpenCart={() => store.setIsCartOpen(true)}
      />

      <WebChatWidget
        customerName={auth.client?.name}
        priceListType={(auth.client?.priceList as any) || 'LISTA_A'}
      />
    </div>
  );
};

export default ClientPortal;
