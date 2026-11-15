import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CreateWithholdingModal } from './CreateWithholdingModal';

interface TaxWithholdingsTabProps {
  taxWithholdings: any[];
  personas: any[];
  loading: boolean;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function TaxWithholdingsTab({
  taxWithholdings,
  personas,
  loading,
  loadData,
  setErrorMsg,
  setSuccessMsg,
}: TaxWithholdingsTabProps) {
  const [showWithholdingModal, setShowWithholdingModal] = useState(false);

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
              Declaraciones de Retenciones Impositivas Sufridas
            </h3>
            <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
              Comprobantes de retención cargados manualmente para deducir saldo fiscal de cuenta corriente.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowWithholdingModal(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Cargar Certificado Retención
          </button>
        </div>

        <div
          className="table-container table-container--sticky"
          role="region"
          aria-label="Declaraciones de retenciones impositivas sufridas"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Fecha Certificado</th>
                <th scope="col">Tipo Movimiento</th>
                <th scope="col">Impuesto</th>
                <th scope="col">Nro Certificado</th>
                <th scope="col">Persona / CUIT</th>
                <th scope="col">Jurisdicción</th>
                <th scope="col" style={{ textAlign: 'right' }}>Importe Retenido</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                    Cargando retenciones...
                  </td>
                </tr>
              ) : taxWithholdings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                    No se encontraron certificados de retención.
                  </td>
                </tr>
              ) : (
                taxWithholdings.map((w) => (
                  <tr key={w.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(w.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                    </td>
                    <td>
                      <span
                        className={
                          w.type === 'RETENCION_SUFRIDA'
                            ? 'badge-minimal badge-minimal--solid'
                            : 'badge-minimal badge-minimal--danger'
                        }
                      >
                        {w.type === 'RETENCION_SUFRIDA'
                          ? 'Sufrida (Cliente)'
                          : 'Practicada (Proveedor)'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{w.taxType}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{w.number}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{w.persona?.name || 'S/D'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        CUIT: {w.persona?.cuit || 'S/D'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {w.jurisdiction || 'No Aplica'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                      ${Number(w.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateWithholdingModal
        isOpen={showWithholdingModal}
        onClose={() => setShowWithholdingModal(false)}
        personas={personas}
        onSuccess={loadData}
        setErrorMsg={setErrorMsg}
        setSuccessMsg={setSuccessMsg}
      />
    </>
  );
}
