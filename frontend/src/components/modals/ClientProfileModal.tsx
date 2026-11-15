import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';
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
  setErrorMsg,
}) => {
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' });
  const [showAddContact, setShowAddContact] = useState(false);

  if (!clientProfileModal || !clientProfileModal.open || !clientProfileModal.client) return null;

  const client = clientProfileModal.client;
  const balance = Number(client.outstandingBalance || 0);
  const limit = Number(client.maxUnpaidInvoices || 0);
  const pendingCount = Number(client.pendingInvoicesCount || 0);
  const pct = limit > 0 ? Math.min(100, Math.round((pendingCount / limit) * 100)) : 0;
  const available = limit - pendingCount;

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name.trim()) return;
    try {
      const updatedContacts = [...(client.contacts || []), newContact];
      const updatedClient = await api.updateClient(client.id, { contacts: updatedContacts });
      setClientProfileModal({ ...clientProfileModal, client: updatedClient });
      setNewContact({ name: '', phone: '', email: '', role: '' });
      setShowAddContact(false);
      setSuccessMsg('Contacto agregado.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al agregar contacto.');
    }
  };

  const handleRemoveContact = async (index: number) => {
    try {
      const updatedContacts = [...(client.contacts || [])];
      updatedContacts.splice(index, 1);
      const updatedClient = await api.updateClient(client.id, { contacts: updatedContacts });
      setClientProfileModal({ ...clientProfileModal, client: updatedClient });
      setSuccessMsg('Contacto eliminado.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar contacto.');
    }
  };

  const handleEditClient = () => {
    setClientModal({
      open: true,
      mode: 'edit',
      data: {
        id: client.id,
        name: client.name,
        cuit: client.cuit || '',
        address: client.address || '',
        city: client.city || '',
        barrio: client.barrio || '',
        phone: client.phone || '',
        email: client.email || '',
        creditLimit: client.creditLimit ? Number(client.creditLimit) : 0,
        maxUnpaidInvoices: client.maxUnpaidInvoices ? Number(client.maxUnpaidInvoices) : 0,
        priceList: client.priceList || 'A',
        discount: client.discount ? Number(client.discount) : 0,
        isClient: !!client.isClient,
        isProvider: !!client.isProvider,
        isSeller: !!client.isSeller,
        isCommissionAgent: !!client.isCommissionAgent,
        route: client.route || '',
        saleRouteId: client.saleRouteId || null,
        sellerId: client.sellerId || null,
        isActive: client.isActive !== false,
      },
    });
    setClientProfileModal(null);
  };

  const roleBadges = [
    client.isClient && 'Cliente',
    client.isProvider && 'Proveedor',
    client.isSeller && 'Vendedor',
    client.isCommissionAgent && 'Comisionista',
  ].filter(Boolean) as string[];

  return (
    <NativeModalDialog
      isOpen={true}
      onClose={() => setClientProfileModal(null)}
      ariaLabelledBy="client-profile-title"
      style={{ maxWidth: '940px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px' }}
    >
      <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 id="client-profile-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {client.name}
          </h3>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.76rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: client.isActive !== false ? '#E6F4EA' : '#FCE8E6',
              color: client.isActive !== false ? '#137333' : '#C5221F',
            }}
          >
            {client.isActive !== false ? 'Activo' : 'Inactivo'}
          </span>
          {roleBadges.map((label) => (
            <span key={label} style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600 }} onClick={handleEditClient}>
            Editar
          </button>
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '6px', display: 'flex', alignItems: 'center' }} onClick={() => setClientProfileModal(null)}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.55fr', gap: '22px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', borderRight: '1px solid var(--border-color)', paddingRight: '18px' }}>
          <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Cuenta
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Saldo</span>
                <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, color: balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                  {balance < 0 ? `+$${Math.abs(Math.round(balance)).toLocaleString('es-AR')}` : `$${Math.round(balance).toLocaleString('es-AR')}`}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Límite</span>
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>{limit > 0 ? `${limit} boletas` : 'Contado'}</span>
                </div>

                {client.isClient && limit > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '2px 0' }}>
                    <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Pendientes ({pct}%)</span>
                      <span>{pendingCount}</span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 100 ? 'var(--color-danger)' : pct > 50 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: '3px' }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disponibles</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: available <= 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                    {limit > 0 ? Math.max(0, available) : 0}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Lista</span>
                  <span style={{ fontWeight: 600 }}>
                    {client.priceList === 'C' ? 'Especial 2' : client.priceList === 'B' ? 'Especial' : 'Lista 4'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Descuento</span>
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>{client.discount || 0}%</span>
                </div>
              </div>

              {client.isClient && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '4px', fontWeight: 600, padding: '9px' }}
                  onClick={() => setPaymentModal({ open: true, clientId: client.id, clientName: client.name })}
                >
                  Cobrar
                </button>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Contactos</h4>
              <button type="button" className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.78rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} onClick={() => setShowAddContact(!showAddContact)}>
                {showAddContact ? 'Cancelar' : 'Agregar'}
              </button>
            </div>

            {showAddContact && (
              <form onSubmit={handleAddContact} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
                <input aria-label="Nombre de contacto" type="text" className="input" placeholder="Nombre" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} required />
                <input aria-label="Cargo" type="text" className="input" placeholder="Rol" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
                <input aria-label="Teléfono de contacto" type="text" className="input" placeholder="Teléfono" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                <input aria-label="Email de contacto" type="email" className="input" placeholder="Email" autoCorrect="off" autoCapitalize="none" spellCheck={false} style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: '0.8rem', fontWeight: 600 }}>Guardar</button>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '190px', overflowY: 'auto' }}>
              {(!client.contacts || client.contacts.length === 0) ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  Sin contactos
                </span>
              ) : (
                client.contacts.map((contact: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {contact.name} {contact.role && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({contact.role})</small>}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {contact.phone && (
                          <span className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {contact.phone}
                            <a href={getWhatsAppLink(contact.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${contact.name}`} style={{ color: '#166534', display: 'inline-flex' }}>
                              <MessageCircle size={13} />
                            </a>
                          </span>
                        )}
                        {contact.email && <span>{contact.email}</span>}
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost text-danger" aria-label={`Quitar ${contact.name}`} style={{ padding: '4px' }} onClick={() => handleRemoveContact(idx)}>
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border-color)', padding: '18px', borderRadius: '8px', backgroundColor: '#fafafa', alignSelf: 'start' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Ficha
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Nombre</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{client.name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>CUIT</span>
              <div className="tabular-nums" style={{ fontSize: '0.94rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{client.cuit || '-'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Teléfono</span>
              <div className="tabular-nums" style={{ fontSize: '0.94rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {client.phone || '-'}
                {client.phone && (
                  <a href={getWhatsAppLink(client.phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={{ color: '#166534', display: 'inline-flex' }}>
                    <MessageCircle size={15} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Email</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-all' }}>{client.email || '-'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Dirección</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{client.address || '-'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Localidad</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{client.city || '-'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Reparto</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{client.route || '-'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Vendedor</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                {client.seller?.username ? client.seller.username.replace('_', ' ').toUpperCase() : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setClientProfileModal(null)}>
          Cerrar
        </button>
      </div>
    </NativeModalDialog>
  );
};

export default ClientProfileModal;
