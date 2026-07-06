import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

interface RendicionGroup {
  user: {
    id: number;
    username: string;
    role: string;
  };
  totalToCollect: number;
  totalBranchA: number;
  totalBranchX: number;
  transactions: any[];
}

const RendicionesDashboard: React.FC = () => {
  const [rendiciones, setRendiciones] = useState<RendicionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchRendiciones = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/collections/rendiciones`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Verificar si es un array
      if (Array.isArray(res.data)) {
        setRendiciones(res.data);
      } else {
        setRendiciones([]);
        console.error('La respuesta no es un array', res.data);
      }
    } catch (error) {
      console.error('Error fetching rendiciones', error);
      setRendiciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRendiciones();
  }, []);

  const handleVerify = async (sellerId: number) => {
    if (!window.confirm('¿Confirmas que recibiste el dinero físico de esta rendición? (El dinero ingresará a la Caja Grande)')) return;
    
    setActionLoading(sellerId);
    try {
      await axios.post(`${API_BASE_URL}/collections/rendiciones/verify`, { sellerId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Recargar rendiciones
      fetchRendiciones();
    } catch (error) {
      console.error('Error verifying rendicion', error);
      alert('Hubo un error al verificar la rendición.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <DollarSign className="text-gray-500" />
        Rendiciones Pendientes de Vendedores
      </h2>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando rendiciones...</div>
      ) : rendiciones.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-light)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
          <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
          <p>No hay rendiciones pendientes en este momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rendiciones.map(rend => (
            <div key={rend.user.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              
              {/* Header (Summary) */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px', 
                  backgroundColor: expandedId === rend.user.id ? 'var(--bg-light)' : '#fff',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => setExpandedId(expandedId === rend.user.id ? null : rend.user.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '10px', borderRadius: '50%' }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{rend.user.username}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rend.transactions.length} recibos generados</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Físico a Rendir</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(rend.totalToCollect)}</div>
                  </div>
                  {expandedId === rend.user.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                </div>
              </div>

              {/* Body (Details & Actions) */}
              {expandedId === rend.user.id && (
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    {/* Contabilidad Interna */}
                    <div style={{ backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Desglose Contable (Sistema)</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Sucursal A (Oficial)</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(rend.totalBranchA)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Sucursal X (Interno)</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(rend.totalBranchX)}</span>
                      </div>
                    </div>

                    {/* Detalle Transacciones */}
                    <div style={{ backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Últimos Recibos</h4>
                      {rend.transactions.map(tx => (
                        <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                          <span>{tx.receiptNumber} - {tx.persona?.name}</span>
                          <span style={{ fontWeight: 500 }}>{formatCurrency(Number(tx.amount))}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Verifica que el dinero físico coincida con el Total a Rendir.</span>
                    <button 
                      className="btn btn-primary"
                      style={{ padding: '10px 24px', fontWeight: 600 }}
                      disabled={actionLoading === rend.user.id}
                      onClick={() => handleVerify(rend.user.id)}
                    >
                      {actionLoading === rend.user.id ? 'Procesando...' : 'Verificar y Cerrar Rendición'}
                    </button>
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RendicionesDashboard;
