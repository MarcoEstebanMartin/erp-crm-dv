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
  isStaffAdmin?: boolean;
  onEnterAsAdmin?: () => void;
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
  hasPin,
  fetchAvailableClients,
  handleSelectClient,
  handlePinSubmit,
  isStaffAdmin,
  onEnterAsAdmin,
  onBackToStaffLogin,
}) => {
  return (
    <div style={styles.loginOverlay}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          {!logoFailed ? (
            <img
              src="/logo.png"
              alt="Don Venancio"
              style={{ height: '72px', objectFit: 'contain' }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div style={styles.logoTextFallback}>DON VENANCIO</div>
          )}
        </div>

        {!pendingClient ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchAvailableClients(loginSearch);
              }}
              style={styles.loginSearchBox}
            >
              <input
                type="text"
                placeholder="CUIT o comercio"
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                style={styles.searchInput}
                autoFocus
                aria-label="CUIT o nombre de comercio"
              />
              <button
                type="submit"
                disabled={isLoggingIn || !loginSearch.trim()}
                style={{
                  ...styles.btnPrimary,
                  opacity: !loginSearch.trim() || isLoggingIn ? 0.5 : 1,
                }}
              >
                {isLoggingIn ? '...' : 'Ingresar'}
              </button>
            </form>

            {loginError && <div style={styles.errorBanner}>{loginError}</div>}

            {availableClients.length > 0 && (
              <div style={styles.clientListContainer}>
                <div style={styles.clientGrid}>
                  {availableClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      style={styles.clientCard}
                    >
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {c.cuit || 'Sin CUIT'}
                        {c.city ? ` · ${c.city}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <form
            onSubmit={handlePinSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '9px',
                padding: '10px 14px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {pendingClient.name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {pendingClient.cuit || 'Sin CUIT'}
              </div>
            </div>

            <input
              type="password"
              inputMode="numeric"
              placeholder={hasPin ? 'PIN' : 'Nuevo PIN (4 dígitos)'}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              maxLength={8}
              style={{
                ...styles.searchInput,
                textAlign: 'center',
                letterSpacing: '4px',
                fontSize: '16px',
                fontWeight: 700,
              }}
              autoFocus
              aria-label="PIN de acceso"
            />

            {loginError && <div style={styles.errorBanner}>{loginError}</div>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setPendingClient(null);
                  setLoginError(null);
                }}
                style={{ ...styles.btnSecondarySmall, flex: 1 }}
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={isLoggingIn || !pinInput.trim()}
                style={{
                  ...styles.btnPrimary,
                  flex: 2,
                  opacity: isLoggingIn || !pinInput.trim() ? 0.5 : 1,
                }}
              >
                {isLoggingIn ? '...' : hasPin ? 'Ingresar' : 'Crear PIN'}
              </button>
            </div>
          </form>
        )}

        {(isStaffAdmin || onBackToStaffLogin) && (
          <div style={styles.footerRow}>
            {isStaffAdmin && onEnterAsAdmin && (
              <button type="button" onClick={onEnterAsAdmin} style={styles.btnAdminDirect}>
                Entrar como Admin
              </button>
            )}
            {onBackToStaffLogin && (
              <button type="button" onClick={onBackToStaffLogin} style={styles.btnLink}>
                {isStaffAdmin ? 'Panel Admin' : 'Acceso Admin'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
