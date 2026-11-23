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
  setPaymentModal?: (val: { open: boolean; clientId: number; clientName: string } | null) => void;
}

const BANNER_STYLES: Record<ModalBannerState['tone'], React.CSSProperties> = {
  success: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
  warning: { backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
  error: { backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
};

const ClientModal: React.FC<ClientModalProps> = (props) => {
  const {
    clientModal,
    setClientModal,
    availableSellers,
    availableSaleRoutes,
    setPaymentModal,
  } = props;
  const ctrl = useClientModalController(props);

  if (!ctrl.isOpen) return null;

  const isEdit = clientModal?.mode === 'edit' && Boolean(clientModal?.data?.id);
  const data = clientModal.data || {};
  const handleClose = () => setClientModal({ ...clientModal, open: false });

  const balance = Number(data.outstandingBalance || 0);
  const absBalance = Math.abs(Math.round(balance)).toLocaleString('es-AR');
  const balanceText = balance < 0 ? `+$${absBalance}` : `$${absBalance}`;
  const balanceColor = balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-primary)';

  return (
    <NativeModalDialog
      isOpen={ctrl.isOpen}
      onClose={handleClose}
      ariaLabelledBy="client-modal-title"
      style={{
        maxWidth: '1040px',
        width: '94vw',
        height: 'fit-content',
        maxHeight: '94dvh',
        padding: '22px 26px',
        borderRadius: '12px',
      }}
    >
      <div
        className="modal-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '18px',
        }}
      >
        <h1
          id="client-modal-title"
          style={{
            margin: 0,
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            minInlineSize: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {clientModal.mode === 'create' ? 'Nuevo cliente' : data.name || 'Editar cliente'}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {isEdit && (data.isClient || data.isProvider) && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 11px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#fafafa',
                fontSize: '0.84rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Saldo</span>
              <span className="tabular-nums" style={{ fontWeight: 700, color: balanceColor }}>
                {balanceText}
              </span>
            </div>
          )}

          {isEdit && data.isClient && setPaymentModal && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
              onClick={() => setPaymentModal({ open: true, clientId: data.id, clientName: data.name })}
            >
              Cobrar
            </button>
          )}

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
      </div>

      {ctrl.modalBanner && (
        <div
          role={ctrl.modalBanner.tone === 'error' ? 'alert' : 'status'}
          style={{
            ...BANNER_STYLES[ctrl.modalBanner.tone],
            padding: '9px 14px',
            borderRadius: '8px',
            fontSize: '0.83rem',
            fontWeight: 500,
            marginBottom: '16px',
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

      <form onSubmit={ctrl.handleClientSubmit} style={{ display: 'flex', flexDirection: 'column', minBlockSize: 0 }}>
        <div style={{ overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <div className="client-modal-columns">
            <ClientIdentityRolesCard
              data={data}
              onChangeData={ctrl.updateData}
              isSearchingAfip={ctrl.isSearchingAfip}
              onFetchAfipData={ctrl.handleFetchAfipData}
              onBlurCuitInput={ctrl.handleBlurCuitInput}
              cuitInputRef={ctrl.cuitInputRef}
            />

            <ClientLocationCommercialCard
              data={data}
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
            marginTop: '18px',
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
              padding: '8px 22px',
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
