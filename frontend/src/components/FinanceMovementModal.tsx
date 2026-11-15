import { useState, useEffect, useMemo } from 'react';
import { X, Search, Download, Copy, ArrowUpRight, ArrowDownRight, Filter, Check, Landmark, DollarSign, CreditCard, Receipt, TrendingUp } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setCopied(false);
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

  const handleCopySummary = () => {
    const header = `${title}\nPeríodo: ${dateRangeText}\nTotal: $${totalAmount.toLocaleString('es-AR')}\nMovimientos: ${filteredMovements.length}\n\n`;
    const lines = filteredMovements.map((m) => {
      const d = new Date(m.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
      return `${d} | ${m.origin} | ${m.description} | ${m.paymentMethod} | $${m.amount.toLocaleString('es-AR')}`;
    }).join('\n');
    navigator.clipboard.writeText(header + lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const headers = ['Fecha/Hora', 'Tipo', 'Origen', 'Concepto', 'Medio de Pago', 'Referencia', 'Monto'];
    const rows = filteredMovements.map((m) => [
      `"${new Date(m.date).toLocaleString('es-AR')}"`,
      `"${m.type}"`,
      `"${(m.origin || '').replace(/"/g, '""')}"`,
      `"${(m.description || '').replace(/"/g, '""')}"`,
      `"${(m.paymentMethod || '').replace(/"/g, '""')}"`,
      `"${(m.reference || '').replace(/"/g, '""')}"`,
      m.type === 'EGRESO' ? -Math.abs(m.amount) : Math.abs(m.amount),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `desglose_${categoryKey.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="fin-mov-modal-title"
      style={{ maxWidth: '960px', width: '95vw', maxHeight: '90vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
            {renderCategoryIcon()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 id="fin-mov-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
            <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#334155' }}>
              {dateRangeText}
            </span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={onClose} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '14px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Movimientos</div>
          <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {filteredMovements.length}
          </div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: categoryKey === 'EXPENSE' ? '#fef2f2' : '#f0fdf4', border: categoryKey === 'EXPENSE' ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '0.78rem', color: categoryKey === 'EXPENSE' ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
            {categoryKey === 'NET' ? 'Recaudación Neta' : categoryKey === 'EXPENSE' ? 'Total Egresos' : 'Total Ingresos'}
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: categoryKey === 'EXPENSE' ? '#991b1b' : '#166534', marginTop: '4px', fontFamily: 'monospace' }}>
            ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff', flexWrap: 'wrap' }}>
        <search aria-label="Filtrar movimientos" style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <label htmlFor="fin-mov-search" className="visually-hidden">Buscar movimiento</label>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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
            style={{ paddingLeft: '36px', paddingRight: searchTerm ? '30px' : '12px', backgroundColor: '#f8fafc' }}
          />
          {searchTerm && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </search>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleCopySummary} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            {copied ? <Check size={14} color="#16a34a" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <Download size={14} aria-hidden="true" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label={title} tabIndex={0} style={{ flex: 1, margin: 0, border: 'none', borderRadius: 0, boxShadow: 'none' }}>
        {filteredMovements.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
            <Filter size={32} aria-hidden="true" style={{ opacity: 0.3, marginBottom: '10px' }} />
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>Sin movimientos</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: '140px' }}>Fecha / Hora</th>
                <th scope="col">Origen</th>
                <th scope="col">Concepto</th>
                <th scope="col">Medio</th>
                <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m, idx) => {
                const isIncome = m.type === 'INGRESO';
                const rawDate = m.date ? new Date(m.date) : null;
                const formattedDate = rawDate && !isNaN(rawDate.getTime())
                  ? rawDate.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : 'S/F';

                return (
                  <tr key={`${m.id}-${idx}`}>
                    <td style={{ color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formattedDate}</td>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>
                      {m.origin}
                      {m.personaName && <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>{m.personaName}</div>}
                    </td>
                    <td style={{ color: '#334155' }}>
                      {m.description}
                      {m.orderId && (
                        <span style={{ marginLeft: '6px', fontSize: '0.75rem', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Pedido #{m.orderId}
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#475569' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        backgroundColor: m.paymentMethod === 'EFECTIVO' || m.paymentMethod === 'CASH' ? '#ecfdf5' : m.paymentMethod === 'CHEQUE' || m.paymentMethod === 'CHECK' ? '#eff6ff' : m.paymentMethod === 'TRANSFERENCIA' || m.paymentMethod === 'BANK_TRANSFER' ? '#f0fdfa' : '#f1f5f9',
                        color: m.paymentMethod === 'EFECTIVO' || m.paymentMethod === 'CASH' ? '#047857' : m.paymentMethod === 'CHEQUE' || m.paymentMethod === 'CHECK' ? '#1d4ed8' : m.paymentMethod === 'TRANSFERENCIA' || m.paymentMethod === 'BANK_TRANSFER' ? '#0f766e' : '#475569',
                      }}>
                        {m.paymentMethod}
                      </span>
                      {m.reference && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Ref: {m.reference}</div>}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.92rem', color: isIncome ? '#059669' : '#dc2626' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        {isIncome ? <ArrowUpRight size={14} color="#059669" aria-hidden="true" /> : <ArrowDownRight size={14} color="#dc2626" aria-hidden="true" />}
                        {isIncome ? '+' : '-'}${Math.abs(m.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </NativeModalDialog>
  );
}
