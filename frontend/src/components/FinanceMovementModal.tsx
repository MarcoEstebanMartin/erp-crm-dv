import React, { useState, useMemo } from 'react';
import { X, Search, Download, Copy, ArrowUpRight, ArrowDownRight, Filter, Check, Landmark, DollarSign, CreditCard, Receipt, TrendingUp } from 'lucide-react';

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
  subtitle?: string;
  categoryKey: 'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET';
  dateRangeText: string;
  movements: FinanceMovementItem[];
}

export default function FinanceMovementModal({
  isOpen,
  onClose,
  title,
  subtitle,
  categoryKey,
  dateRangeText,
  movements
}: FinanceMovementModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Clear search on open/close
  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setCopied(false);
    }
  }, [isOpen]);

  // Filter movements by search term
  const filteredMovements = useMemo(() => {
    if (!searchTerm.trim()) return movements || [];
    const term = searchTerm.toLowerCase();
    return (movements || []).filter(m => {
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

  // Calculate metrics
  const totalAmount = useMemo(() => {
    return filteredMovements.reduce((acc, curr) => {
      const amt = Number(curr?.amount || 0);
      return curr?.type === 'INGRESO' ? acc + amt : acc - amt;
    }, 0);
  }, [filteredMovements]);

  if (!isOpen) return null;

  // Icon badge based on category
  const renderCategoryIcon = () => {
    switch (categoryKey) {
      case 'CASH':
        return <DollarSign size={20} color="#059669" />;
      case 'CHECK':
        return <Receipt size={20} color="#2563eb" />;
      case 'TRANSFER':
        return <Landmark size={20} color="#0d9488" />;
      case 'EXPENSE':
        return <CreditCard size={20} color="#dc2626" />;
      case 'NET':
      default:
        return <TrendingUp size={20} color="#475569" />;
    }
  };

  const handleCopySummary = () => {
    const header = `Desglose Financiero: ${title}\nPeríodo: ${dateRangeText}\nTotal: $${totalAmount.toLocaleString('es-AR')}\nMovimientos: ${filteredMovements.length}\n\n`;
    const lines = filteredMovements.map(m => {
      const formattedDate = new Date(m.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
      return `${formattedDate} | ${m.origin} | ${m.description} | ${m.paymentMethod} | $${m.amount.toLocaleString('es-AR')}`;
    }).join('\n');

    navigator.clipboard.writeText(header + lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const headers = ['Fecha/Hora', 'Tipo', 'Origen', 'Concepto', 'Medio de Pago', 'Referencia', 'Monto'];
    const rows = filteredMovements.map(m => [
      `"${new Date(m.date).toLocaleString('es-AR')}"`,
      `"${m.type}"`,
      `"${(m.origin || '').replace(/"/g, '""')}"`,
      `"${(m.description || '').replace(/"/g, '""')}"`,
      `"${(m.paymentMethod || '').replace(/"/g, '""')}"`,
      `"${(m.reference || '').replace(/"/g, '""')}"`,
      m.type === 'EGRESO' ? -Math.abs(m.amount) : Math.abs(m.amount)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Header Modal */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {renderCategoryIcon()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  {title}
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 10px',
                  borderRadius: '12px',
                  backgroundColor: '#e2e8f0',
                  color: '#334155'
                }}>
                  {dateRangeText}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {subtitle || `Detalle individual de todos los registros correspondientes al período seleccionado.`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Executive Summary Row */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Movimientos Registrados</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {filteredMovements.length} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#64748b' }}>items</span>
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: categoryKey === 'EXPENSE' ? '#fef2f2' : '#f0fdf4', border: categoryKey === 'EXPENSE' ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.78rem', color: categoryKey === 'EXPENSE' ? '#b91c1c' : '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>
              {categoryKey === 'NET' ? 'Recaudación Neta' : categoryKey === 'EXPENSE' ? 'Total Egresos' : 'Total Ingresos'}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: categoryKey === 'EXPENSE' ? '#991b1b' : '#166534', marginTop: '4px', fontFamily: 'monospace' }}>
              ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Export */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por concepto, origen, cliente o monto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                backgroundColor: '#f8fafc'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopySummary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar Resumen'}
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Movements Table Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {filteredMovements.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <Filter size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No se encontraron movimientos</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                {searchTerm ? 'Intenta modificar el término de búsqueda.' : 'No existen registros para esta categoría en el rango seleccionado.'}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '12px 16px', width: '140px' }}>Fecha/Hora</th>
                  <th style={{ padding: '12px 16px' }}>Origen / Entidad</th>
                  <th style={{ padding: '12px 16px' }}>Concepto</th>
                  <th style={{ padding: '12px 16px' }}>Medio de Pago</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m, idx) => {
                  const isIncome = m.type === 'INGRESO';
                  const rawDate = m.date ? new Date(m.date) : null;
                  const formattedDate = rawDate && !isNaN(rawDate.getTime())
                    ? rawDate.toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'S/F';

                  return (
                    <tr
                      key={`${m.id}-${idx}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {formattedDate}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>
                        {m.origin}
                        {m.personaName && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>
                            Cliente: {m.personaName}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        {m.description}
                        {m.orderId && (
                          <span style={{ marginLeft: '6px', fontSize: '0.75rem', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Pedido #{m.orderId}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: m.paymentMethod === 'EFECTIVO' || m.paymentMethod === 'CASH' ? '#ecfdf5' :
                                           m.paymentMethod === 'CHEQUE' || m.paymentMethod === 'CHECK' ? '#eff6ff' :
                                           m.paymentMethod === 'TRANSFERENCIA' || m.paymentMethod === 'BANK_TRANSFER' ? '#f0fdfa' : '#f1f5f9',
                          color: m.paymentMethod === 'EFECTIVO' || m.paymentMethod === 'CASH' ? '#047857' :
                                 m.paymentMethod === 'CHEQUE' || m.paymentMethod === 'CHECK' ? '#1d4ed8' :
                                 m.paymentMethod === 'TRANSFERENCIA' || m.paymentMethod === 'BANK_TRANSFER' ? '#0f766e' : '#475569'
                        }}>
                          {m.paymentMethod}
                        </span>
                        {m.reference && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            Ref: {m.reference}
                          </div>
                        )}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        fontSize: '0.95rem',
                        color: isIncome ? '#059669' : '#dc2626'
                      }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          {isIncome ? <ArrowUpRight size={14} color="#059669" /> : <ArrowDownRight size={14} color="#dc2626" />}
                          {isIncome ? '+' : '-'}${Math.abs(m.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: '0.88rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
