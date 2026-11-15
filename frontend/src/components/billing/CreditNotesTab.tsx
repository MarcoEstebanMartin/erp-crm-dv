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

const STATUS_BADGE_MAP: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: '#E8F5E9', color: '#2E7D32', label: 'Aprobada' },
  PENDING_APPROVAL: { bg: '#FFF9C4', color: '#F57F17', label: 'Pendiente Aprobación' },
  REJECTED: { bg: '#FFEBEE', color: '#C62828', label: 'Rechazada' },
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
            marginBottom: '16px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              Notas de Crédito y Devoluciones Emitidas
            </h3>
            <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
              Anulación parcial o total de facturas y reingreso trazado de mercadería al stock.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={ctrl.openFreeCreditNoteModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            Crear Nota de Crédito Libre
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha Emisión</th>
                <th>Estado</th>
                <th>Nro Comprobante</th>
                <th>Cliente</th>
                <th>Concepto / Motivo</th>
                <th>Total Acreditado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>
                    Cargando notas de crédito...
                  </td>
                </tr>
              ) : creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>
                    No se encontraron notas de crédito.
                  </td>
                </tr>
              ) : (
                creditNotes.map((note) => {
                  const statusStyle = STATUS_BADGE_MAP[note.status] || STATUS_BADGE_MAP.REJECTED;
                  return (
                    <tr key={note.id}>
                      <td>{new Date(note.createdAt).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {note.creditNoteNumber || `NCI-PENDIENTE-${note.id}`}
                      </td>
                      <td>
                        <div>{note.persona?.name || 'Consumidor Final'}</div>
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
                      <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                        -${Number(note.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => setViewCreditNoteModal(note)}
                          >
                            Ver Detalle
                          </button>
                          {note.status === 'PENDING_APPROVAL' && ctrl.isAdmin && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.78rem',
                                  color: 'var(--color-success)',
                                  borderColor: 'var(--color-success)',
                                  backgroundColor: 'transparent',
                                }}
                                onClick={() => ctrl.handleApproveCreditNote(note.id)}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.78rem',
                                  color: 'var(--color-danger)',
                                  borderColor: 'var(--color-danger)',
                                  backgroundColor: 'transparent',
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
        loading={loading}
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
