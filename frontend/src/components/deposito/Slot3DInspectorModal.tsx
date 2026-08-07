import React, { useState } from 'react';
import type { Product, ProductLot } from '../../types';
import type { DepositSlot } from './depositomapaData';
import { SECTORS_INFO } from './depositomapaData';
import { X, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../../utils/api';

interface Slot3DInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: DepositSlot | null;
  products: Product[];
  onStockUpdated: () => void;
}

export const Slot3DInspectorModal: React.FC<Slot3DInspectorModalProps> = ({
  isOpen,
  onClose,
  slot,
  products,
  onStockUpdated
}) => {
  if (!isOpen || !slot) return null;

  const chamberInfo = SECTORS_INFO[slot.chamber] || SECTORS_INFO.GENERAL;

  // Determinar niveles soportados según slot.nivel (A, A-B, A-B-C, A-B-C-D-E-F)
  const supportsLevelA = true; // Todos los slots tienen Nivel A (Piso 1)
  const supportsLevelB = slot.nivel.includes('B');
  const supportsLevelC = slot.nivel.includes('C');

  // Estado del nivel activo seleccionado para inspección / carga
  const [activeLevel, setActiveLevel] = useState<'A' | 'B' | 'C'>('A');
  const [showLoadForm, setShowLoadForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario de carga de mercadería
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [productSearch, setProductSearch] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [isNewLot, setIsNewLot] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('Carga directa en mapa de depósito');
  
  // Estado de productos local para respuesta instantánea en la UI del Modal
  const [localProducts, setLocalProducts] = useState<Product[]>(products || []);

  React.useEffect(() => {
    setLocalProducts(products || []);
  }, [products]);


  // Filtrar productos por búsqueda
  const filteredProducts = (localProducts || []).filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(productSearch))
  ).slice(0, 8);

  // Obtener producto seleccionado
  const selectedProduct = (localProducts || []).find(p => p.id === Number(selectedProductId));

  // Obtener productos y lotes ubicados en este slot
  // Formato ubicación: D1-R06-C07-A, D1-R06-C07-B, D1-R06-C07-C o D1-R06-C07
  const getItemsForLevel = (level: 'A' | 'B' | 'C') => {
    const levelCode = `${slot.code}-${level}`;
    const levelItems: { product: Product; lot: ProductLot }[] = [];

    (localProducts || []).forEach(p => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach(l => {
          if (l.stock > 0 && (l.location === levelCode || (level === 'A' && l.location === slot.code))) {
            levelItems.push({ product: p, lot: l });
          }
        });
      } else if (p.stock > 0 && (p.defaultLocation === levelCode || (level === 'A' && p.defaultLocation === slot.code))) {
        levelItems.push({
          product: p,
          lot: {
            id: 0,
            productId: p.id,
            lotNumber: 'S/L',
            expirationDate: new Date().toISOString(),
            stock: p.stock,
            location: levelCode,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
      }
    });

    return levelItems;
  };


  const itemsLevelA = getItemsForLevel('A');
  const itemsLevelB = getItemsForLevel('B');
  const itemsLevelC = getItemsForLevel('C');

  const totalStockInSlot = 
    itemsLevelA.reduce((sum, item) => sum + item.lot.stock, 0) +
    itemsLevelB.reduce((sum, item) => sum + item.lot.stock, 0) +
    itemsLevelC.reduce((sum, item) => sum + item.lot.stock, 0);

  // Ejecutar carga de mercadería en el piso seleccionado
  const handleLoadStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrorMsg('Seleccioná un producto de la lista.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setErrorMsg('Ingresá una cantidad mayor a 0.');
      return;
    }

    const targetLocation = `${slot.code}-${activeLevel}`;

    try {
      setLoading(true);
      setErrorMsg(null);

      await api.assignWmsLocation({
        productId: Number(selectedProductId),
        locationCode: targetLocation,
        quantity: Number(quantity),
        lotNumber: lotNumber.trim() || undefined,
        expirationDate: expirationDate || undefined
      });

      setSuccessMsg(`⚡ ¡Mercadería asignada a la posición ${targetLocation} con éxito!`);
      setShowLoadForm(false);
      setSelectedProductId('');
      setQuantity('');
      setLotNumber('');
      onStockUpdated();

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la mercadería en el slot.');
    } finally {
      setLoading(false);
    }
  };

  // Cambiar ubicación de un lote
  const handleMoveLot = async (lot: ProductLot, newLevel: 'A' | 'B' | 'C') => {
    const newLocation = `${slot.code}-${newLevel}`;
    try {
      setLoading(true);
      setErrorMsg(null);

      await api.updateLot(lot.id, {
        location: newLocation
      });

      setSuccessMsg(`✅ Lote ${lot.lotNumber} reubicado al Piso ${newLevel === 'A' ? '1 (Nivel A)' : newLevel === 'B' ? '2 (Nivel B)' : '3 (Nivel C)'}.`);
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reubicar el lote.');
    } finally {
      setLoading(false);
    }
  };

  // Vaciar y liberar posición de forma unificada vía API atómica
  const handleVacatePosition = async (product: Product, lot: ProductLot) => {
    if (!window.confirm(`¿Confirmás vaciar y liberar la posición del producto [${product.sku}] ${product.name}?`)) {
      return;
    }

    const currentLevelCode = lot.location && lot.location !== 'S/U' ? lot.location : `${slot.code}-${activeLevel}`;

    try {
      setLoading(true);
      setErrorMsg(null);

      // Invocar endpoint atómico del backend
      await api.clearWmsLocation(currentLevelCode);

      // Actualización instantánea en la interfaz
      setLocalProducts(prev => prev.map(p => {
        if (p.id !== product.id) return p;
        const newLots = (p.lots || []).map(l => {
          if (l.id === lot.id || l.location === currentLevelCode || (l.location && l.location.toUpperCase().startsWith(slot.code.toUpperCase()))) {
            return { ...l, stock: 0, location: 'S/U' };
          }
          return l;
        });
        return {
          ...p,
          defaultLocation: (p.defaultLocation && p.defaultLocation.toUpperCase().startsWith(slot.code.toUpperCase())) ? null : p.defaultLocation,
          lots: newLots
        };
      }));

      setSuccessMsg(`⚡ Posición ${currentLevelCode} liberada con éxito.`);
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al vaciar la posición del slot.');
    } finally {
      setLoading(false);
    }
  };

  // Vaciar completamanete el slot entero (todos sus pisos)
  const handleVacateEntireSlot = async () => {
    if (!window.confirm(`¿Confirmás VACIAR COMPLETAMENTE el slot ${slot.code} (todos sus pisos A, B, C)?`)) {
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      await api.clearWmsLocation(slot.code);

      setLocalProducts(prev => prev.map(p => {
        const matchesSlot = (p.lots || []).some(l => l.location && l.location.toUpperCase().includes(slot.code.toUpperCase())) ||
                            (p.defaultLocation && p.defaultLocation.toUpperCase().includes(slot.code.toUpperCase()));
        if (!matchesSlot) return p;

        return {
          ...p,
          defaultLocation: p.defaultLocation && p.defaultLocation.toUpperCase().includes(slot.code.toUpperCase()) ? null : p.defaultLocation,
          lots: (p.lots || []).map(l => {
            if (l.location && l.location.toUpperCase().includes(slot.code.toUpperCase())) {
              return { ...l, stock: 0, location: 'S/U' };
            }
            return l;
          })
        };
      }));

      setSuccessMsg(`🧹 Slot ${slot.code} vaciado por completo.`);
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al vaciar el slot completo.');
    } finally {
      setLoading(false);
    }
  };





  return (
    <div className="wms-modal-backdrop" onClick={onClose}>
      <div className="wms-modal-card" onClick={e => e.stopPropagation()}>
        
        {/* Encabezado del Inspector Modal */}
        <div className="wms-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: chamberInfo.bg,
              color: chamberInfo.color,
              border: `1.5px solid ${chamberInfo.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
            }}>
              {chamberInfo.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Slot {slot.code}
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                  {totalStockInSlot > 0 ? `🟢 ${totalStockInSlot} u. en Stock` : '⚪ Vacío / Libre'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {slot.deposito} • {chamberInfo.label} • Nivel Físico: <strong>{slot.nivel}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {totalStockInSlot > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={handleVacateEntireSlot}
                disabled={loading}
              >
                🧹 Vaciar Slot Completo
              </button>
            )}

            <button 
              type="button" 
              className="wms-close-btn" 
              onClick={onClose}
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Mensajes de feedback */}
        {errorMsg && (
          <div className="alert alert-danger" style={{ margin: '12px 18px 0 18px', padding: '10px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success" style={{ margin: '12px 18px 0 18px', padding: '10px 14px', fontSize: '0.82rem' }}>
            {successMsg}
          </div>
        )}

        {/* Contenido Principal Modal */}
        <div className="wms-modal-body">

          {/* COLUMNA IZQUIERDA: Estantería Renderizada en 3D Isométrico */}
          <div className="wms-rack-3d-container">
            <div className="wms-rack-3d-header">
              <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                🏢 Estantería Tridimensional (3 Pisos)
              </span>
              <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.7rem' }}>
                Vista Isométrica 3D
              </span>
            </div>

            {/* Render 3D Isométrico de los 3 Pisos */}
            <div className="wms-isometric-rack-wrapper">
              
              {/* PISO 3: NIVEL C (SUPERIOR) */}
              <div 
                className={`wms-3d-shelf-level ${!supportsLevelC ? 'disabled' : ''} ${activeLevel === 'C' ? 'selected' : ''}`}
                onClick={() => supportsLevelC && setActiveLevel('C')}
              >
                <div className="wms-3d-shelf-top"></div>
                <div className="wms-3d-shelf-front">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>PISO 3 - NIVEL C (ALTILLO)</span>
                    {supportsLevelC ? (
                      <span className="badge" style={{ backgroundColor: itemsLevelC.length > 0 ? '#22c55e' : '#94a3b8', color: '#fff', fontSize: '0.65rem' }}>
                        {itemsLevelC.length > 0 ? `${itemsLevelC.reduce((s, i) => s + i.lot.stock, 0)} u.` : 'LIBRE'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>N/A</span>
                    )}
                  </div>

                  {itemsLevelC.length > 0 ? (
                    <div className="wms-3d-items-preview">
                      {itemsLevelC.map((item, idx) => (
                        <div key={idx} className="wms-3d-item-pill">
                          📦 {item.product.name} ({item.lot.stock}u)
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px' }}>
                      {supportsLevelC ? 'Posición superior vacía' : 'Sin piso superior en esta estantería'}
                    </div>
                  )}
                </div>
              </div>

              {/* PISO 2: NIVEL B (MEDIO) */}
              <div 
                className={`wms-3d-shelf-level ${!supportsLevelB ? 'disabled' : ''} ${activeLevel === 'B' ? 'selected' : ''}`}
                onClick={() => supportsLevelB && setActiveLevel('B')}
              >
                <div className="wms-3d-shelf-top"></div>
                <div className="wms-3d-shelf-front">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>PISO 2 - NIVEL B (ESTANTE MEDIO)</span>
                    {supportsLevelB ? (
                      <span className="badge" style={{ backgroundColor: itemsLevelB.length > 0 ? '#22c55e' : '#94a3b8', color: '#fff', fontSize: '0.65rem' }}>
                        {itemsLevelB.length > 0 ? `${itemsLevelB.reduce((s, i) => s + i.lot.stock, 0)} u.` : 'LIBRE'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>N/A</span>
                    )}
                  </div>

                  {itemsLevelB.length > 0 ? (
                    <div className="wms-3d-items-preview">
                      {itemsLevelB.map((item, idx) => (
                        <div key={idx} className="wms-3d-item-pill">
                          📦 {item.product.name} ({item.lot.stock}u)
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px' }}>
                      {supportsLevelB ? 'Posición media vacía' : 'Sin piso medio en esta estantería'}
                    </div>
                  )}
                </div>
              </div>

              {/* PISO 1: NIVEL A (INFERIOR / SUELO) */}
              <div 
                className={`wms-3d-shelf-level ${activeLevel === 'A' ? 'selected' : ''}`}
                onClick={() => setActiveLevel('A')}
              >
                <div className="wms-3d-shelf-top"></div>
                <div className="wms-3d-shelf-front">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>PISO 1 - NIVEL A (BASE / SUELO)</span>
                    <span className="badge" style={{ backgroundColor: itemsLevelA.length > 0 ? '#22c55e' : '#94a3b8', color: '#fff', fontSize: '0.65rem' }}>
                      {itemsLevelA.length > 0 ? `${itemsLevelA.reduce((s, i) => s + i.lot.stock, 0)} u.` : 'LIBRE'}
                    </span>
                  </div>

                  {itemsLevelA.length > 0 ? (
                    <div className="wms-3d-items-preview">
                      {itemsLevelA.map((item, idx) => (
                        <div key={idx} className="wms-3d-item-pill">
                          📦 {item.product.name} ({item.lot.stock}u)
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px' }}>
                      Posición inferior vacía
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div style={{ fontSize: '0.73rem', color: '#64748b', textAlign: 'center', marginTop: '12px' }}>
              💡 Tocá cualquiera de los 3 pisos en la estantería 3D para inspeccionar o cargar mercadería.
            </div>
          </div>

          {/* COLUMNA DERECHA: Detalle del Piso Seleccionado + Formulario de Carga */}
          <div className="wms-shelf-detail-container">
            
            {/* Nav Tabs para alternar nivel activo */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '14px', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className={`btn btn-sm ${activeLevel === 'A' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setActiveLevel('A'); setShowLoadForm(false); }}
                style={{ fontSize: '0.8rem', padding: '6px 14px', fontWeight: 700, borderRadius: '6px' }}
              >
                Piso 1 (Nivel A)
              </button>
              {supportsLevelB && (
                <button
                  type="button"
                  className={`btn btn-sm ${activeLevel === 'B' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setActiveLevel('B'); setShowLoadForm(false); }}
                  style={{ fontSize: '0.8rem', padding: '6px 14px', fontWeight: 700, borderRadius: '6px' }}
                >
                  Piso 2 (Nivel B)
                </button>
              )}
              {supportsLevelC && (
                <button
                  type="button"
                  className={`btn btn-sm ${activeLevel === 'C' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setActiveLevel('C'); setShowLoadForm(false); }}
                  style={{ fontSize: '0.8rem', padding: '6px 14px', fontWeight: 700, borderRadius: '6px' }}
                >
                  Piso 3 (Nivel C)
                </button>
              )}
            </div>

            {/* VISTA 1: Formulario de Carga Directa de Mercadería (Estilo Premium Minimalista Stripe / Linear) */}
            {showLoadForm ? (
              <form onSubmit={handleLoadStock} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📥 Cargar Mercadería en Piso {activeLevel === 'A' ? '1 (Nivel A)' : activeLevel === 'B' ? '2 (Nivel B)' : '3 (Nivel C)'}
                  </h4>
                  <span className="badge" style={{ backgroundColor: '#E2E8F0', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>
                    Slot {slot.code}-{activeLevel}
                  </span>
                </div>

                {/* 1. Seleccionar Producto */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    1. Seleccionar Producto (Catálogo)
                  </label>

                  {/* Campo de Búsqueda Rápida */}
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Buscar por nombre o SKU (ej: Cremoso, Tybo)..."
                    value={productSearch}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      if (selectedProductId !== '') setSelectedProductId('');
                    }}
                    style={{
                      height: '38px',
                      fontSize: '0.84rem',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      marginBottom: '6px',
                      paddingLeft: '10px'
                    }}
                  />

                  {/* Dropdown de Selección */}
                  <select
                    className="form-control"
                    value={selectedProductId}
                    onChange={e => {
                      const id = e.target.value ? Number(e.target.value) : '';
                      setSelectedProductId(id);
                      const found = (products || []).find(p => p.id === id);
                      if (found) {
                        setProductSearch(`[${found.sku}] ${found.name}`);
                      }
                    }}
                    style={{
                      height: '38px',
                      fontSize: '0.84rem',
                      borderRadius: '8px',
                      border: selectedProduct ? '1.5px solid #007AFF' : '1px solid #CBD5E1',
                      backgroundColor: selectedProduct ? '#F0F9FF' : '#FFFFFF',
                      fontWeight: selectedProduct ? 700 : 400,
                      color: '#0F172A'
                    }}
                  >
                    <option value="">-- Seleccionar Producto del Catálogo ({(products || []).length} disponibles) --</option>
                    {(filteredProducts.length > 0 ? filteredProducts : (products || [])).map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} — Stock Global: {p.stock} u.
                      </option>
                    ))}
                  </select>

                  {/* Ficha Resumen del Producto Seleccionado */}
                  {selectedProduct && (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      borderRadius: '8px',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {selectedProduct.sku}
                        </span>
                        <strong style={{ color: '#0F172A' }}>{selectedProduct.name}</strong>
                      </div>
                      <span className="badge" style={{ backgroundColor: '#0284C7', color: '#FFF', fontSize: '0.72rem', fontWeight: 700 }}>
                        Stock: {selectedProduct.stock} u.
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Datos del Lote */}
                <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                      2. Número de Lote
                    </label>
                    <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontWeight: 600 }}>
                      <input 
                        type="checkbox" 
                        checked={isNewLot} 
                        onChange={e => setIsNewLot(e.target.checked)} 
                        style={{ borderRadius: '4px' }}
                      />
                      <span>Crear como Lote Nuevo</span>
                    </label>
                  </div>

                  {selectedProduct && selectedProduct.lots && selectedProduct.lots.length > 0 && !isNewLot ? (
                    <select
                      className="form-control"
                      value={lotNumber}
                      onChange={e => setLotNumber(e.target.value)}
                      style={{ height: '36px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    >
                      <option value="">-- Seleccionar Lote Existente del Producto --</option>
                      {selectedProduct.lots.map(l => (
                        <option key={l.id} value={l.lotNumber}>
                          Lote: {l.lotNumber} | Venc: {new Date(l.expirationDate).toLocaleDateString('es-AR')} | Stock: {l.stock} u.
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nro de Lote (ej: L-2026-001)"
                      value={lotNumber}
                      onChange={e => setLotNumber(e.target.value)}
                      style={{ height: '36px', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    />
                  )}

                  {/* Fecha de Vencimiento */}
                  {(isNewLot || (selectedProduct && (!selectedProduct.lots || selectedProduct.lots.length === 0))) && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>
                        Fecha de Vencimiento
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={expirationDate}
                        onChange={e => setExpirationDate(e.target.value)}
                        style={{ height: '36px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      />
                    </div>
                  )}
                </div>

                {/* 3 y 4. Cantidad y Motivo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      3. Cantidad (u.)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="Cant."
                      value={quantity}
                      onChange={e => setQuantity(e.target.value ? Number(e.target.value) : '')}
                      style={{ height: '38px', fontSize: '0.88rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      4. Observación / Motivo
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Carga inicial WMS"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      style={{ height: '38px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    />
                  </div>
                </div>

                {/* Botones de Acción */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{
                      flex: 1,
                      height: '40px',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      backgroundColor: '#0F172A',
                      borderColor: '#0F172A',
                      color: '#FFFFFF',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {loading ? 'Guardando...' : `📥 Guardar en Piso ${activeLevel}`}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowLoadForm(false)}
                    style={{
                      height: '40px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      padding: '0 16px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#64748B'
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              /* VISTA 2: Detalle de la mercadería asignada en el nivel seleccionado */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Mercadería Asignada en Piso {activeLevel === 'A' ? '1 (Base A)' : activeLevel === 'B' ? '2 (Estante B)' : '3 (Altillo C)'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                      {getItemsForLevel(activeLevel).length} producto(s)
                    </span>
                    {getItemsForLevel(activeLevel).length > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setShowLoadForm(true)}
                      >
                        ➕ Agregar Mercadería
                      </button>
                    )}
                  </div>
                </div>

                {getItemsForLevel(activeLevel).length === 0 ? (
                  <div style={{ padding: '30px 10px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>⚪</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Piso Vacío (Disponible)</div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 14px 0' }}>
                      No hay productos registrados en esta altura de la estantería.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.82rem', padding: '7px 14px', fontWeight: 600 }}
                      onClick={() => setShowLoadForm(true)}
                    >
                      ➕ Cargar Mercadería Aquí
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                    {getItemsForLevel(activeLevel).map(({ product, lot }, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              [{product.sku}] {product.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              Rubro: {product.rubro?.name || 'General'}
                            </div>
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            {lot.stock} u.
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                          <div>Lote: <strong>{lot.lotNumber}</strong></div>
                          <div>Venc: <strong>{lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString('es-AR') : 'S/F'}</strong></div>
                        </div>

                        {/* Botones de Reubicación y Vaciado Minimalista Estilo Apple */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', gap: '4px', fontSize: '0.74rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Piso:</span>
                            {activeLevel !== 'A' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleMoveLot(lot, 'A')}
                                style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                              >
                                Piso 1 (A)
                              </button>
                            )}
                            {supportsLevelB && activeLevel !== 'B' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleMoveLot(lot, 'B')}
                                style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                              >
                                Piso 2 (B)
                              </button>
                            )}
                            {supportsLevelC && activeLevel !== 'C' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleMoveLot(lot, 'C')}
                                style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                              >
                                Piso 3 (C)
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              title="Vaciar y liberar esta posición física del slot"
                              onClick={() => handleVacatePosition(product, lot)}
                              style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px', color: '#e30613', borderColor: '#fca5a5', fontWeight: 700 }}
                            >
                              🗑️ Vaciar Posición
                            </button>
                          </div>

                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Pie del Modal */}
        <div className="wms-modal-footer">
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} color="#22c55e" />
            <span>Auditoría de Movimientos y Stock 100% Sincronizado</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
          >
            Cerrar Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
