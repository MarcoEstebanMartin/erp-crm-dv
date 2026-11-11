import React from 'react';
import { ClientIdentityRolesCard } from './client/ClientIdentityRolesCard';
import { ClientLocationCommercialCard } from './client/ClientLocationCommercialCard';
import { type ModalBannerState, useClientModalController } from './client/useClientModalController';

interface ClientModalProps {
  clientModal: any;
  setClientModal: (val: any) => void;
  availableSellers: any[];
  availableSaleRoutes: any[];
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setClientsVersion: React.Dispatch<React.SetStateAction<number>>;
}

const BANNER_STYLES: Record<ModalBannerState['tone'], React.CSSProperties> = {
  success: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
  warning: { backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
  error: { backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
};

const ClientModal: React.FC<ClientModalProps> = (props) => {
  const { clientModal, setClientModal, availableSellers, availableSaleRoutes } = props;
  const ctrl = useClientModalController(props);

  if (!ctrl.isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '1320px',
          width: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '26px 30px',
          borderRadius: '12px',
        }}
      >
        <div
          className="modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '14px',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            👤 {clientModal.mode === 'create' ? 'Registrar Nuevo Cliente' : `Editar Cliente: ${clientModal.data.name}`}
          </h3>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setClientModal({ ...clientModal, open: false })}
          >
            ✕
          </button>
        </div>

        {ctrl.modalBanner && (
          <div
            style={{
              ...BANNER_STYLES[ctrl.modalBanner.tone],
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.83rem',
              fontWeight: 500,
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <span>{ctrl.modalBanner.text}</span>
            {ctrl.modalBanner.existingClientId && (
              <button
                type="button"
                onClick={() => ctrl.handleSwitchToExistingClient(ctrl.modalBanner!.existingClientId!)}
                style={{
                  backgroundColor: '#92400e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Abrir ficha existente
              </button>
            )}
          </div>
        )}

        <form onSubmit={ctrl.handleClientSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', paddingBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: '24px' }}>
              <ClientIdentityRolesCard
                data={clientModal.data}
                onChangeData={ctrl.updateData}
                isSearchingAfip={ctrl.isSearchingAfip}
                onFetchAfipData={ctrl.handleFetchAfipData}
                onBlurCuitInput={ctrl.handleBlurCuitInput}
                cuitInputRef={ctrl.cuitInputRef}
              />

              <ClientLocationCommercialCard
                data={clientModal.data}
                onChangeData={ctrl.updateData}
                availableSellers={availableSellers}
                availableSaleRoutes={availableSaleRoutes}
                addressInputRef={ctrl.addressInputRef}
              />
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '16px',
              marginTop: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '8px 16px' }}
              onClick={() => setClientModal({ ...clientModal, open: false })}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '8px 20px',
                backgroundColor: 'var(--accent-color)',
                borderColor: 'var(--accent-color)',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {clientModal.mode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;
