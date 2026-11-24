import React from 'react';
import { Plus } from 'lucide-react';
import { CreateCreditNoteModal } from './credit-notes/CreateCreditNoteModal';
import { CreditNotePreviewModal } from './credit-notes/CreditNotePreviewModal';
import { useCreditNotesController } from './credit-notes/useCreditNotesController';

interface CreditNotesTabProps {
  creditNotes: any[];
  personas: any[];
  products: any[];
  loading: boolean;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  showCreditNoteModal: boolean;
  setShowCreditNoteModal: (show: boolean) => void;
  creditNoteForm: any;
  setCreditNoteForm: React.Dispatch<React.SetStateAction<any>>;
  creditNoteCart: any[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<any[]>>;
  cnClientSearchQuery: string;
  setCnClientSearchQuery: (query: string) => void;
  viewCreditNoteModal: any | null;
  setViewCreditNoteModal: (note: any | null) => void;
}

const STATUS_BADGE_MAP: Record<string, { className: string; label: string }> = {
  APPROVED: { className: 'badge-minimal badge-minimal--solid', label: 'Aprobada' },
  PENDING_APPROVAL: { className: 'badge-minimal', label: 'Pendiente Aprobación' },
  REJECTED: { className: 'badge-minimal badge-minimal--danger', label: 'Rechazada' },
};

export default function CreditNotesTab(props: CreditNotesTabProps) {
  const {
    creditNotes,
    loading,
    showCreditNoteModal,
    setShowCreditNoteModal,
    creditNoteForm,
    setCreditNoteForm,
    creditNoteCart,
    setCreditNoteCart,
    cnClientSearchQuery,
    setCnClientSearchQuery,
    viewCreditNoteModal,
    setViewCreditNoteModal,
  } = props;

  const ctrl = useCreditNotesController(props);

  return (
    <>
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              Notas de Crédito
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={ctrl.openFreeCreditNoteModal}
          >
            <Plus size={16} aria-hidden="true" />
            Nueva Nota de Crédito
          </button>
        </div>

        <div
          className="table-container table-container--sticky"
          role="region"
          aria-label="Notas de crédito y devoluciones emitidas"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Fecha Emisión</th>
                <th scope="col">Estado</th>
                <th scope="col">Nro Comprobante</th>
                <th scope="col">Cliente</th>
                <th scope="col">Concepto / Motivo</th>
                <th scope="col" style={{ textAlign: 'right' }}>Total Acreditado</th>
                <th scope="col" style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                    Cargando notas de crédito...
                  </td>
                </tr>
              ) : creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                    No se encontraron notas de crédito.
                  </td>
                </tr>
              ) : (
                creditNotes.map((note) => {
                  const statusStyle = STATUS_BADGE_MAP[note.status] || STATUS_BADGE_MAP.REJECTED;
                  return (
                    <tr key={note.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(note.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td>
                        <span className={statusStyle.className}>{statusStyle.label}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {note.creditNoteNumber || `NCI-PENDIENTE-${note.id}`}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#111827' }}>
                          {note.persona?.name || 'Consumidor Final'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          CUIT: {note.persona?.cuit || 'S/D'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{note.reason}</span>
                        {note.comments && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {note.comments}
                          </div>
                        )}
                      </td>
                      <td className="tabular-nums" style={{ fontWeight: 700, textAlign: 'right', color: '#E30613' }}>
                        -${Number(note.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 9px', fontSize: '0.76rem', color: '#111827' }}
                            onClick={() => setViewCreditNoteModal(note)}
                          >
                            Ver Detalle
                          </button>
                          {note.status === 'PENDING_APPROVAL' && ctrl.isAdmin && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '4px 9px', fontSize: '0.76rem' }}
                                onClick={() => ctrl.handleApproveCreditNote(note.id)}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '4px 9px',
                                  fontSize: '0.76rem',
                                  color: '#E30613',
                                  borderColor: 'rgba(227, 6, 19, 0.35)',
                                }}
                                onClick={() => ctrl.handleRejectCreditNote(note.id)}
                              >
                                Anular
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateCreditNoteModal
        isOpen={showCreditNoteModal}
        onClose={() => setShowCreditNoteModal(false)}
        onSubmit={ctrl.handleCreateCreditNoteSubmit}
        loading={loading || ctrl.submitting}
        creditNoteForm={creditNoteForm}
        setCreditNoteForm={setCreditNoteForm}
        creditNoteCart={creditNoteCart}
        setCreditNoteCart={setCreditNoteCart}
        selectedCNClient={ctrl.selectedCNClient}
        cnClientSearchQuery={cnClientSearchQuery}
        setCnClientSearchQuery={setCnClientSearchQuery}
        filteredCNClients={ctrl.filteredCNClients}
        showCNClientDropdown={ctrl.showCNClientDropdown}
        setShowCNClientDropdown={ctrl.setShowCNClientDropdown}
        activeCNClientSuggestionIdx={ctrl.activeCNClientSuggestionIdx}
        setActiveCNClientSuggestionIdx={ctrl.setActiveCNClientSuggestionIdx}
        onSelectCNClient={ctrl.handleSelectCNClient}
        eligibleOrders={ctrl.eligibleOrders}
        loadingEligibleOrders={ctrl.loadingEligibleOrders}
        selectedEligibleOrder={ctrl.selectedEligibleOrder}
        onSelectEligibleOrder={ctrl.handleSelectEligibleOrder}
        cnProductSearchQuery={ctrl.cnProductSearchQuery}
        setCnProductSearchQuery={ctrl.setCnProductSearchQuery}
        filteredCNProducts={ctrl.filteredCNProducts}
        showCNProductDropdown={ctrl.showCNProductDropdown}
        setShowCNProductDropdown={ctrl.setShowCNProductDropdown}
        activeCNProductSuggestionIdx={ctrl.activeCNProductSuggestionIdx}
        setActiveCNProductSuggestionIdx={ctrl.setActiveCNProductSuggestionIdx}
        onSelectCNProduct={ctrl.handleSelectCNProduct}
        cnProductPrice={ctrl.cnProductPrice}
        setCnProductPrice={ctrl.setCnProductPrice}
        cnProductQty={ctrl.cnProductQty}
        setCnProductQty={ctrl.setCnProductQty}
        cnProductWeight={ctrl.cnProductWeight}
        setCnProductWeight={ctrl.setCnProductWeight}
        onAddCNProduct={ctrl.handleAddCNProduct}
        onRemoveCNProduct={ctrl.handleRemoveCNProduct}
      />

      <CreditNotePreviewModal
        creditNote={viewCreditNoteModal}
        onClose={() => setViewCreditNoteModal(null)}
      />
    </>
  );
}
