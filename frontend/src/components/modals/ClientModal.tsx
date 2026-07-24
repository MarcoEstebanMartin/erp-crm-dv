import React from 'react';
import { api } from '../../utils/api';

interface ClientModalProps {
  clientModal: any;
  setClientModal: (val: any) => void;
  availableSellers: any[];
  availableSaleRoutes: any[];
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setClientsVersion: React.Dispatch<React.SetStateAction<number>>;
}

const ClientModal: React.FC<ClientModalProps> = ({
  clientModal,
  setClientModal,
  availableSellers,
  availableSaleRoutes,
  fetchData,
  setSuccessMsg,
  setErrorMsg,
  setClientsVersion
}) => {
  if (!clientModal || !clientModal.open) return null;

  const [isSearchingAfip, setIsSearchingAfip] = React.useState(false);

  const handleFetchAfipData = async () => {
    const cuitClean = (clientModal.data.cuit || '').replace(/\D/g, '');
    if (!cuitClean || cuitClean.length < 8) {
      setErrorMsg('Ingresá un CUIT válido (mínimo 8 u 11 dígitos).');
      return;
    }

    setIsSearchingAfip(true);
    setErrorMsg(null);
    try {
      const afipData = await api.getPersonaFromAFIP(cuitClean);
      if (afipData) {
        setClientModal((prev: any) => ({
          ...prev,
          data: {
            ...prev.data,
            name: afipData.name || prev.data.name,
            address: afipData.address || prev.data.address,
            city: afipData.location || prev.data.city
          }
        }));
        setSuccessMsg('✅ Datos de AFIP/ARCA cargados correctamente.');
      }
    } catch (err: any) {
      setErrorMsg('No se pudieron obtener los datos de AFIP.');
    } finally {
      setIsSearchingAfip(false);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, data } = clientModal;
    if (!data.name) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    try {
      const payload = {
        name: data.name,
        cuit: data.cuit,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        webPin: data.webPin !== undefined ? data.webPin : undefined,
        route: data.route,
        saleRouteId: data.saleRouteId ? Number(data.saleRouteId) : null,
        creditLimit: Number(data.creditLimit || 0),
        maxUnpaidInvoices: Number(data.maxUnpaidInvoices || 0),
        priceList: data.priceList || 'A',
        discount: Number(data.discount || 0),
        isClient: !!data.isClient,
        isProvider: !!data.isProvider,
        isSeller: !!data.isSeller,
        isCommissionAgent: !!data.isCommissionAgent,
        sellerId: data.sellerId ? Number(data.sellerId) : null,
        isActive: data.isActive !== false
      };

      if (mode === 'create') {
        await api.createPersona(payload);
      } else {
        await api.updatePersona(data.id, payload);
      }
      
      setClientModal({ ...clientModal, open: false });
      setSuccessMsg('Persona guardada exitosamente.');
      fetchData();
      setClientsVersion(prev => prev + 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar persona.');
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            👤 {clientModal.mode === 'create' ? 'Registrar Nuevo Cliente' : `Editar Cliente: ${clientModal.data.name}`}
          </h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setClientModal({ ...clientModal, open: false })}>✕</button>
        </div>
        
        <form onSubmit={handleClientSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', paddingBottom: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Columna Izquierda: Identificación y Contacto */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Tarjeta 1: Datos Identificatorios */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'rgba(249, 250, 251, 0.3)', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    📋 Identificación Básica
                  </h4>
                  
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Nombre Comercial / Razón Social *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ej: Almacén San Roque"
                      value={clientModal.data.name}
                      onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, name: e.target.value } })}
                      required
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                        CUIT o DNI
                      </label>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="ej: 20353859249 o DNI"
                          value={clientModal.data.cuit || ''}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, cuit: e.target.value } })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleFetchAfipData();
                            }
                          }}
                          onBlur={() => {
                            const clean = (clientModal.data.cuit || '').replace(/\D/g, '');
                            if ((clean.length === 7 || clean.length === 8 || clean.length === 11) && !clientModal.data.name) {
                              handleFetchAfipData();
                            }
                          }}
                          style={{ width: '100%', height: '38px', paddingRight: '72px' }}
                        />
                        <button
                          type="button"
                          onClick={handleFetchAfipData}
                          disabled={isSearchingAfip || !clientModal.data.cuit}
                          title="Buscar Razón Social y Domicilio automáticamente en ARCA / AFIP por CUIT o DNI"
                          style={{
                            position: 'absolute',
                            right: '4px',
                            top: '4px',
                            bottom: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                            opacity: isSearchingAfip || !clientModal.data.cuit ? 0.5 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isSearchingAfip ? '⏳' : '⚡ ARCA'}
                        </button>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>🔑 PIN Tienda B2B</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="ej: 4819"
                        value={clientModal.data.webPin || ''}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, webPin: e.target.value } })}
                        maxLength={8}
                        style={{ width: '100%', height: '38px', fontWeight: 700, letterSpacing: '1px' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Teléfono</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="ej: 11-4567-8901"
                        value={clientModal.data.phone}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, phone: e.target.value } })}
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Email</label>
                      <input
                        type="email"
                        className="input"
                        placeholder="ej: contacto@cliente.com"
                        value={clientModal.data.email}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, email: e.target.value } })}
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tarjeta 2: Roles de la Persona */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'rgba(249, 250, 251, 0.3)', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    👥 Roles y Estado en Sistema
                  </h4>
                  
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Roles de la Persona</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: clientModal.data.isClient ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                        transition: 'var(--transition-fast)'
                      }}>
                        <input
                          type="checkbox"
                          checked={!!clientModal.data.isClient}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isClient: e.target.checked } })}
                        />
                        <span style={{ fontWeight: clientModal.data.isClient ? 600 : 400 }}>Cliente</span>
                      </label>
                      
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: clientModal.data.isProvider ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                        transition: 'var(--transition-fast)'
                      }}>
                        <input
                          type="checkbox"
                          checked={!!clientModal.data.isProvider}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isProvider: e.target.checked } })}
                        />
                        <span style={{ fontWeight: clientModal.data.isProvider ? 600 : 400 }}>Proveedor</span>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: clientModal.data.isSeller ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                        transition: 'var(--transition-fast)'
                      }}>
                        <input
                          type="checkbox"
                          checked={!!clientModal.data.isSeller}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isSeller: e.target.checked } })}
                        />
                        <span style={{ fontWeight: clientModal.data.isSeller ? 600 : 400 }}>Vendedor</span>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: clientModal.data.isCommissionAgent ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                        transition: 'var(--transition-fast)'
                      }}>
                        <input
                          type="checkbox"
                          checked={!!clientModal.data.isCommissionAgent}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isCommissionAgent: e.target.checked } })}
                        />
                        <span style={{ fontWeight: clientModal.data.isCommissionAgent ? 600 : 400 }}>Comisionista</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Estado de la Persona</label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      padding: '10px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: clientModal.data.isActive !== false ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                      borderColor: clientModal.data.isActive !== false ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                      transition: 'var(--transition-fast)'
                    }}>
                      <input
                        type="checkbox"
                        checked={clientModal.data.isActive !== false}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isActive: e.target.checked } })}
                      />
                      <span style={{ fontWeight: clientModal.data.isActive !== false ? 600 : 400 }}>
                        Persona Activa (Habilitada para facturación/reparto)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Ubicación y Condiciones Comerciales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Tarjeta 3: Ubicación y Logística */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'rgba(249, 250, 251, 0.3)', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    📍 Dirección y Despacho
                  </h4>
                  
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Dirección de Entrega</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ej: Belgrano 1200, CABA"
                      value={clientModal.data.address}
                      onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, address: e.target.value } })}
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Localidad</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="ej: General Villegas"
                        value={clientModal.data.city || ''}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, city: e.target.value } })}
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Zona de Reparto (Chofer)</label>
                      <input
                        type="text"
                        list="route-suggestions"
                        className="input"
                        placeholder="ej: CENTRO 1, TROCHA..."
                        value={clientModal.data.route || ''}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, route: e.target.value } })}
                        style={{ width: '100%', height: '38px' }}
                      />
                      <datalist id="route-suggestions">
                        {(() => {
                          const cleanCity = (clientModal.data.city || '').toUpperCase().trim();
                          const isVillegas = cleanCity === 'GENERAL VILLEGAS' || cleanCity === 'GRAL VILLEGAS' || cleanCity === 'VILLEGAS' || cleanCity === '';
                          const routes = isVillegas 
                            ? ['FEDERAL', 'PARQUE', 'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'FONAVI', 'PROGRESO', 'TROCHA', 'CICLON', 'CRUCE']
                            : ['EMILIO V. BUNGE Y BUCHARDO', 'EMILIO V. BUNGE Y CORONEL CHARLONE', 'BANDERALÓ Y LARROUDÉ', 'VILLA SAUZE Y SANSINENA', 'FLORENTINO AMEGHINO Y BLAQUIER', 'RIVADAVIA Y FORTÍN OLAVARRÍA', 'PIEDRITAS', 'TRES ALGARROBOS', 'CARLOS TEJEDOR', 'INTENDENTE ALVEAR', 'RUFINO'];
                          return routes.map(r => <option key={r} value={r} />);
                        })()}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 4: Configuración Comercial */}
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px', 
                  backgroundColor: 'rgba(249, 250, 251, 0.3)',
                  boxShadow: 'var(--shadow-sm)',
                  opacity: clientModal.data.isClient ? 1 : 0.65,
                  transition: 'var(--transition-medium)'
                }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>💼 Condiciones Comerciales</span>
                    {!clientModal.data.isClient && <small style={{ textTransform: 'none', color: 'var(--text-muted)', fontSize: '0.75rem' }}>(Solo aplica a Cliente)</small>}
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Vendedor Asignado</label>
                      <select
                        className="select"
                        value={clientModal.data.sellerId || ''}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, sellerId: e.target.value ? Number(e.target.value) : null } })}
                        disabled={!clientModal.data.isClient}
                        style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      >
                        <option value="">Sin Vendedor</option>
                        {availableSellers.map(s => (
                          <option key={s.id} value={s.id}>{s.username.replace('_', ' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Ruta de Venta (Vendedor)</label>
                      <select
                        className="select"
                        value={clientModal.data.saleRouteId || ''}
                        onChange={(e) => {
                          const routeId = e.target.value ? Number(e.target.value) : null;
                          const selectedRoute = availableSaleRoutes.find(r => Number(r.id) === routeId);
                          let newSellerId = clientModal.data.sellerId;
                          if (selectedRoute) {
                            if (selectedRoute.sellerId) {
                              newSellerId = Number(selectedRoute.sellerId);
                            } else if (selectedRoute.name.toUpperCase().includes('OFICINA')) {
                              const oficinaSeller = availableSellers.find((s: any) => s.username.toUpperCase() === 'OFICINA');
                              if (oficinaSeller) newSellerId = oficinaSeller.id;
                            }
                          }
                          setClientModal({ ...clientModal, data: { ...clientModal.data, saleRouteId: routeId, sellerId: newSellerId } });
                        }}
                        disabled={!clientModal.data.isClient}
                        style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      >
                        <option value="">Sin Ruta de Venta</option>
                        {availableSaleRoutes.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.seller?.username || 'Sin Vendedor'})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', height: '18px', display: 'block', whiteSpace: 'nowrap' }}>Límite de Cta Cte</label>
                      <select
                        className="select"
                        value={clientModal.data.maxUnpaidInvoices}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, maxUnpaidInvoices: Number(e.target.value) } })}
                        disabled={!clientModal.data.isClient}
                        style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      >
                        <option value={0}>Sin Cta Cte</option>
                        <option value={0.5}>Media Boleta</option>
                        <option value={1}>1 Boleta</option>
                        <option value={2}>2 Boletas</option>
                        <option value={3}>3 Boletas</option>
                        <option value={4}>4 Boletas (Máximo)</option>
                      </select>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', height: '18px', display: 'block', whiteSpace: 'nowrap' }}>Lista de Precios</label>
                      <select
                        className="select"
                        value={clientModal.data.priceList}
                        onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, priceList: e.target.value } })}
                        disabled={!clientModal.data.isClient}
                        style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      >
                        <option value="A">Lista 4</option>
                        <option value="B">Lista Especial</option>
                        <option value="C">Lista Especial 2</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setClientModal({ ...clientModal, open: false })}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)', color: '#fff', fontWeight: 600 }}>
              {clientModal.mode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;
