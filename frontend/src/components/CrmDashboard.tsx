import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { 
  Sparkles, 
  Users, 
  ShoppingCart, 
  Send, 
  CheckCircle, 
  Loader2,
  RefreshCw,
  TrendingUp,
  X
} from 'lucide-react';

export default function CrmDashboard() {
  const [alerts, setAlerts] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de Orden de Compra Auto-sugerida
  const [suggestedPoModal, setSuggestedPoModal] = useState<any | null>(null);

  const fetchCRMAlerts = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getCrmAlerts();
      setAlerts(data);
    } catch (err: any) {
      setErrorMsg('Error al calcular predicciones de CRM.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMAlerts();
  }, []);

  // --- ENVIAR ORDEN DE COMPRA SUGERIDA IA ---
  const handleAutoGeneratePO = (suggestionGroup: any) => {
    // Agrupar sugerencias de reabastecimiento por proveedor sugerido
    const providerId = suggestionGroup.suggestedProviderId;
    const providerName = suggestionGroup.suggestedProviderName;
    
    // Todos los productos sugeridos para este mismo proveedor
    const items = alerts?.replenishmentSuggestions
      .filter((s: any) => s.suggestedProviderId === providerId)
      .map((s: any) => ({
        productId: s.productId,
        productName: s.productName,
        sku: s.sku,
        quantity: s.suggestedQuantity,
        costPrice: s.costPrice
      }));

    setSuggestedPoModal({
      providerId,
      providerName,
      items
    });
  };

  const handleConfirmSuggestedPOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!suggestedPoModal) return;

    try {
      setLoading(true);
      await api.createPurchaseOrder({
        personaId: suggestedPoModal.providerId,
        items: suggestedPoModal.items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
          costPrice: i.costPrice
        }))
      });

      setSuccessMsg(`✨ Orden de compra sugerida por la IA creada con éxito para ${suggestedPoModal.providerName}.`);
      setSuggestedPoModal(null);
      fetchCRMAlerts();
    } catch (err: any) {
      setErrorMsg('Error al guardar la orden de compra sugerida.');
    } finally {
      setLoading(false);
    }
  };

  const replenishmentGroups = useMemo(() => {
    if (!alerts?.replenishmentSuggestions) return [];
    // Agrupar por proveedor
    const groups: { [key: number]: { providerId: number, providerName: string, items: any[] } } = {};
    alerts.replenishmentSuggestions.forEach((s: any) => {
      if (!groups[s.suggestedProviderId]) {
        groups[s.suggestedProviderId] = {
          providerId: s.suggestedProviderId,
          providerName: s.suggestedProviderName,
          items: []
        };
      }
      groups[s.suggestedProviderId].items.push(s);
    });
    return Object.values(groups);
  }, [alerts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Feedback alerts */}
      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          borderLeft: '4px solid var(--color-success)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {errorMsg && (
        <div style={{
          backgroundColor: '#FFF2F2',
          borderLeft: '4px solid var(--color-danger)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Asistente Inteligente IA - Sugerencias de Abastecimiento */}
      <div className="card" style={{ borderLeft: '4px solid var(--color-info)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-info)' }}>
            <Sparkles size={20} />
            <h3 className="card-title" style={{ margin: '0' }}>Asistente de Reabastecimiento IA (Bajo Stock)</h3>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={fetchCRMAlerts} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} className={loading ? 'spin-anim' : ''} />
            Recalcular
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
          Nuestra inteligencia artificial analiza diariamente los niveles de stock contra los mínimos del catálogo, generando borradores rápidos de órdenes de compra para reabastecer de forma óptima a tus proveedores.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <Loader2 className="spin-anim" style={{ margin: '0 auto 10px auto' }} />
            <span>Ejecutando predicciones de inventario...</span>
          </div>
        ) : replenishmentGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
            <CheckCircle size={24} style={{ color: 'var(--color-success)', marginBottom: '8px' }} />
            <h5 style={{ margin: 0 }}>Stock Perfecto</h5>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Todos los artículos tienen stock por encima del mínimo de seguridad.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {replenishmentGroups.map(group => (
              <div 
                key={group.providerId}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#F8F8FA',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px' }}>
                    Proveedor Sugerido: {group.providerName}
                  </h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {group.items.map((item, idx) => (
                      <span 
                        key={idx}
                        className="badge" 
                        style={{ backgroundColor: '#E2E2E2', fontSize: '0.72rem', fontWeight: 500 }}
                      >
                        {item.productName}: pedir {item.suggestedQuantity} u.
                      </span>
                    ))}
                  </div>
                </div>
                <button 
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => handleAutoGeneratePO(group)}
                >
                  <ShoppingCart size={14} />
                  Generar Orden Compra
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* CLIENTES INACTIVOS (ALERTA CHURN) */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-color)' }}>
            <Users size={20} />
            <h3 className="card-title" style={{ margin: '0' }}>Alerta de Clientes Inactivos (&gt;15 días sin comprar)</h3>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Saldo Deudor</th>
                  <th>Última Compra</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {!alerts?.inactiveClients || alerts.inactiveClients.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>Todos los clientes han comprado recientemente. ¡Excelente relación!</td></tr>
                ) : (
                  alerts.inactiveClients.map((client: any) => (
                    <tr key={client.id}>
                      <td style={{ fontWeight: 600 }}>{client.name}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem' }}>{client.phone || 'Sin teléfono'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {client.cuit}</div>
                      </td>
                      <td style={{ color: client.outstandingBalance > 0 ? 'var(--color-danger)' : 'var(--text-primary)', fontWeight: 600 }}>
                        ${client.outstandingBalance.toLocaleString()}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString('es-AR') : 'Nunca compró'}
                      </td>
                      <td>
                        <a 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          href={`https://wa.me/${client.phone ? client.phone.replace(/\D/g, '') : '5491100000000'}?text=Hola%20${encodeURIComponent(client.name)},%20te%20escribimos%20de%20DV%20Distribuidora.%20%C2%BFC%C3%B3mo%20est%C3%A1s%3F%20Quer%C3%ADamos%20saber%20si%20necesitabas%20reponer%20mercader%C3%ADa%20esta%20semana.`} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          <Send size={12} />
                          <span>Contactar</span>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SUGERENCIAS DE CONSUMO PERSONALIZADAS POR CLIENTE */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#137333' }}>
            <TrendingUp size={20} style={{ color: 'var(--color-success)' }} />
            <h3 className="card-title" style={{ margin: '0' }}>Sugerencias de Venta Cruzada por Cliente</h3>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Productos Frecuentes Omitidos en Último Pedido</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {!alerts?.consumerSuggestions || alerts.consumerSuggestions.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center' }}>No hay suficientes datos de compras previas para formular sugerencias.</td></tr>
                ) : (
                  alerts.consumerSuggestions.map((group: any) => (
                    <tr key={group.clientId}>
                      <td style={{ fontWeight: 600 }}>{group.clientName}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {group.suggestedProducts.map((p: any, idx: number) => (
                            <span 
                              key={idx} 
                              style={{ 
                                fontSize: '0.75rem', 
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              📦 {p.name} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>(Histórico: {p.frequency} u.)</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => alert(`Sugerencia cargada en preventa para ${group.clientName}. Se le ofrecerán estos productos prioritariamente.`)}
                        >
                          Ofrecer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ====================================================================
          MODAL: CONFIRMAR ORDEN DE COMPRA AUTO-SUGERIDA (IA)
          ==================================================================== */}
      {suggestedPoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Confirmar Borrador sugerido por la IA</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSuggestedPoModal(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleConfirmSuggestedPOSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
                <div>
                  <strong>Proveedor de Abastecimiento:</strong> {suggestedPoModal.providerName}
                </div>
                <div>
                  <strong>Artículos sugeridos a reponer (Stock &lt;= Mínimo):</strong>
                </div>

                <div className="table-container" style={{ borderRadius: '6px' }}>
                  <table style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Artículo</th>
                        <th style={{ textAlign: 'right' }}>Cant Sugerida</th>
                        <th style={{ textAlign: 'right' }}>Costo Est.</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestedPoModal.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{item.productName} ({item.sku})</td>
                          <td style={{ textAlign: 'right' }}>{item.quantity} u.</td>
                          <td style={{ textAlign: 'right' }}>${item.costPrice}</td>
                          <td style={{ textAlign: 'right' }}>${(item.quantity * item.costPrice).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: '#F8F8FA',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  <span>Total Estimado del Abastecimiento:</span>
                  <span style={{ color: 'var(--accent-color)' }}>
                    ${suggestedPoModal.items.reduce((acc: number, i: any) => acc + (i.quantity * i.costPrice), 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSuggestedPoModal(null)}>Descartar Borrador</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  Generar Orden de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estilos locales para las animaciones del spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1.2s linear infinite;
        }
      `}</style>

    </div>
  );
}
