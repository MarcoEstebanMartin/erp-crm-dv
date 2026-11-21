import React from 'react';
import { type ClientProfile, type PortalTab, formatMoney } from './portal.types';
import { portalLayoutStyles as styles } from './portalLayout.styles';

interface PortalHeaderAndTabsProps {
  client: ClientProfile;
  logoFailed: boolean;
  setLogoFailed: (val: boolean) => void;
  showAccountBalance: boolean;
  cartTotalItemsCount: number;
  onOpenCart: () => void;
  onLogout: () => void;
  onAdminPriceListChange?: (list: 'A' | 'B' | 'C') => void;
  onBackToStaffLogin?: () => void;
  orderSuccessMessage: string | null;
  onClearSuccessMessage: () => void;
  magicBanner: string | null;
  onClearMagicBanner: () => void;
  activeTab: PortalTab;
  setActiveTab: (tab: PortalTab) => void;
  recentOrdersCount: number;
}

export const PortalHeaderAndTabs: React.FC<PortalHeaderAndTabsProps> = ({
  client,
  logoFailed,
  setLogoFailed,
  showAccountBalance,
  cartTotalItemsCount,
  onOpenCart,
  onLogout,
  onAdminPriceListChange,
  onBackToStaffLogin,
  orderSuccessMessage,
  onClearSuccessMessage,
  magicBanner,
  onClearMagicBanner,
  activeTab,
  setActiveTab,
  recentOrdersCount
}) => {
  return (
    <>
      <header style={styles.topNavbar}>
        <div className="store-header-inner">
          <div style={styles.navBrand}>
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="Logo Don Venancio"
                style={{ height: '44px', objectFit: 'contain' }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div style={styles.logoBadge}>DON VENANCIO</div>
            )}
            <div>
              <div style={styles.clientNameTitle}>{client.name}</div>
              <div style={styles.clientMetaInfo}>
                {client.isAdminPreview ? 'Vista Admin' : `CUIT: ${client.cuit || 'S/D'}`}
              </div>
            </div>
          </div>

          <div style={styles.navActions}>
            {client.isAdminPreview && onAdminPriceListChange && (
              <div
                style={{
                  display: 'inline-flex',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '2px',
                  gap: '2px',
                }}
              >
                {(['A', 'B', 'C'] as const).map((listKey) => {
                  const active = (client.priceList || 'A').toUpperCase() === listKey;
                  return (
                    <button
                      key={listKey}
                      type="button"
                      onClick={() => onAdminPriceListChange(listKey)}
                      style={{
                        background: active ? '#ffffff' : 'transparent',
                        color: active ? '#0f172a' : '#cbd5e1',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Lista {listKey}
                    </button>
                  );
                })}
              </div>
            )}

            {showAccountBalance && (
              <div style={styles.balanceBadge}>
                <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cuenta Corriente
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: client.outstandingBalance > 0 ? '#f87171' : '#34d399' }}>
                  {formatMoney(client.outstandingBalance)}
                </span>
              </div>
            )}

            {!client.isAdminPreview && (
              <button type="button" onClick={onOpenCart} style={styles.cartButton}>
                🛒 Carrito
                {cartTotalItemsCount > 0 && <span style={styles.cartCountBadge}>{cartTotalItemsCount}</span>}
              </button>
            )}

            {client.isAdminPreview && onBackToStaffLogin && (
              <button type="button" onClick={onBackToStaffLogin} style={styles.btnSecondarySmall}>
                Panel Admin
              </button>
            )}

            <button type="button" onClick={onLogout} style={styles.btnSecondarySmall}>
              Salir
            </button>
          </div>
        </div>
      </header>

      {orderSuccessMessage && (
        <div style={styles.successBanner}>
          <span>{orderSuccessMessage}</span>
          <button
            onClick={onClearSuccessMessage}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {magicBanner && (
        <div style={{ ...styles.successBanner, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
          <span>{magicBanner}</span>
          <button
            onClick={onClearMagicBanner}
            style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      <nav className="store-main-tab-nav" style={styles.tabNav}>
        <div className="store-tabs-inner">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`store-main-tab-item ${activeTab === 'catalog' ? 'active' : ''}`}
            style={{ ...styles.tabItem, ...(activeTab === 'catalog' ? styles.tabItemActive : {}) }}
          >
            Catálogo
          </button>
          {showAccountBalance && (
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`store-main-tab-item ${activeTab === 'account' ? 'active' : ''}`}
              style={{ ...styles.tabItem, ...(activeTab === 'account' ? styles.tabItemActive : {}) }}
            >
              Cuenta Corriente
            </button>
          )}
          {!client.isAdminPreview && (
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`store-main-tab-item ${activeTab === 'orders' ? 'active' : ''}`}
              style={{ ...styles.tabItem, ...(activeTab === 'orders' ? styles.tabItemActive : {}) }}
            >
              Mis Pedidos ({recentOrdersCount})
            </button>
          )}
        </div>
      </nav>
    </>
  );
};
