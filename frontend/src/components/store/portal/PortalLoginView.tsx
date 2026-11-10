import React from 'react';
import type { PendingClientInfo } from './portal.types';
import { portalAuthStyles as styles } from './portalAuth.styles';

interface PortalLoginViewProps {
  logoFailed: boolean;
  setLogoFailed: (val: boolean) => void;
  pendingClient: PendingClientInfo | null;
  setPendingClient: (val: PendingClientInfo | null) => void;
  loginSearch: string;
  setLoginSearch: (val: string) => void;
  isLoggingIn: boolean;
  loginError: string | null;
  setLoginError: (val: string | null) => void;
  availableClients: any[];
  pinInput: string;
  setPinInput: (val: string) => void;
  pinMessage: string | null;
  hasPin: boolean;
  fetchAvailableClients: (term: string) => void;
  handleSelectClient: (client: any, token?: string) => void;
  handlePinSubmit: (e: React.FormEvent) => void;
  onBackToStaffLogin?: () => void;
}

export const PortalLoginView: React.FC<PortalLoginViewProps> = ({
  logoFailed,
  setLogoFailed,
  pendingClient,
  setPendingClient,
  loginSearch,
  setLoginSearch,
  isLoggingIn,
  loginError,
  setLoginError,
  availableClients,
  pinInput,
  setPinInput,
  pinMessage,
  hasPin,
  fetchAvailableClients,
  handleSelectClient,
  handlePinSubmit,
  onBackToStaffLogin
}) => {
  return (
    <div style={styles.loginOverlay}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="Logo DV"
                style={{ height: '95px', objectFit: 'contain' }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div style={styles.logoTextFallback}>ERP-CRM DV</div>
            )}
          </div>
          <div style={styles.badgeCorpRed}>PORTAL MAYORISTA B2B</div>
          <h1 style={styles.loginTitle}>Ingreso a la Tienda Online</h1>
          <p style={styles.loginSubtitle}>
            Ingresá el CUIT o Nombre Comercial de tu comercio para ver tu catálogo exclusivo de productos y promociones.
          </p>
        </div>

        {!pendingClient ? (
          <>
            <div style={styles.loginSearchBox}>
              <input
                type="text"
                placeholder="Ej: 30-71234567-8 o Nombre del Comercio..."
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAvailableClients(loginSearch)}
                style={styles.searchInput}
                autoFocus
              />
              <button
                onClick={() => fetchAvailableClients(loginSearch)}
                disabled={isLoggingIn || !loginSearch.trim()}
                style={{
                  ...styles.btnPrimary,
                  opacity: !loginSearch.trim() || isLoggingIn ? 0.6 : 1
                }}
              >
                {isLoggingIn ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {loginError && <div style={styles.errorBanner}>{loginError}</div>}

            {availableClients.length > 0 && (
              <div style={styles.clientListContainer}>
                <h4 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Seleccioná tu Comercio ({availableClients.length}):
                </h4>
                <div style={styles.clientGrid}>
                  {availableClients.map((c) => (
                    <div key={c.id} onClick={() => handleSelectClient(c)} style={styles.clientCard}>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        CUIT: {c.cuit || 'Sin CUIT'}
                      </div>
                      {c.city && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>📍 {c.city}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{pendingClient.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>CUIT: {pendingClient.cuit || 'Sin CUIT'}</div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', textAlign: 'center', margin: 0 }}>
              {pinMessage || 'Ingresá tu PIN secreto para acceder.'}
            </p>

            <div style={styles.loginSearchBox}>
              <input
                type="password"
                placeholder="•••• PIN Secreto (4 dígitos)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                maxLength={8}
                style={{ ...styles.searchInput, textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: 700 }}
                autoFocus
              />
            </div>

            {loginError && <div style={styles.errorBanner}>{loginError}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setPendingClient(null);
                  setLoginError(null);
                }}
                style={{ ...styles.btnSecondarySmall, flex: 1, padding: '12px' }}
              >
                ← Volver
              </button>
              <button
                type="submit"
                disabled={isLoggingIn || !pinInput.trim()}
                style={{ ...styles.btnPrimary, flex: 2, opacity: isLoggingIn || !pinInput.trim() ? 0.6 : 1 }}
              >
                {isLoggingIn ? 'Verificando...' : hasPin ? 'Ingresar a la Tienda' : 'Crear PIN e Ingresar'}
              </button>
            </div>
          </form>
        )}

        {onBackToStaffLogin && (
          <div style={{ marginTop: '28px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button onClick={onBackToStaffLogin} style={styles.btnLink}>
              ← Volver al Panel de Empleados / Vendedores
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
