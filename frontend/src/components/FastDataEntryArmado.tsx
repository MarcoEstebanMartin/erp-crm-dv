import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import { Search, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export default function FastDataEntryArmado() {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // State for changes: { [orderItemId]: { quantity?: number, weight?: number } }
  const [updates, setUpdates] = useState<{ [key: number]: any }>({});
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus search input on mount
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // When order is loaded, focus the first weighable input if it exists
  useEffect(() => {
    if (order && firstInputRef.current) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [order]);

  const searchOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orderIdInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setOrder(null);
    setUpdates({});

    try {
      const orders = await api.getOrders();
      const found = orders.find((o: any) => o.id === Number(orderIdInput.trim()));
      
      if (!found) {
        throw new Error('Pedido no encontrado');
      }
      if (found.status !== OrderStatus.PENDING && found.status !== OrderStatus.PREPARING) {
        throw new Error(`El pedido #${found.id} está en estado ${found.status}. Solo se pueden procesar pedidos PENDIENTES o EN PREPARACIÓN.`);
      }

      setOrder(found);
      
      // Initialize updates state with current quantities and weights
      const initialUpdates: any = {};
      found.items.forEach((item: any) => {
        initialUpdates[item.id] = {
          quantity: item.quantity,
          weight: item.weight ? Number(item.weight) : ''
        };
      });
      setUpdates(initialUpdates);

    } catch (err: any) {
      setErrorMsg(err.message || 'Error al buscar el pedido.');
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateChange = (itemId: number, field: 'quantity' | 'weight', value: string) => {
    setUpdates(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value === '' ? '' : Number(value)
      }
    }));
  };

  const markMissing = (itemId: number) => {
    setUpdates(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: 0
      }
    }));
  };

  const confirmArmado = async () => {
    if (!order) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // Formatear payload
      const payload = Object.keys(updates).map(itemIdStr => {
        const itemId = Number(itemIdStr);
        const up = updates[itemId];
        return {
          orderItemId: itemId,
          quantity: up.quantity,
          weight: up.weight === '' ? undefined : up.weight
        };
      });

      await api.confirmOrderArmado(order.id, payload);
      
      setSuccessMsg(`Pedido #${order.id} armado y confirmado.`);
      setOrder(null);
      setUpdates({});
      setOrderIdInput('');
      
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al confirmar armado.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      action();
    }
  };

  let isFirstWeighableFound = false;

  return (
    <div className="card" style={{ maxWidth: '1000px', margin: '0 auto', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} onKeyDown={(e) => handleKeyDown(e, confirmArmado)}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
          <CheckCircle size={20} color="#3b82f6" />
          Confirmación de Armado (Data Entry)
        </h2>
      </div>

      <div className="card-body">
        {errorMsg && (
          <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <CheckCircle size={18} /> {successMsg}
          </div>
        )}

        <form onSubmit={searchOrder} style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={24} style={{ position: 'absolute', left: '16px', top: '16px', color: '#94a3b8' }} />
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                placeholder="Escanee o ingrese N° de Pedido y presione Enter..."
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                style={{ 
                  fontSize: '1.5rem', 
                  padding: '12px 20px 12px 50px', 
                  height: '60px', 
                  borderRadius: '12px',
                  border: '2px solid #cbd5e1'
                }}
                disabled={loading}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ fontSize: '1.2rem', padding: '0 30px', borderRadius: '12px' }}
              disabled={loading || !orderIdInput.trim()}
            >
              Buscar
            </button>
          </div>
        </form>

        {order && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Cliente</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{order.persona?.name || order.client?.name || 'Consumidor Final'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Pedido</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>#{order.id}</div>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#475569' }}>Producto</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Cant. Pedida</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Peso (kg)</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any) => {
                    const isPesable = item.product?.isPesable;
                    const isMissing = updates[item.id]?.quantity === 0;
                    const rowStyle = isMissing ? { backgroundColor: '#fee2e2', opacity: 0.8 } : (!isPesable ? { backgroundColor: '#f8fafc', opacity: 0.9 } : { backgroundColor: '#fff' });
                    
                    let refToAssign = null;
                    if (isPesable && !isFirstWeighableFound) {
                      refToAssign = firstInputRef;
                      isFirstWeighableFound = true;
                    }

                    return (
                      <tr key={item.id} style={{ ...rowStyle, borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '15px 12px', fontWeight: isPesable ? 600 : 400 }}>
                          {item.product?.name || item.productName}
                          {isPesable && <span style={{ marginLeft: '8px', fontSize: '0.75rem', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px' }}>Pesable</span>}
                        </td>
                        
                        <td style={{ padding: '15px 12px', textAlign: 'center' }}>
                          <input 
                            type="number"
                            className="form-control"
                            style={{ 
                              width: '80px', 
                              textAlign: 'center', 
                              margin: '0 auto',
                              textDecoration: isMissing ? 'line-through' : 'none',
                              backgroundColor: isMissing ? '#fecaca' : '#fff'
                            }}
                            value={updates[item.id]?.quantity ?? ''}
                            onChange={(e) => handleUpdateChange(item.id, 'quantity', e.target.value)}
                            min="0"
                            disabled={isMissing}
                          />
                        </td>
                        
                        <td style={{ padding: '15px 12px', textAlign: 'center' }}>
                          <input 
                            ref={refToAssign}
                            type="number"
                            step="0.001"
                            className="form-control"
                            style={{ 
                              width: '120px', 
                              textAlign: 'center', 
                              margin: '0 auto',
                              border: isPesable && !isMissing ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                              boxShadow: isPesable && !isMissing ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none',
                              backgroundColor: isMissing ? '#e2e8f0' : (isPesable ? '#eff6ff' : '#f8fafc')
                            }}
                            placeholder={isPesable ? "Ej: 3.450" : "-"}
                            value={updates[item.id]?.weight ?? ''}
                            onChange={(e) => handleUpdateChange(item.id, 'weight', e.target.value)}
                            disabled={!isPesable || isMissing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const formElements = Array.from(document.querySelectorAll('input:not([disabled]), button:not([disabled])')) as HTMLElement[];
                                const index = formElements.indexOf(e.currentTarget);
                                if (index > -1 && index < formElements.length - 1) {
                                  formElements[index + 1].focus();
                                }
                              }
                            }}
                          />
                        </td>

                        <td style={{ padding: '15px 12px', textAlign: 'center' }}>
                          {!isMissing ? (
                            <button 
                              type="button" 
                              className="btn"
                              style={{ 
                                backgroundColor: '#ef4444', 
                                color: 'white', 
                                padding: '6px 12px', 
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                margin: '0 auto',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              onClick={() => markMissing(item.id)}
                            >
                              <XCircle size={16} /> Faltante
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn"
                              style={{ 
                                backgroundColor: '#94a3b8', 
                                color: 'white', 
                                padding: '6px 12px', 
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleUpdateChange(item.id, 'quantity', item.quantity.toString())}
                            >
                              Deshacer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '12px 24px', fontSize: '1.1rem', borderRadius: '8px' }}
                onClick={() => { setOrder(null); setOrderIdInput(''); if(searchInputRef.current) searchInputRef.current.focus(); }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ 
                  padding: '12px 30px', 
                  fontSize: '1.1rem', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  backgroundColor: '#10b981',
                  borderColor: '#10b981'
                }}
                onClick={confirmArmado}
                disabled={loading}
              >
                <CheckCircle size={20} />
                Guardar y Siguiente (Ctrl+Enter)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
