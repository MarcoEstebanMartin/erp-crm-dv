import { useState, type DragEvent, type FC } from 'react';
import { Plus, ScanLine, Trash2, Truck, Upload } from 'lucide-react';
import { formatCuitDisplay, formatMoneyArs } from './providersHelpers';

export interface ComprasIngresosTabProps {
  filteredInvoices: any[];
  supplierQuery: string;
  setSupplierQuery: (v: string) => void;
  supplierStartDate: string;
  setSupplierStartDate: (v: string) => void;
  supplierEndDate: string;
  setSupplierEndDate: (v: string) => void;
  branchFilter: 'ALL' | 'OFFICIAL' | 'INTERNAL';
  setBranchFilter: (v: 'ALL' | 'OFFICIAL' | 'INTERNAL') => void;
  invoiceReceptionFilter: 'ALL' | 'IN_TRANSIT' | 'RECEIVED';
  setInvoiceReceptionFilter: (v: 'ALL' | 'IN_TRANSIT' | 'RECEIVED') => void;
  onOpenSupplierModal: () => void;
  onSelectScannerFile: (file: File) => void;
  onOpenReceiveInvoice: (inv: any) => void;
  onDeleteInvoice: (id: number, num: string) => void;
}

export const ComprasIngresosTab: FC<ComprasIngresosTabProps> = ({
  filteredInvoices,
  supplierQuery,
  setSupplierQuery,
  supplierStartDate,
  setSupplierStartDate,
  supplierEndDate,
  setSupplierEndDate,
  branchFilter,
  setBranchFilter,
  invoiceReceptionFilter,
  setInvoiceReceptionFilter,
  onOpenSupplierModal,
  onSelectScannerFile,
  onOpenReceiveInvoice,
  onDeleteInvoice,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onSelectScannerFile(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        className="card"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          padding: '16px 20px',
          border: isDragging ? '1.5px dashed var(--color-corp-red)' : '1px dashed var(--border-color)',
          backgroundColor: isDragging ? '#FFF5F5' : '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 500 }}>
          <Upload size={18} aria-hidden="true" style={{ color: 'var(--color-corp-red)' }} />
          <span>Arrastrá un PDF o imagen para escanear</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label
            htmlFor="compras-scanner-input"
            className="btn"
            style={{
              backgroundColor: 'var(--color-corp-red)',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '36px',
              margin: 0,
              fontWeight: 600,
              fontSize: '0.82rem',
            }}
          >
            <ScanLine size={15} aria-hidden="true" />
            <span>Escanear factura</span>
            <input
              id="compras-scanner-input"
              type="file"
              accept="image/*,application/pdf"
              className="visually-hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) onSelectScannerFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className="btn btn-secondary" style={{ height: '36px', fontSize: '0.82rem' }} onClick={onOpenSupplierModal}>
            <Plus size={15} aria-hidden="true" /> Carga manual
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Comprobantes</h3>
          <search aria-label="Filtrar comprobantes de compra" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor="compras-ing-search" className="visually-hidden">Buscar factura o proveedor</label>
            <input
              id="compras-ing-search"
              type="text"
              placeholder="Buscar factura o proveedor..."
              className="input"
              style={{ fontSize: '0.8rem', padding: '6px 12px', width: '210px' }}
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <label htmlFor="compras-ing-start" className="visually-hidden">Desde</label>
            <input id="compras-ing-start" type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px' }} value={supplierStartDate} onChange={(e) => setSupplierStartDate(e.target.value)} />
            <label htmlFor="compras-ing-end" className="visually-hidden">Hasta</label>
            <input id="compras-ing-end" type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px' }} value={supplierEndDate} onChange={(e) => setSupplierEndDate(e.target.value)} />
            <label htmlFor="compras-ing-branch" className="visually-hidden">Sucursal</label>
            <select id="compras-ing-branch" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '125px' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as 'ALL' | 'OFFICIAL' | 'INTERNAL')}>
              <option value="ALL">Todas</option>
              <option value="OFFICIAL">Sucursal A</option>
              <option value="INTERNAL">Sucursal X</option>
            </select>
            <label htmlFor="compras-ing-reception" className="visually-hidden">Estado de mercadería</label>
            <select id="compras-ing-reception" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '140px' }} value={invoiceReceptionFilter} onChange={(e) => setInvoiceReceptionFilter(e.target.value as 'ALL' | 'IN_TRANSIT' | 'RECEIVED')}>
              <option value="ALL">Todos los ingresos</option>
              <option value="IN_TRANSIT">En tránsito</option>
              <option value="RECEIVED">Ingresadas</option>
            </select>
          </search>
        </div>

        <div className="table-container table-container--sticky" role="region" aria-label="Comprobantes de compra" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Emisión</th>
                <th scope="col">Tipo</th>
                <th scope="col">Sucursal</th>
                <th scope="col">Comprobante</th>
                <th scope="col">Proveedor</th>
                <th scope="col" style={{ textAlign: 'right' }}>Neto</th>
                <th scope="col" style={{ textAlign: 'right' }}>IVA</th>
                <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                <th scope="col">Mercadería</th>
                <th scope="col">Estado</th>
                <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center' }}>Sin comprobantes encontrados.</td></tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isCreditNote = String(inv.invoiceType || '').toUpperCase().startsWith('NOTA_CREDITO');
                  const isOverdue = !isCreditNote && inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
                  const cuit = formatCuitDisplay(inv.persona?.cuit);
                  const canReceive = !isCreditNote && inv.receptionStatus === 'IN_TRANSIT' && Boolean(inv.purchaseOrder);
                  return (
                    <tr key={inv.id}>
                      <td className="tabular-nums">{new Date(inv.issueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                      <td style={{ fontWeight: 600, color: isCreditNote ? '#059669' : undefined }}>
                        {inv.invoiceType?.replaceAll('_', ' ')}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.billingType === 'OFFICIAL' ? '#E8F5E9' : '#ECEFF1', color: inv.billingType === 'OFFICIAL' ? '#2E7D32' : '#37474F' }}>
                          {inv.billingType === 'OFFICIAL' ? 'Suc. A' : 'Suc. X'}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.persona?.name}</div>
                        {cuit && <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {cuit}</div>}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>{formatMoneyArs(inv.netAmount)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>{formatMoneyArs(inv.taxAmount)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, color: isCreditNote ? '#059669' : undefined }}>
                        {isCreditNote ? `-${formatMoneyArs(inv.totalAmount)}` : formatMoneyArs(inv.totalAmount)}
                      </td>
                      <td>
                        {inv.receptionStatus === 'IN_TRANSIT' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-warning-bg)', color: '#B78103' }}>En tránsito</span>
                        ) : inv.receptionStatus === 'RECEIVED' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>Ingresada</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.status === 'PAID' ? 'var(--color-success-bg)' : isOverdue ? '#FFF0F0' : 'var(--color-warning-bg)', color: inv.status === 'PAID' ? 'var(--color-success)' : isOverdue ? 'var(--color-danger)' : '#B78103' }}>
                          {inv.status === 'PAID' ? 'Saldada' : isOverdue ? 'Vencida' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {canReceive && (
                            <button type="button" onClick={() => onOpenReceiveInvoice(inv)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Truck size={13} aria-hidden="true" /> Recibir
                            </button>
                          )}
                          <button type="button" onClick={() => onDeleteInvoice(inv.id, inv.invoiceNumber)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--color-danger)' }} aria-label={`Anular factura ${inv.invoiceNumber}`} title="Anular factura">
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
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
    </div>
  );
};
