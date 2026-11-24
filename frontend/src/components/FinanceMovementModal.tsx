import { useState, useEffect, useMemo } from 'react';
import { X, Search, Landmark, DollarSign, CreditCard, Receipt, TrendingUp } from 'lucide-react';
import { NativeModalDialog } from './modals/NativeModalDialog';

export interface FinanceMovementItem {
  id: string | number;
  date: string;
  type: 'INGRESO' | 'EGRESO';
  description: string;
  origin: string;
  paymentMethod: string;
  reference?: string;
  amount: number;
  orderId?: number;
  personaName?: string;
}

function formatOriginLabel(raw: string): string {
  return (raw || '')
    .replace(/^Caja:\s*/i, '')
    .replace(/^REPARTIDOR:\s*/i, '')
    .replace(/\s*\((Ruta #\d+)\)/i, ' · $1')
    .trim();
}

function formatConceptLabel(raw: string, orderId?: number): string {
  let text = (raw || '').trim();
  if (/^Rendici[oó]n Reparto/i.test(text)) {
    return 'Rendición reparto';
  }

  const checkMatch = text.match(/^Cheque\s+N°\s*([^\s(]+)\s*\(Emisor:\s*(.+?)\)\s*(?:recibido.*)?$/i);
  if (checkMatch) {
    const num = checkMatch[1].trim();
    let issuer = checkMatch[2].trim();
    const isEcheq = /\(echeq\)/i.test(issuer);
    issuer = issuer.replace(/\s*\(echeq\)/gi, '').trim();
    const prefix = isEcheq ? 'eCheq' : 'Cheque';
    const numLabel = num && num !== 'S/N' ? ` #${num}` : '';
    const issuerLabel = issuer && issuer.toLowerCase() !== 'desconocido' ? ` · ${issuer}` : '';
    return `${prefix}${numLabel}${issuerLabel}`;
  }

  if (/^Cobro en el acto de factura directa/i.test(text)) {
    return 'Factura directa';
  }

  text = text
    .replace(/\s*\(Parte Oficial\)/gi, '')
    .replace(/\s*\(INT-\d+\)/gi, '')
    .replace(/\s*(?:de|por)\s+(?:pedido|factura)\s*#\d+/gi, '')
    .trim();
  if (orderId && text === `Pedido #${orderId}`) return 'Cobro pedido';
  return text || 'Movimiento';
}

interface FinanceMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  categoryKey: 'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET';
  dateRangeText: string;
  movements: FinanceMovementItem[];
}

export default function FinanceMovementModal({
  isOpen, onClose, title, categoryKey, dateRangeText, movements,
}: FinanceMovementModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredMovements = useMemo(() => {
    if (!searchTerm.trim()) return movements || [];
    const term = searchTerm.toLowerCase();
    return (movements || []).filter((m) => {
      if (!m) return false;
      const amtStr = (m.amount ?? 0).toString();
      return (
        (m.description || '').toLowerCase().includes(term) ||
        (m.origin || '').toLowerCase().includes(term) ||
        (m.paymentMethod || '').toLowerCase().includes(term) ||
        (m.reference || '').toLowerCase().includes(term) ||
        (m.personaName || '').toLowerCase().includes(term) ||
        amtStr.includes(term) ||
        (m.orderId ? `#${m.orderId}`.includes(term) : false)
      );
    });
  }, [movements, searchTerm]);

  const totalAmount = useMemo(() => {
    return filteredMovements.reduce((acc, curr) => {
      const amt = Number(curr?.amount || 0);
      return curr?.type === 'INGRESO' ? acc + amt : acc - amt;
    }, 0);
  }, [filteredMovements]);

  if (!isOpen) return null;

  const renderCategoryIcon = () => {
    switch (categoryKey) {
      case 'CASH': return <DollarSign size={20} color="#059669" aria-hidden="true" />;
      case 'CHECK': return <Receipt size={20} color="#2563eb" aria-hidden="true" />;
      case 'TRANSFER': return <Landmark size={20} color="#0d9488" aria-hidden="true" />;
      case 'EXPENSE': return <CreditCard size={20} color="#dc2626" aria-hidden="true" />;
      default: return <TrendingUp size={20} color="#475569" aria-hidden="true" />;
    }
  };

  const showMethodColumn = categoryKey === 'NET' || categoryKey === 'EXPENSE';

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="fin-mov-modal-title"
      style={{ maxWidth: '1360px', width: '96vw', minHeight: '62vh', maxHeight: '92vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ padding: '20px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', flexShrink: 0 }}>
            {renderCategoryIcon()}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <h3 id="fin-mov-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
            <span className="tabular-nums" style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              {dateRangeText}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
          <div className="tabular-nums" style={{ textAlign: 'right', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{filteredMovements.length} mov.</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: categoryKey === 'EXPENSE' ? '#dc2626' : '#059669', fontFamily: 'monospace' }}>
              ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={onClose} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', flexWrap: 'wrap' }}>
        <search aria-label="Filtrar movimientos" style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <label htmlFor="fin-mov-search" className="visually-hidden">Buscar movimiento</label>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            id="fin-mov-search"
            type="search"
            placeholder="Buscar..."
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            style={{ paddingLeft: '36px', paddingRight: searchTerm ? '30px' : '12px', backgroundColor: '#ffffff' }}
          />
          {searchTerm && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </search>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label={title} tabIndex={0} style={{ flex: 1, margin: 0, border: 'none', borderRadius: 0, boxShadow: 'none' }}>
        {filteredMovements.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
            Sin movimientos
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: '125px', padding: '12px 16px 12px 28px' }}>Fecha</th>
                <th scope="col" style={{ padding: '12px 16px' }}>Cliente / Origen</th>
                <th scope="col" style={{ padding: '12px 16px' }}>Detalle</th>
                <th scope="col" style={{ padding: '12px 16px', width: showMethodColumn ? '160px' : '120px' }}>{showMethodColumn ? 'Medio' : 'Ref.'}</th>
                <th scope="col" style={{ textAlign: 'right', padding: '12px 28px 12px 16px', width: '140px' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m, idx) => {
                const isIncome = m.type === 'INGRESO';
                const rawDate = m.date ? new Date(m.date) : null;
                const formattedDate = rawDate && !isNaN(rawDate.getTime())
                  ? rawDate.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
                  : 'S/F';
                const cleanOrigin = formatOriginLabel(m.origin);
                const cleanConcept = formatConceptLabel(m.description, m.orderId);
                const showSubOrigin = Boolean(
                  m.personaName &&
                    cleanOrigin &&
                    cleanOrigin.toLowerCase() !== m.personaName.trim().toLowerCase(),
                );

                return (
                  <tr key={`${m.id}-${idx}`}>
                    <td className="tabular-nums" style={{ color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap', padding: '14px 16px 14px 28px' }}>{formattedDate}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                        {m.personaName || cleanOrigin}
                      </div>
                      {showSubOrigin && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>{cleanOrigin}</div>
                      )}
                    </td>
                    <td style={{ color: '#334155', fontSize: '0.86rem', padding: '14px 16px' }}>
                      <span>{cleanConcept}</span>
                      {m.orderId && (
                        <span className="tabular-nums" style={{ marginLeft: '8px', fontSize: '0.74rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '5px', fontWeight: 600 }}>
                          #{m.orderId}
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem', padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      {showMethodColumn ? (
                        <div>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{m.paymentMethod}</span>
                          {m.reference && <div className="tabular-nums" style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{m.reference}</div>}
                        </div>
                      ) : (
                        <span className="tabular-nums">{m.reference || '—'}</span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.94rem', color: isIncome ? '#059669' : '#dc2626', padding: '14px 28px 14px 16px', whiteSpace: 'nowrap' }}>
                      {isIncome ? '+' : '-'}${Math.abs(m.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </NativeModalDialog>
  );
}
