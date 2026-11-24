import React, { useEffect, useMemo, useState } from 'react';
import type { EligibleOrderForCreditNote } from '../../../api/billing.api';
import { CreateCreditNoteModal } from './CreateCreditNoteModal';
import { useCreditNotesController } from './useCreditNotesController';
import {
  buildCartItemsFromEligibleOrder,
  type CreditNoteCartItem,
} from './creditNoteCart.helpers';

interface StandaloneCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  initialOrder: EligibleOrderForCreditNote | null;
  onSuccess: (creditNote: any) => void;
  onError: (message: string) => void;
}

/**
 * Envoltorio autocontenido de CreateCreditNoteModal para emitir una NC vinculada
 * desde cualquier pantalla (por ejemplo, Resumen de Cuenta) sin duplicar estado.
 */
export function StandaloneCreditNoteModal({
  isOpen,
  onClose,
  client,
  initialOrder,
  onSuccess,
  onError,
}: StandaloneCreditNoteModalProps) {
  const [creditNoteForm, setCreditNoteForm] = useState<any>({
    personaId: '',
    orderId: '',
    billingType: 'INTERNAL',
    reason: 'DEVOLUCION',
    comments: '',
  });
  const [creditNoteCart, setCreditNoteCart] = useState<CreditNoteCartItem[]>([]);
  const [cnClientSearchQuery, setCnClientSearchQuery] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !client || !initialOrder) return;
    setLocalError(null);
    setCnClientSearchQuery(client.name || '');
    setCreditNoteForm({
      personaId: String(client.id),
      orderId: String(initialOrder.id),
      billingType: initialOrder.billingType,
      reason: 'DEVOLUCION',
      comments: '',
    });
    setCreditNoteCart(buildCartItemsFromEligibleOrder(initialOrder));
  }, [isOpen, client, initialOrder]);

  const personasList = useMemo(() => (client ? [client] : []), [client]);

  const ctrl = useCreditNotesController({
    personas: personasList,
    products: [],
    creditNoteForm,
    setCreditNoteForm,
    creditNoteCart,
    setCreditNoteCart,
    cnClientSearchQuery,
    setCnClientSearchQuery,
    setShowCreditNoteModal: (open) => {
      if (!open) onClose();
    },
    setErrorMsg: (msg) => {
      setLocalError(msg);
      if (msg) onError(msg);
    },
    setSuccessMsg: () => {},
    loadData: () => {},
    onSubmitted: onSuccess,
  });

  if (!isOpen || !client || !initialOrder) return null;

  return (
    <>
      {localError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 9999,
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '0.84rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          }}
        >
          {localError}
        </div>
      )}
      <CreateCreditNoteModal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={ctrl.handleCreateCreditNoteSubmit}
        loading={ctrl.submitting}
        creditNoteForm={creditNoteForm}
        setCreditNoteForm={setCreditNoteForm}
        creditNoteCart={creditNoteCart}
        setCreditNoteCart={setCreditNoteCart}
        selectedCNClient={client}
        cnClientSearchQuery={cnClientSearchQuery}
        setCnClientSearchQuery={setCnClientSearchQuery}
        filteredCNClients={personasList}
        showCNClientDropdown={false}
        setShowCNClientDropdown={() => {}}
        activeCNClientSuggestionIdx={0}
        setActiveCNClientSuggestionIdx={() => {}}
        onSelectCNClient={() => {}}
        eligibleOrders={ctrl.eligibleOrders.length > 0 ? ctrl.eligibleOrders : [initialOrder]}
        loadingEligibleOrders={ctrl.loadingEligibleOrders}
        selectedEligibleOrder={ctrl.selectedEligibleOrder || initialOrder}
        onSelectEligibleOrder={ctrl.handleSelectEligibleOrder}
        lockClient={true}
        lockInvoiceSelection={true}
        cnProductSearchQuery={ctrl.cnProductSearchQuery}
        setCnProductSearchQuery={ctrl.setCnProductSearchQuery}
        filteredCNProducts={[]}
        showCNProductDropdown={false}
        setShowCNProductDropdown={() => {}}
        activeCNProductSuggestionIdx={0}
        setActiveCNProductSuggestionIdx={() => {}}
        onSelectCNProduct={() => {}}
        cnProductPrice={ctrl.cnProductPrice}
        setCnProductPrice={ctrl.setCnProductPrice}
        cnProductQty={ctrl.cnProductQty}
        setCnProductQty={ctrl.setCnProductQty}
        cnProductWeight={ctrl.cnProductWeight}
        setCnProductWeight={ctrl.setCnProductWeight}
        onAddCNProduct={() => {}}
        onRemoveCNProduct={ctrl.handleRemoveCNProduct}
      />
    </>
  );
}
