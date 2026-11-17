import React from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';
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

  const handleClose = () => setClientModal({ ...clientModal, open: false });

  return (
    <NativeModalDialog
      isOpen={ctrl.isOpen}
      onClose={handleClose}
      ariaLabelledBy="client-modal-title"
      style={{
        maxWidth: '1080px',
        width: '96vw',
        height: 'min(680px, 94vh)',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 28px',
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
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <h3 id="client-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {clientModal.mode === 'create' ? 'Nuevo cliente' : clientModal.data?.name || 'Editar cliente'}
        </h3>
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="Cerrar"
          style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={handleClose}
        >
          <X size={18} />
        </button>
      </div>

      {ctrl.modalBanner && (
        <div
          role={ctrl.modalBanner.tone === 'error' ? 'alert' : 'status'}
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
              Abrir ficha
            </button>
          )}
        </div>
      )}

      <form onSubmit={ctrl.handleClientSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
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
            paddingTop: '14px',
            marginTop: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={handleClose}>
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
            {clientModal.mode === 'create' ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};

export default ClientModal;
