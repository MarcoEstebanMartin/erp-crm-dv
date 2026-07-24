import React, { useState } from 'react';
import { api } from '../../utils/api';

const getWhatsAppLink = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return '';
  const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
  return `https://wa.me/${formatted}`;
};

interface ClientProfileModalProps {
  clientProfileModal: { open: boolean; client: any; ledger: any[] } | null;
  setClientProfileModal: (val: { open: boolean; client: any; ledger: any[] } | null) => void;
  setClientModal: (val: any) => void;
  setPaymentModal: (val: any) => void;
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  clientProfileModal,
  setClientProfileModal,
  setClientModal,
  setPaymentModal,
  fetchData,
  setSuccessMsg,
  setErrorMsg
}) => {
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' });
  const [showAddContact, setShowAddContact] = useState(false);

  if (!clientProfileModal || !clientProfileModal.open || !clientProfileModal.client) return null;

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name) return;

    try {
      const currentContacts = clientProfileModal.client.contacts || [];
      const updatedContacts = [...currentContacts, newContact];

      const updatedClient = await api.updateClient(clientProfileModal.client.id, {
        contacts: updatedContacts
      });

      setClientProfileModal({
        ...clientProfileModal,
        client: updatedClient
      });

      setNewContact({ name: '', phone: '', email: '', role: '' });
      setShowAddContact(false);
      setSuccessMsg('Contacto agregado con éxito.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al agregar contacto.');
    }
  };

  const handleRemoveContact = async (index: number) => {
    try {
      const currentContacts = [...(clientProfileModal.client.contacts || [])];
      currentContacts.splice(index, 1);

      const updatedClient = await api.updateClient(clientProfileModal.client.id, {
        contacts: currentContacts
      });

      setClientProfileModal({
        ...clientProfileModal,
        client: updatedClient
      });
      setSuccessMsg('Contacto eliminado.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar contacto.');
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              👤 Ficha de {clientProfileModal.client.isProvider && !clientProfileModal.client.isClient ? 'Proveedor' : 'Cliente'}: {clientProfileModal.client.name}
            </h3>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '20px',
              backgroundColor: clientProfileModal.client.isActive !== false ? '#E6F4EA' : '#FCE8E6',
              color: clientProfileModal.client.isActive !== false ? '#137333' : '#C5221F',
              border: '1px solid currentColor'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
              {clientProfileModal.client.isActive !== false ? 'Activo' : 'Inactivo'}
            </span>
            
            <div style={{ display: 'flex', gap: '6px' }}>
              {clientProfileModal.client.isClient && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Cliente</span>}
              {clientProfileModal.client.isProvider && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Proveedor</span>}
              {clientProfileModal.client.isSeller && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Vendedor</span>}
              {clientProfileModal.client.isCommissionAgent && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Comisionista</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              onClick={() => {
                setClientModal({
                  open: true,
                  mode: 'edit',
                  data: {
                    id: clientProfileModal.client.id,
                    name: clientProfileModal.client.name,
                    cuit: clientProfileModal.client.cuit || '',
                    address: clientProfileModal.client.address || '',
                    city: clientProfileModal.client.city || '',
                    phone: clientProfileModal.client.phone || '',
                    email: clientProfileModal.client.email || '',
                    creditLimit: clientProfileModal.client.creditLimit ? Number(clientProfileModal.client.creditLimit) : 0,
                    maxUnpaidInvoices: clientProfileModal.client.maxUnpaidInvoices ? Number(clientProfileModal.client.maxUnpaidInvoices) : 0,
                    priceList: clientProfileModal.client.priceList || 'A',
                    discount: clientProfileModal.client.discount ? Number(clientProfileModal.client.discount) : 0,
                    isClient: !!clientProfileModal.client.isClient,
                    isProvider: !!clientProfileModal.client.isProvider,
                    isSeller: !!clientProfileModal.client.isSeller,
                    isCommissionAgent: !!clientProfileModal.client.isCommissionAgent,
                    route: clientProfileModal.client.route || '',
                    saleRouteId: clientProfileModal.client.saleRouteId || null,
                    sellerId: clientProfileModal.client.sellerId || null,
                    isActive: clientProfileModal.client.isActive !== false
                  }
                });
                setClientProfileModal(null);
              }}
            >
              ✏️ Editar Datos
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setClientProfileModal(null)}>✕</button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {/* Columna Izquierda: Información Financiera y Contactos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
            
            {/* Tarjeta Financiera */}
            <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(249, 250, 251, 0.4)' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📊 Resumen de Cuenta
              </h4>
              
              {(() => {
                const balance = Number(clientProfileModal.client.outstandingBalance || 0);
                const limit = Number(clientProfileModal.client.maxUnpaidInvoices || 0);
                const pendingCount = clientProfileModal.client.pendingInvoicesCount || 0;
                
                const pct = limit > 0 ? Math.min(100, Math.round((pendingCount / limit) * 100)) : 0;
                const available = limit - pendingCount;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px', 
                      padding: '12px 14px', 
                      borderRadius: '8px', 
                      backgroundColor: balance > 0 ? 'rgba(239, 68, 68, 0.04)' : balance < 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(243, 244, 246, 0.5)', 
                      border: '1px solid', 
                      borderColor: balance > 0 ? 'rgba(239, 68, 68, 0.15)' : balance < 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)' 
                    }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Saldo Actual (en $)</span>
                      <span style={{ fontSize: '1.6rem', fontWeight: 700, color: balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                        {balance < 0 ? `$${Math.abs(balance).toLocaleString()} (A Favor)` : `$${balance.toLocaleString()}`}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Límite de Cta Cte:</span>
                        <span style={{ fontWeight: 600 }}>{limit > 0 ? `${limit} Boletas` : 'No habilitada'}</span>
                      </div>
                      
                      {clientProfileModal.client.isClient && limit > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>Boletas Adeudadas ({pct}%)</span>
                            <span>{pendingCount}</span>
                          </div>
                          <div style={{ height: '6px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 100 ? 'var(--color-danger)' : pct > 50 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Boletas Disponibles:</span>
                        <span style={{ fontWeight: 600, color: available <= 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                          {limit > 0 ? Math.max(0, available) : 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Lista de Precios:</span>
                        <span style={{ fontWeight: 600 }}>
                          {clientProfileModal.client.priceList === 'C' ? 'Lista Especial 2' : clientProfileModal.client.priceList === 'B' ? 'Lista Especial' : 'Lista 4'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Descuento Fijo:</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                          {clientProfileModal.client.discount || 0}%
                        </span>
                      </div>
                    </div>
                    
                    {clientProfileModal.client.isClient && (
                      <button 
                        type="button"
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '6px', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#fff', fontWeight: 600, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} 
                        onClick={() => setPaymentModal({ open: true, clientId: clientProfileModal.client.id, clientName: clientProfileModal.client.name })}
                      >
                        💰 Registrar Cobro CC
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            
            {/* Contactos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>👥 Contactos Asociados</h4>
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} onClick={() => setShowAddContact(!showAddContact)}>
                  {showAddContact ? 'Cancelar' : '+ Agregar'}
                </button>
              </div>

              {showAddContact && (
                <form onSubmit={handleAddContact} style={{ padding: '12px', backgroundColor: 'rgba(243, 244, 246, 0.4)', borderRadius: '8px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
                  <input type="text" className="input" placeholder="Nombre" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} required />
                  <input type="text" className="input" placeholder="Cargo/Rol" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
                  <input type="text" className="input" placeholder="Teléfono" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                  <input type="email" className="input" placeholder="Email" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: '0.8rem', fontWeight: 600 }}>Guardar Contacto</button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {(!clientProfileModal.client.contacts || clientProfileModal.client.contacts.length === 0) ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay contactos asociados.</span>
                ) : (
                  clientProfileModal.client.contacts.map((contact: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {contact.name} {contact.role && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({contact.role})</small>}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                          {contact.phone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              📞 {contact.phone}
                              <a href={getWhatsAppLink(contact.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                </svg>
                              </a>
                            </span>
                          )}
                          {contact.email && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>✉️ {contact.email}</span>}
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost text-danger" style={{ padding: '4px', borderRadius: '50%' }} onClick={() => handleRemoveContact(idx)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Columna Derecha: Datos de la Cuenta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '1px solid var(--border-color)', padding: '20px', borderRadius: '10px', backgroundColor: 'rgba(249, 250, 251, 0.4)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📋 Datos del Perfil y Despacho
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Razón Social / Nombre</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.name}</div>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>CUIT / Identificación</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.cuit || 'S/D'}</div>
                </div>
                
                <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Teléfono Principal</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {clientProfileModal.client.phone || 'S/D'}
                    {clientProfileModal.client.phone && (
                      <a href={getWhatsAppLink(clientProfileModal.client.phone)} target="_blank" rel="noopener noreferrer">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="#25D366">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Email Principal</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-all' }}>{clientProfileModal.client.email || 'S/D'}</div>
                </div>
                
                <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Dirección de Entrega</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.address || 'S/D'}</div>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Localidad</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.city || 'S/D'}</div>
                </div>
                
                <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Zona de Reparto (Chofer)</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {clientProfileModal.client.route ? `🚛 ${clientProfileModal.client.route}` : 'Sin Zona de Reparto'}
                  </div>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Vendedor Asignado</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {clientProfileModal.client.seller?.username ? `👤 ${clientProfileModal.client.seller.username.replace('_', ' ').toUpperCase()}` : 'Sin Vendedor'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setClientProfileModal(null)}>Cerrar Ficha</button>
        </div>
      </div>
    </div>
  );
};

export default ClientProfileModal;
