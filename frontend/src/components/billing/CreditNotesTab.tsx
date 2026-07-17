import React, { useState, useMemo } from 'react';
import { api } from '../../utils/api';
import { 
  Plus, 
  X, 
  Printer, 
  CheckCircle,
  AlertTriangle 
} from 'lucide-react';

interface CreditNotesTabProps {
  creditNotes: any[];
  personas: any[];
  products: any[];
  loading: boolean;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  // Shared creation modal state
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

export default function CreditNotesTab({
  creditNotes,
  personas,
  products,
  loading,
  loadData,
  setErrorMsg,
  setSuccessMsg,
  showCreditNoteModal,
  setShowCreditNoteModal,
  creditNoteForm,
  setCreditNoteForm,
  creditNoteCart,
  setCreditNoteCart,
  cnClientSearchQuery,
  setCnClientSearchQuery,
  viewCreditNoteModal,
  setViewCreditNoteModal
}: CreditNotesTabProps) {
  const [cnProductSearchQuery, setCnProductSearchQuery] = useState('');
  const [showCNClientDropdown, setShowCNClientDropdown] = useState(false);
  const [activeCNClientSuggestionIdx, setActiveCNClientSuggestionIdx] = useState(0);
  const [showCNProductDropdown, setShowCNProductDropdown] = useState(false);
  const [activeCNProductSuggestionIdx, setActiveCNProductSuggestionIdx] = useState(0);
  
  const [selectedCNProduct, setSelectedCNProduct] = useState('');
  const [cnProductQty, setCnProductQty] = useState('1');
  const [cnProductPrice, setCnProductPrice] = useState('');
  const [cnProductWeight, setCnProductWeight] = useState('');

  // Status Filter inside tab
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL');

  const clientsOnly = useMemo(() => {
    return personas.filter(p => p.isClient);
  }, [personas]);

  const filteredCNClients = useMemo(() => {
    if (!cnClientSearchQuery) return clientsOnly.slice(0, 10);
    const q = cnClientSearchQuery.toUpperCase();
    return clientsOnly.filter((c: any) => 
      c.name.toUpperCase().includes(q) || (c.cuit && c.cuit.includes(q))
    ).slice(0, 10);
  }, [cnClientSearchQuery, clientsOnly]);

  const filteredCNProducts = useMemo(() => {
    if (!cnProductSearchQuery) return products.slice(0, 10);
    const q = cnProductSearchQuery.toUpperCase();
    return products.filter((p: any) => 
      p.name.toUpperCase().includes(q) || (p.sku && p.sku.toUpperCase().includes(q))
    ).slice(0, 10);
  }, [cnProductSearchQuery, products]);

  const selectedCNClient = useMemo(() => {
    if (!creditNoteForm.personaId) return null;
    return personas.find((p: any) => p.id === Number(creditNoteForm.personaId));
  }, [creditNoteForm.personaId, personas]);

  const handleSelectCNClient = (c: any) => {
    setCreditNoteForm(prev => ({
      ...prev,
      personaId: String(c.id),
      billingType: c.cuit ? 'OFFICIAL' : 'INTERNAL'
    }));
    setCnClientSearchQuery(c.name);
    setShowCNClientDropdown(false);
    setCreditNoteCart([]);
  };

  const handleSelectCNProduct = (p: any) => {
    setSelectedCNProduct(String(p.id));
    setCnProductSearchQuery(p.name);
    setCnProductPrice(String(p.listPrice));
    setCnProductWeight(p.isPesable ? String(p.approximateWeight || '') : '');
    setShowCNProductDropdown(false);
  };

  const handleAddCNProduct = () => {
    if (!selectedCNProduct) return;
    const prod = products.find(p => p.id === Number(selectedCNProduct));
    if (!prod) return;

    const qty = Number(cnProductQty);
    const price = Number(cnProductPrice);
    const weight = cnProductWeight ? Number(cnProductWeight) : null;

    if (qty <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }
    if (price < 0) {
      alert('El precio no puede ser negativo');
      return;
    }

    const subtotal = prod.isPesable 
      ? Math.round(Number(weight || qty * (prod.approximateWeight || 1)) * price)
      : Math.round(qty * price);

    setCreditNoteCart(prev => [
      ...prev,
      {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        quantity: qty,
        weight,
        isPesable: prod.isPesable,
        unitPrice: price,
        subtotal
      }
    ]);

    setSelectedCNProduct('');
    setCnProductSearchQuery('');
    setCnProductQty('1');
    setCnProductPrice('');
    setCnProductWeight('');
  };

  const handleRemoveCNProduct = (prodId: number) => {
    setCreditNoteCart(prev => prev.filter(item => item.productId !== prodId));
  };

  const handleApproveCreditNote = async (id: number) => {
    if (!window.confirm('¿Está seguro de que desea APROBAR esta Nota de Crédito? Se emitirá el comprobante oficial/interno, se registrará el stock y se descontará del saldo del cliente.')) {
      return;
    }
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const result = await api.approveCreditNote(id);
      setSuccessMsg('Nota de Crédito aprobada correctamente.');
      loadData();
      setViewCreditNoteModal(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aprobar la Nota de Crédito.');
    }
  };

  const handleRejectCreditNote = async (id: number) => {
    if (!window.confirm('¿Está seguro de que desea RECHAZAR esta Nota de Crédito? Quedará anulada de manera permanente.')) {
      return;
    }
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.rejectCreditNote(id);
      setSuccessMsg('Nota de Crédito rechazada.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al rechazar la Nota de Crédito.');
    }
  };

  const handleCreateCreditNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!creditNoteForm.personaId) {
      setErrorMsg('Debe seleccionar un cliente.');
      return;
    }

    const itemsToSend = creditNoteCart.filter(item => item.isPesable ? (item.weight && item.weight > 0) : (item.quantity > 0));
    if (itemsToSend.length === 0) {
      setErrorMsg('Debe agregar al menos un producto con cantidad/peso a devolver o bonificar.');
      return;
    }

    if (creditNoteForm.orderId) {
      for (const item of itemsToSend) {
        if (item.quantity > item.orderQuantity) {
          setErrorMsg(`La cantidad a devolver de ${item.name} (${item.quantity}) no puede superar la cantidad original (${item.orderQuantity}).`);
          return;
        }
        if (item.isPesable && item.weight && item.orderWeight && item.weight > item.orderWeight) {
          setErrorMsg(`El peso a devolver de ${item.name} (${item.weight} kg) no puede superar el peso original (${item.orderWeight} kg).`);
          return;
        }
      }
    }

    try {
      const payload = {
        personaId: Number(creditNoteForm.personaId),
        orderId: creditNoteForm.orderId ? Number(creditNoteForm.orderId) : null,
        billingType: creditNoteForm.billingType,
        reason: creditNoteForm.reason,
        comments: creditNoteForm.comments,
        items: itemsToSend.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          weight: item.isPesable ? (item.weight || null) : null,
          unitPrice: item.unitPrice
        }))
      };

      const result = await api.createCreditNote(payload);
      setSuccessMsg(`Nota de Crédito emitida correctamente (#${result.creditNoteNumber || result.id})`);
      
      setShowCreditNoteModal(false);
      setCreditNoteCart([]);
      setCreditNoteForm({
        personaId: '',
        orderId: '',
        billingType: 'INTERNAL',
        reason: 'DEVOLUCION',
        comments: ''
      });
      setCnClientSearchQuery('');
      setCnProductSearchQuery('');
      loadData();
      setViewCreditNoteModal(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir la Nota de Crédito.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: '0' }}>🔄 Notas de Crédito y Devoluciones emitidas</h3>
            <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>Módulo para anulación parcial o total de facturas y reingreso de mercadería al stock.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              className="select" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ width: '150px' }}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING_APPROVAL">Pendiente de Aprobación</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
            </select>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setCreditNoteForm({
                  personaId: '',
                  orderId: '',
                  billingType: 'INTERNAL',
                  reason: 'DEVOLUCION',
                  comments: ''
                });
                setCnClientSearchQuery('');
                setCreditNoteCart([]);
                setShowCreditNoteModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Crear Nota de Crédito Libre
            </button>
          </div>
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
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>Cargando notas de crédito...</td></tr>
              ) : creditNotes.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>No se encontraron notas de crédito.</td></tr>
              ) : (
                creditNotes
                  .filter(note => statusFilter === 'ALL' || note.status === statusFilter)
                  .map((note) => (
                  <tr key={note.id}>
                    <td>{new Date(note.createdAt).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: note.status === 'APPROVED' ? '#E8F5E9' : 
                                         note.status === 'PENDING_APPROVAL' ? '#FFF9C4' : '#FFEBEE',
                        color: note.status === 'APPROVED' ? '#2E7D32' : 
                               note.status === 'PENDING_APPROVAL' ? '#F57F17' : '#C62828'
                      }}>
                        {note.status === 'APPROVED' ? 'Aprobada' : 
                         note.status === 'PENDING_APPROVAL' ? 'Pendiente Aprobación' : 'Rechazada'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{note.creditNoteNumber || `NCI-PENDIENTE-${note.id}`}</td>
                    <td>
                      <div>{note.persona?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {note.persona?.cuit || 'S/D'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{note.reason}</span>
                      {note.comments && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{note.comments}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                      -${Number(note.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => setViewCreditNoteModal(note)}
                        >
                          Ver Detalle
                        </button>
                        {note.status === 'PENDING_APPROVAL' && (
                          <>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.78rem', color: 'var(--color-success)', borderColor: 'var(--color-success)', backgroundColor: 'transparent' }}
                              onClick={() => handleApproveCreditNote(note.id)}
                            >
                              Aprobar
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.78rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', backgroundColor: 'transparent' }}
                              onClick={() => handleRejectCreditNote(note.id)}
                            >
                              Anular
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          MODAL: EMISIÓN DE NOTA DE CRÉDITO
          ==================================================================== */}
      {showCreditNoteModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1200px', width: '92vw', height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3>
                Emitir Nota de Crédito {creditNoteForm.orderId ? `para Factura #${creditNoteForm.orderId}` : '(Libre)'}
              </h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowCreditNoteModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateCreditNoteSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
                
                {/* COLUMNA IZQUIERDA: CLIENTE Y PRODUCTOS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
                  
                  {/* Buscador de Cliente */}
                  <div className="form-group" style={{ position: 'relative', margin: 0 }}>
                    <label>Buscar Cliente</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Buscar por nombre o CUIT..."
                      value={cnClientSearchQuery}
                      onChange={(e) => {
                        setCnClientSearchQuery(e.target.value);
                        setShowCNClientDropdown(true);
                      }}
                      disabled={!!creditNoteForm.orderId}
                      onFocus={() => setShowCNClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCNClientDropdown(false), 250)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setShowCNClientDropdown(true);
                          setActiveCNClientSuggestionIdx((prev) => 
                            filteredCNClients.length > 0 ? (prev + 1) % filteredCNClients.length : 0
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setShowCNClientDropdown(true);
                          setActiveCNClientSuggestionIdx((prev) => 
                            filteredCNClients.length > 0 ? (prev - 1 + filteredCNClients.length) % filteredCNClients.length : 0
                          );
                        } else if (e.key === 'Enter') {
                          if (showCNClientDropdown && filteredCNClients.length > 0) {
                            e.preventDefault();
                            handleSelectCNClient(filteredCNClients[activeCNClientSuggestionIdx]);
                          }
                        }
                      }}
                    />
                    {showCNClientDropdown && filteredCNClients.length > 0 && (
                      <div className="suggestions-list" style={{ position: 'absolute', zIndex: 100, width: '100%', maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                        {filteredCNClients.map((c, idx) => (
                          <div
                            key={c.id}
                            className={`suggestion-item ${idx === activeCNClientSuggestionIdx ? 'active' : ''}`}
                            onMouseDown={() => handleSelectCNClient(c)}
                            onMouseEnter={() => setActiveCNClientSuggestionIdx(idx)}
                            style={{ padding: '8px', cursor: 'pointer', backgroundColor: idx === activeCNClientSuggestionIdx ? '#e8f0fe' : '#fff' }}
                          >
                            {c.name} (CUIT: {c.cuit || 'S/D'})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selector y Buscador de Productos (Solo si hay cliente seleccionado y no está atada a orden) */}
                  {selectedCNClient && !creditNoteForm.orderId && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                        <label>Añadir Producto</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Escribí para buscar..."
                          value={cnProductSearchQuery}
                          onChange={(e) => {
                            setCnProductSearchQuery(e.target.value);
                            setShowCNProductDropdown(true);
                          }}
                          onFocus={() => setShowCNProductDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCNProductDropdown(false), 250)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setShowCNProductDropdown(true);
                              setActiveCNProductSuggestionIdx((prev) => 
                                filteredCNProducts.length > 0 ? (prev + 1) % filteredCNProducts.length : 0
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setShowCNProductDropdown(true);
                              setActiveCNProductSuggestionIdx((prev) => 
                                filteredCNProducts.length > 0 ? (prev - 1 + filteredCNProducts.length) % filteredCNProducts.length : 0
                              );
                            } else if (e.key === 'Enter') {
                              if (showCNProductDropdown && filteredCNProducts.length > 0) {
                                e.preventDefault();
                                handleSelectCNProduct(filteredCNProducts[activeCNProductSuggestionIdx]);
                              }
                            }
                          }}
                        />
                        {showCNProductDropdown && filteredCNProducts.length > 0 && (
                          <div className="suggestions-list" style={{ position: 'absolute', zIndex: 100, width: '100%', maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                            {filteredCNProducts.map((p, idx) => (
                              <div
                                key={p.id}
                                className={`suggestion-item ${idx === activeCNProductSuggestionIdx ? 'active' : ''}`}
                                onMouseDown={() => handleSelectCNProduct(p)}
                                onMouseEnter={() => setActiveCNProductSuggestionIdx(idx)}
                                style={{ padding: '8px', cursor: 'pointer', backgroundColor: idx === activeCNProductSuggestionIdx ? '#e8f0fe' : '#fff' }}
                              >
                                {p.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Precio</label>
                        <input type="number" step="0.01" className="input" value={cnProductPrice} onChange={(e) => setCnProductPrice(e.target.value)} />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Cantidad</label>
                        <input type="number" className="input" value={cnProductQty} onChange={(e) => setCnProductQty(e.target.value)} />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Kilos (Pesables)</label>
                        <input type="number" step="0.001" className="input" value={cnProductWeight} onChange={(e) => setCnProductWeight(e.target.value)} placeholder="Kilos" />
                      </div>

                      <button type="button" className="btn btn-primary" onClick={handleAddCNProduct}>Añadir</button>
                    </div>
                  )}

                  {/* Tabla de ítems a devolver */}
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff' }}>
                    {(() => {
                      if (creditNoteCart.length === 0) {
                        return (
                          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No hay productos agregados en el detalle.
                          </div>
                        );
                      }
                      return (
                        <table style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>P. Unitario</th>
                              <th>Cantidad</th>
                              <th>Kilos</th>
                              <th>Importe</th>
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {creditNoteCart.map((item, idx) => (
                              <tr key={idx}>
                                <td>
                                  <strong>{item.name}</strong>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>SKU: {item.sku}</div>
                                </td>
                                <td>
                                  {creditNoteForm.orderId ? (
                                    <span>${Number(item.unitPrice).toLocaleString()}</span>
                                  ) : (
                                    <input 
                                      type="number" 
                                      className="input" 
                                      style={{ padding: '4px', maxWidth: '100px' }}
                                      value={item.unitPrice} 
                                      onChange={(e) => {
                                        const price = Number(e.target.value);
                                        const newCart = [...creditNoteCart];
                                        newCart[idx].unitPrice = price;
                                        newCart[idx].subtotal = item.isPesable 
                                          ? Math.round(Number(item.weight || item.quantity * (item.approximateWeight || 1)) * price)
                                          : Math.round(item.quantity * price);
                                        setCreditNoteCart(newCart);
                                      }}
                                    />
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="input"
                                    style={{ padding: '4px', maxWidth: '80px' }}
                                    min="0"
                                    max={item.orderQuantity}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const qty = Number(e.target.value);
                                      const newCart = [...creditNoteCart];
                                      newCart[idx].quantity = qty;
                                      newCart[idx].subtotal = item.isPesable 
                                        ? Math.round(Number(item.weight || qty * (item.approximateWeight || 1)) * item.unitPrice)
                                        : Math.round(qty * item.unitPrice);
                                      setCreditNoteCart(newCart);
                                    }}
                                  />
                                  {item.orderQuantity && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Máx: {item.orderQuantity}</span>
                                  )}
                                </td>
                                <td>
                                  {item.isPesable ? (
                                    <input
                                      type="number"
                                      step="0.001"
                                      className="input"
                                      style={{ padding: '4px', maxWidth: '100px' }}
                                      min="0"
                                      max={item.orderWeight}
                                      value={item.weight || ''}
                                      onChange={(e) => {
                                        const weight = Number(e.target.value);
                                        const newCart = [...creditNoteCart];
                                        newCart[idx].weight = weight;
                                        newCart[idx].subtotal = Math.round(weight * item.unitPrice);
                                        setCreditNoteCart(newCart);
                                      }}
                                    />
                                  ) : (
                                    <span style={{ color: 'var(--text-secondary)' }}>N/A</span>
                                  )}
                                  {item.orderWeight && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Máx: {item.orderWeight} kg</span>
                                  )}
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  ${Number(item.subtotal).toLocaleString()}
                                </td>
                                <td>
                                  {!creditNoteForm.orderId && (
                                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--color-danger)', padding: '2px' }} onClick={() => handleRemoveCNProduct(item.productId)}>
                                      <X size={16} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>

                {/* COLUMNA DERECHA: PARAMETROS Y TOTALES */}
                <div style={{ 
                  backgroundColor: '#f8f8fa', 
                  borderRadius: '8px', 
                  padding: '20px', 
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                    Resumen y Parámetros
                  </h3>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Motivo de la Emisión</label>
                    <select 
                      className="input" 
                      value={creditNoteForm.reason} 
                      onChange={(e) => setCreditNoteForm(prev => ({ ...prev, reason: e.target.value }))}
                    >
                      <option value="DEVOLUCION">Devolución física de mercadería</option>
                      <option value="DESCUENTO">Diferencia de precio / Bonificación</option>
                      <option value="ERROR_FACTURACION">Error impositivo / Facturación</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Tipo de Comprobante</label>
                    <select 
                      className="input" 
                      value={creditNoteForm.billingType} 
                      onChange={(e) => setCreditNoteForm(prev => ({ ...prev, billingType: e.target.value }))}
                      disabled={!!creditNoteForm.orderId || (selectedCNClient && !selectedCNClient.cuit)} 
                    >
                      <option value="INTERNAL">Interno (Presupuesto / Sin AFIP)</option>
                      {selectedCNClient?.cuit && (
                        <option value="OFFICIAL">Oficial (AFIP - Nota de Crédito A o B)</option>
                      )}
                    </select>
                    {creditNoteForm.orderId && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                        La sucursal está determinada automáticamente por la factura seleccionada.
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Comentarios / Notas</label>
                    <textarea 
                      className="input" 
                      rows={3} 
                      value={creditNoteForm.comments}
                      onChange={(e) => setCreditNoteForm(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="Ingresar comentarios internos o motivos detallados..."
                      style={{ resize: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Totales */}
                  {(() => {
                    const subtotal = creditNoteCart.reduce((sum, item) => sum + item.subtotal, 0);
                    const isA = creditNoteForm.billingType === 'OFFICIAL' && selectedCNClient && selectedCNClient.cuit && selectedCNClient.cuit.replace(/-/g, '').length === 11;
                    const net = isA ? subtotal / 1.21 : Math.round(subtotal / 1.21);
                    const tax = subtotal - net;
                    const decimalOptions = isA ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

                    return (
                      <div style={{ 
                        marginTop: 'auto', 
                        backgroundColor: '#ffffff', 
                        padding: '16px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Subtotal Neto:</span>
                          <span style={{ fontWeight: 600 }}>${net.toLocaleString('es-AR', decimalOptions)}</span>
                        </div>
                        {creditNoteForm.billingType === 'OFFICIAL' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>IVA Débito Revertido (21%):</span>
                            <span style={{ fontWeight: 600 }}>${tax.toLocaleString('es-AR', decimalOptions)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                          <span style={{ fontWeight: 700 }}>Total a Acreditar:</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                            -${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        {selectedCNClient && (
                          <div style={{ 
                            fontSize: '0.78rem', 
                            padding: '8px 12px', 
                            borderRadius: '4px', 
                            backgroundColor: '#e6f4ea', 
                            color: '#137333', 
                            marginTop: '10px',
                            fontWeight: 500,
                            textAlign: 'center'
                          }}>
                            El saldo de C/C bajará a: ${(Number(selectedCNClient.outstandingBalance || 0) - subtotal).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}

                        <button 
                          type="submit" 
                          className="btn btn-primary" 
                          disabled={loading || subtotal === 0}
                          style={{ width: '100%', padding: '12px', marginTop: '10px', fontSize: '0.9rem', fontWeight: 600 }}
                        >
                          {loading ? 'Procesando emisión...' : 'Confirmar y Emitir Nota de Crédito'}
                        </button>
                      </div>
                    );
                  })()}

                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: DETALLE E IMPRESIÓN DE NOTA DE CRÉDITO
          ==================================================================== */}
      {viewCreditNoteModal && (() => {
        const isOfficial = viewCreditNoteModal.billingType === 'OFFICIAL';
        const formattedDate = viewCreditNoteModal.createdAt 
          ? new Date(viewCreditNoteModal.createdAt).toLocaleDateString('es-AR') 
          : new Date().toLocaleDateString('es-AR');

        return (
          <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-content" style={{ 
              maxWidth: '850px', 
              width: '90vw', 
              maxHeight: '90vh', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden' 
            }}>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Visualización de Comprobante</h2>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setViewCreditNoteModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                
                {/* Plantilla de Impresión de Nota de Crédito */}
                <div id="invoice-print-section" style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #1D1D1F',
                  padding: '24px',
                  borderRadius: '6px',
                  color: '#000000',
                  fontSize: '0.8rem',
                  lineHeight: '1.4'
                }}>
                  
                  {/* Cabecera del Ticket */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.4fr 1.2fr', borderBottom: '2px solid #000', paddingBottom: '14px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>DISTRIBUIDORA DV</div>
                      <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '4px' }}>
                        <div>Calle Falsa 1234, Quilmes</div>
                        <div>Teléfono: 0800-333-1212</div>
                        <div>Email: administracion@distribuidoradv.com.ar</div>
                        <div>IVA Responsable Inscripto</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        border: '2px solid #000',
                        width: '45px',
                        height: '45px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        backgroundColor: '#fff',
                        position: 'relative'
                      }}>
                        {viewCreditNoteModal.creditNoteType?.includes('_A') ? 'A' :
                         viewCreditNoteModal.creditNoteType?.includes('_B') ? 'B' : 'X'}
                        <span style={{ fontSize: '0.5rem', fontWeight: 600, marginTop: '-2px' }}>
                          {viewCreditNoteModal.creditNoteType?.includes('_A') ? 'COD. 003' :
                           viewCreditNoteModal.creditNoteType?.includes('_B') ? 'COD. 008' : 'COD. 000'}
                        </span>
                      </div>
                    </div>

                    <div style={{ paddingLeft: '20px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>NOTA DE CRÉDITO</div>
                      <div style={{ fontSize: '0.76rem', marginTop: '6px' }}>
                        <div><strong>Número: {viewCreditNoteModal.creditNoteNumber || `NCI-${viewCreditNoteModal.id.toString().padStart(8, '0')}`}</strong></div>
                        <div>Fecha: {formattedDate}</div>
                        <div>CUIT: 30-71490283-9</div>
                        <div>Ingresos Brutos: 30-71490283-9</div>
                      </div>
                    </div>
                  </div>

                  {/* Receptor */}
                  <div style={{ border: '1px solid #000', padding: '10px', marginBottom: '14px', display: 'grid', gridTemplateColumns: '1.5fr 1fr' }}>
                    <div>
                      <div><strong>Cliente:</strong> {viewCreditNoteModal.persona?.name}</div>
                      <div><strong>Domicilio:</strong> {viewCreditNoteModal.persona?.address || 'S/D'}</div>
                    </div>
                    <div>
                      <div><strong>CUIT:</strong> {viewCreditNoteModal.persona?.cuit || 'S/D'}</div>
                      <div><strong>IVA:</strong> {viewCreditNoteModal.creditNoteType?.includes('_A') ? 'Responsable Inscripto' : 'Consumidor Final'}</div>
                    </div>
                  </div>

                  {/* Conceptos de la nota de crédito */}
                  <div style={{ backgroundColor: '#f9f9fb', padding: '8px 12px', border: '1px dashed #777', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Concepto / Motivo de la Acreditación:</strong> {viewCreditNoteModal.reason}</span>
                    {viewCreditNoteModal.orderId && <span>Asociado a Pedido #{viewCreditNoteModal.orderId}</span>}
                  </div>

                  {/* Detalle de ítems */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#eee' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Producto</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>Cant</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>Kilos</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '100px' }}>P. Unit</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '110px' }}>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewCreditNoteModal.items && viewCreditNoteModal.items.map((item: any, index: number) => {
                        const isA = viewCreditNoteModal.creditNoteType?.includes('_A');
                        const displayPrice = isA ? (item.unitPrice / 1.21) : item.unitPrice;
                        const subtotal = item.weight ? item.weight * item.unitPrice : item.quantity * item.unitPrice;
                        const displaySubtotal = isA ? (subtotal / 1.21) : subtotal;

                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '6px' }}>
                              <strong>{item.product?.name || `Producto #${item.productId}`}</strong>
                              <div style={{ fontSize: '0.7rem', color: '#666' }}>SKU: {item.product?.sku}</div>
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{item.quantity}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{item.weight || '-'}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              ${Number(displayPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>
                              ${Number(displaySubtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Totales */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                    <div style={{ padding: '10px', fontSize: '0.74rem' }}>
                      {isOfficial ? (
                        <>
                          <div><strong>Comprobante Autorizado Oficialmente por AFIP Web Services</strong></div>
                          <div>CAE N°: {viewCreditNoteModal.cae}</div>
                          <div>Vto. CAE: {viewCreditNoteModal.caeDueDate ? new Date(viewCreditNoteModal.caeDueDate).toLocaleDateString('es-AR') : ''}</div>
                        </>
                      ) : (
                        <div style={{ color: '#777', fontWeight: 600, textAlign: 'center', paddingTop: '10px' }}>
                          COMPROBANTE INTERNO - NO VÁLIDO COMO FACTURA
                        </div>
                      )}
                    </div>

                    <div style={{ border: '1px solid #000', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {isOfficial ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Neto Gravado:</span>
                            <span>${Number(viewCreditNoteModal.netAmount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>IVA 21%:</span>
                            <span>${Number(viewCreditNoteModal.taxAmount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Subtotal Neto:</span>
                          <span>${Number(viewCreditNoteModal.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, borderTop: '2px solid #000', paddingTop: '8px', marginTop: '4px' }}>
                        <span>TOTAL BONIFICADO:</span>
                        <span>-${Number(viewCreditNoteModal.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              <div className="modal-footer no-print" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0 0' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
                  <Printer size={16} /> Imprimir Comprobante
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setViewCreditNoteModal(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
