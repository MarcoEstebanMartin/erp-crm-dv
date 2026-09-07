import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Search, ArrowRightLeft, Printer, CheckCircle2, Info, Edit2, Replace, X } from 'lucide-react';
import { API_BASE_URL, api } from '../../utils/api';

interface OffersSideBySideComparatorProps {
  onBack?: () => void;
  initialBaselineId?: number;
  initialTargetId?: number;
}

interface CampaignOption {
  id: number;
  title: string;
  createdAt: string;
}

interface ComparisonRow {
  productId: number;
  productName: string;
  sku: string;
  group: string;
  baselinePrice: number | null;
  baselineTag: string | null;
  targetPrice: number | null;
  targetTag: string | null;
  priceDiff: number | null;
  priceDiffPercent: number | null;
  status: 'NEW' | 'REMOVED' | 'INCREASE' | 'DECREASE' | 'UNCHANGED';
  reason?: string;
}

function getConciseReason(productName: string, group?: string, rawReason?: string): string {
  if (rawReason && !rawReason.includes('Seleccionado automáticamente') && !rawReason.includes('regla de rubro') && !rawReason.includes('Producto Seleccionado')) {
    return rawReason;
  }
  const p = (productName || '').toUpperCase();

  // 1. Duros (REGG, REGGANITO, REGGIANITO, SARDO, SBRINZ, PEPATO, PROV, PROVOLONE, PROVOLETA, GOYA, etc.)
  if (
    p.includes('REGG') || p.includes('SARDO') || p.includes('SBRINZ') || 
    p.includes('PEPATO') || p.includes('PROV') || p.includes('GOYA') || 
    p.includes('PARMESANO') || p.includes('ROMANO') || p.includes('DURO')
  ) {
    return '2 Quesos Duros';
  }

  // 2. Semiduros (TYBO, GOUDA, CHEDDAR, FONT, FONTINA, HOLANDO, DANBO, BARRA, PATE, PATEGRAS, EDAM, etc.)
  if (
    p.includes('TYBO') || p.includes('GOUDA') || p.includes('CHEDDAR') || 
    p.includes('FONT') || p.includes('HOLANDO') || p.includes('DANBO') || 
    p.includes('BARRA') || p.includes('PATE') || p.includes('EDAM') || 
    p.includes('FIAMBRE') || p.includes('SEMIDURO')
  ) {
    return '2 Quesos Semiduros';
  }

  // 3. Blandos & Especiales (AZUL, ROQUEFORT, CREMOSO, CREM, SALUT, MOZZA, BLANDO, FRESCO)
  if (p.includes('AZUL') || p.includes('ROQUEFORT')) {
    return 'Queso Azul Especial';
  }
  if (
    p.includes('CREMOSO') || p.includes('CREM') || p.includes('SALUT') || 
    p.includes('MOZZARELLA') || p.includes('MOZZA') || p.includes('BLANDO') || 
    p.includes('FRESCO')
  ) {
    return '2 Quesos Blandos';
  }

  // 4. Rallados & Untables
  if (p.includes('RALLADO') || p.includes('RALL')) {
    return '1 Queso Rallado Obligatorio';
  }
  if (p.includes('UNTABLE') || p.includes('QUESO CREMA') || p.includes('CREMA')) {
    return '1 Untable / Queso Crema Obligatorio';
  }

  // 5. Rotación Cremigal / Lácteos
  if (p.includes('POLVO')) return 'Rotación Leche en Polvo';
  if (p.includes('DULCE') || p.includes('DDL') || p.includes('REPOSTERO')) return 'Rotación Dulce de Leche';
  if (p.includes('MANTECA')) return 'Rotación Manteca';
  if (p.includes('LECHE') || p.includes('YOGURT')) return 'Básico Fijo Cremigal';

  // 6. Bebidas & RPB
  if (p.includes('BAGGIO') || p.includes('VIDA') || p.includes('MOCORETA') || p.includes('RPB')) return 'Jugo Baggio / Vida (Fijo)';
  if (p.includes('FERNET') || p.includes('BRANCA')) return 'Fernet Branca (Fijo)';
  if (
    p.includes('VINO') || p.includes('BALBO') || p.includes('JULIA') || 
    p.includes('BIANCHI') || p.includes('ALAMBRADO') || p.includes('PERDIZ') || 
    p.includes('ZUCCARDI') || p.includes('LOPEZ') || p.includes('RURAL')
  ) return 'Vino Seleccionado de Bodega';

  // 7. Almacén
  if (p.includes('GIACOMO') || p.includes('CAPELETTINI')) return 'Capelettini Giacomo (Fijo)';
  if (p.includes('NATURA') || p.includes('MAYONESA') || p.includes('MAYO') || p.includes('MOSTAZA') || p.includes('KETCHUP')) return 'Rotación Mayonesa / Aderezos';
  if (p.includes('AMANDA') || p.includes('ANDRESITO') || p.includes('PLAYADITO') || p.includes('YERBA')) return 'Rotación Yerba Mate';

  // Fallbacks limpios por grupo
  if (group === 'MELINCUE' || group === 'CREMIGAL') return 'Sugerido por parámetro de Quesería / Lácteos';
  if (group === 'BEBIDAS' || group === 'R.P.B') return 'Sugerido por parámetro de Bebidas';
  if (group === 'ALMACEN') return 'Sugerido por parámetro de Almacén';

  return 'Sugerido por regla del catálogo';
}

function renderTypeBadge(productName: string, groupName?: string) {
  const p = (productName || '').toUpperCase();
  const grp = (groupName || '').toUpperCase();
  
  let label = '';
  let bg = 'rgba(148, 163, 184, 0.12)';
  let color = '#475569';
  let border = 'rgba(148, 163, 184, 0.25)';

  const isMelincue = grp === 'MELINCUE' || p.includes('MELINCUE');
  const isCremigal = grp === 'CREMIGAL' || p.includes('CREMIGAL');

  if (isMelincue) {
    if (
      p.includes('REGG') || p.includes('SARDO') || p.includes('SBRINZ') || 
      p.includes('PEPATO') || p.includes('PROV') || p.includes('GOYA') || 
      p.includes('PARMESANO') || p.includes('ROMANO')
    ) {
      label = 'DURO';
      bg = 'rgba(59, 130, 246, 0.12)';
      color = '#2563eb';
      border = 'rgba(59, 130, 246, 0.25)';
    } else if (
      p.includes('PATE') || p.includes('CHEDDAR') || p.includes('DANBO') || 
      p.includes('GOUDA') || p.includes('EDAM')
    ) {
      label = 'SEMIDURO';
      bg = 'rgba(139, 92, 246, 0.12)';
      color = '#7c3aed';
      border = 'rgba(139, 92, 246, 0.25)';
    } else if (
      p.includes('FONT') || p.includes('TYBO') || p.includes('HOLANDO') || 
      p.includes('BARRA') || p.includes('DANIELA')
    ) {
      label = 'SEMIBLANDO';
      bg = 'rgba(99, 102, 241, 0.12)';
      color = '#4f46e5';
      border = 'rgba(99, 102, 241, 0.25)';
    } else if (p.includes('AZUL') || p.includes('ROQUEFORT')) {
      label = 'AZUL';
      bg = 'rgba(14, 165, 233, 0.12)';
      color = '#0284c7';
      border = 'rgba(14, 165, 233, 0.25)';
    } else if (
      p.includes('CREMOSO') || p.includes('CREM') || p.includes('SALUT') || 
      p.includes('MOZZARELLA') || p.includes('MOZZA') || p.includes('BLANDO') || 
      p.includes('FRESCO')
    ) {
      label = 'BLANDO';
      bg = 'rgba(16, 185, 129, 0.12)';
      color = '#059669';
      border = 'rgba(16, 185, 129, 0.25)';
    } else if (p.includes('RALLADO') || p.includes('RALL')) {
      label = 'RALLADO';
      bg = 'rgba(245, 158, 11, 0.12)';
      color = '#d97706';
      border = 'rgba(245, 158, 11, 0.25)';
    }
  } else if (isCremigal) {
    if (p.includes('UNTABLE') || p.includes('QUESO CREMA') || p.includes('CREMA')) {
      label = 'UNTABLE';
      bg = 'rgba(6, 182, 212, 0.12)';
      color = '#0891b2';
      border = 'rgba(6, 182, 212, 0.25)';
    } else if (p.includes('POLVO') || p.includes('DULCE') || p.includes('DDL') || p.includes('MANTECA') || p.includes('REPOSTERO')) {
      label = 'ROTACIÓN';
      bg = 'rgba(245, 158, 11, 0.12)';
      color = '#d97706';
      border = 'rgba(245, 158, 11, 0.25)';
    } else {
      label = 'ALTA DEMANDA';
      bg = 'rgba(100, 116, 139, 0.12)';
      color = '#475569';
      border = 'rgba(100, 116, 139, 0.25)';
    }
  }

  if (!label) return null;

  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 'bold',
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: bg,
      color: color,
      border: `1px solid ${border}`,
      letterSpacing: '0.4px',
      textTransform: 'uppercase',
      flexShrink: 0
    }}>
      {label}
    </span>
  );
}

export default function OffersSideBySideComparator({ onBack, initialBaselineId, initialTargetId }: OffersSideBySideComparatorProps) {
  const [loading, setLoading] = useState(true);
  const [allCampaigns, setAllCampaigns] = useState<CampaignOption[]>([]);
  const [baselineId, setBaselineId] = useState<number | null>(initialBaselineId || null);
  const [targetId, setTargetId] = useState<number | null>(initialTargetId || null);

  const [baselineTitle, setBaselineTitle] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [groupsData, setGroupsData] = useState<Record<string, ComparisonRow[]>>({});
  
  const [searchTerm, setSearchTerm] = useState('');

  // Selected item for (VER) detail modal
  const [activeVerModal, setActiveVerModal] = useState<ComparisonRow | null>(null);
  
  // Custom edited prices map
  const [editedPrices, setEditedPrices] = useState<Record<number, number>>({});

  // Product replacement state
  const [changingProductRow, setChangingProductRow] = useState<ComparisonRow | null>(null);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [categoryProducts, setCategoryProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetchComparison(baselineId, targetId);
  }, []);

  const fetchComparison = async (bId: number | null, tId: number | null) => {
    setLoading(true);
    try {
      let query = '';
      const params = new URLSearchParams();
      if (bId) params.append('baselineId', bId.toString());
      if (tId) params.append('targetId', tId.toString());
      if (params.toString()) query = `?${params.toString()}`;

      const res = await fetch(`${API_BASE_URL}/offers/comparison${query}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      if (res.ok) {
        const payload = await res.json();
        const data = payload?.data || {};
        
        const camps: CampaignOption[] = data.allCampaigns || [];
        setAllCampaigns(camps);

        let finalBId = data.baselineId;
        let finalTId = data.targetId;

        if (camps.length > 1 && finalBId === finalTId) {
          finalTId = camps[0].id;
          finalBId = camps[1].id;
        }

        setBaselineId(finalBId);
        setTargetId(finalTId);
        setBaselineTitle(data.baselineTitle || 'OFERTA VIGENTE');
        setTargetTitle(data.targetTitle || 'OFERTA NUEVA');
        setGroupsData(data.comparisonByGroup || {});
      }
    } catch (error) {
      console.error('Error fetching side-by-side comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBaselineChange = (idStr: string) => {
    const newId = idStr ? Number(idStr) : null;
    setBaselineId(newId);
    fetchComparison(newId, targetId);
  };

  const handleTargetChange = (idStr: string) => {
    const newId = idStr ? Number(idStr) : null;
    setTargetId(newId);
    fetchComparison(baselineId, newId);
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
  };

  const filterRows = (rows: ComparisonRow[]) => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r => 
      r.productName.toLowerCase().includes(term) || 
      r.sku.toLowerCase().includes(term)
    );
  };

  const openReplacementModal = async (row: ComparisonRow) => {
    setChangingProductRow(row);
    setLoadingProducts(true);
    try {
      const data = await api.getProducts(row.group);
      setCategoryProducts(data || []);
    } catch (err) {
      console.error('Error loading products for replacement:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleReplaceProduct = (newProd: any) => {
    if (!changingProductRow) return;
    
    // Substitute product in groupsData
    const grp = changingProductRow.group;
    setGroupsData(prev => {
      const copy = { ...prev };
      if (copy[grp]) {
        copy[grp] = copy[grp].map(r => {
          if (r.productId === changingProductRow.productId) {
            return {
              ...r,
              productId: newProd.id,
              productName: newProd.name,
              sku: newProd.sku,
              targetPrice: newProd.listPrice,
              reason: `Reemplazado manualmente por el usuario (${newProd.name})`
            };
          }
          return r;
        });
      }
      return copy;
    });

    setChangingProductRow(null);
    setActiveVerModal(null);
  };

  return (
    <div className="fade-in" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit' }}>
      
      {/* Navigation Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button 
              onClick={onBack}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
            >
              <ArrowLeft size={16} /> Volver
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowRightLeft size={22} style={{ color: '#8b5cf6' }} /> Comparador Side-by-Side de Ofertas Semanales
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Vista limpia pareada estilo Excel para comparar y evaluar sugerencias paramétricas.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => fetchComparison(baselineId, targetId)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
          <button 
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Campaign Selectors Toolbar */}
      <div className="card" style={{ padding: '14px 20px', borderRadius: '12px', marginBottom: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
            ⏮️ VIGENCIA DE LA OFERTA ANTERIOR (INTOCADA)
          </label>
          <select
            value={baselineId || ''}
            onChange={(e) => handleBaselineChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            {allCampaigns.map(c => (
              <option key={c.id} value={c.id}>
                {c.title} ({new Date(c.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#8b5cf6', textTransform: 'uppercase', marginBottom: '4px' }}>
            ✨ VIGENCIA DE LA NUEVA OFERTA SUGERIDA
          </label>
          <select
            value={targetId || ''}
            onChange={(e) => handleTargetChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.05)',
              color: 'var(--text-primary)',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            {allCampaigns.map(c => (
              <option key={c.id} value={c.id}>
                {c.title} ({new Date(c.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ marginBottom: '16px', maxWidth: '400px', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por producto o SKU..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '13px'
          }}
        />
      </div>

      {/* Main Excel-Style Dual-Pane Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <RefreshCw className="animate-spin" size={32} style={{ marginBottom: '12px', color: '#8b5cf6', margin: '0 auto 12px auto' }} />
          <div>Cargando planilla pareada estilo Excel...</div>
        </div>
      ) : Object.keys(groupsData).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)' }}>
          No hay productos o campañas disponibles para comparar.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          
          {/* Main Top Header Row (Excel Title Style) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#334155', color: 'white', borderBottom: '2px solid #0f172a' }}>
            <div style={{ padding: '12px 18px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>VIGENCIA: {baselineTitle}</span>
              <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'normal' }}>Oferta Anterior (Intocada)</span>
            </div>
            <div style={{ padding: '12px 18px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: '#1e1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>VIGENCIA: {targetTitle}</span>
              <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'normal' }}>Nueva Oferta Sugerida</span>
            </div>
          </div>

          {/* Groups (MELINCUE, CREMIGAL, R.P.B, BEBIDAS, ALMACEN, etc.) */}
          {Object.entries(groupsData).map(([groupName, rows]) => {
            const filteredRows = filterRows(rows);
            if (filteredRows.length === 0) return null;

            // Divide baseline items and target items cleanly
            const baselineRows = filteredRows.filter(r => r.baselinePrice !== null);
            const targetRows = filteredRows.filter(r => r.targetPrice !== null);
            const maxRows = Math.max(baselineRows.length, targetRows.length);

            return (
              <div key={groupName} style={{ borderBottom: '1px solid var(--border-color)' }}>
                
                {/* Category Subheader Banner Row (Excel Grey Banner Style) */}
                <div style={{ 
                  backgroundColor: 'var(--bg-secondary, #cbd5e1)', 
                  padding: '8px 18px', 
                  fontWeight: 'bold', 
                  fontSize: '13px', 
                  color: '#0f172a', 
                  borderBottom: '1px solid var(--border-color)',
                  borderTop: '1px solid var(--border-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{groupName}</span>
                  <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#475569' }}>
                    {baselineRows.length} oferta anterior / {targetRows.length} sugeridos nuevos
                  </span>
                </div>

                {/* Paired Rows inside Category */}
                {Array.from({ length: maxRows }).map((_, idx) => {
                  const bRow = baselineRows[idx];
                  const tRow = targetRows[idx];
                  const currentPrice = tRow ? (editedPrices[tRow.productId] !== undefined ? editedPrices[tRow.productId] : tRow.targetPrice) : null;

                  return (
                    <div 
                      key={`${groupName}-row-${idx}`}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        borderBottom: idx === maxRows - 1 ? 'none' : '1px solid var(--border-color)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.015)'
                      }}
                    >
                      {/* Left Column Cell: Previous Offer Product (Clean & Untouched) */}
                      <div style={{ 
                        padding: '9px 18px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        borderRight: '1px solid var(--border-color)'
                      }}>
                        {bRow ? (
                          <>
                            <div style={{ flex: 1, paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {bRow.productName}
                              </span>
                              {renderTypeBadge(bRow.productName, groupName)}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                              {formatCurrency(bRow.baselinePrice)}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                        )}
                      </div>

                      {/* Right Column Cell: New Proposed Offer Product */}
                      <div style={{ 
                        padding: '9px 18px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        backgroundColor: tRow ? 'rgba(139, 92, 246, 0.02)' : 'transparent'
                      }}>
                        {tRow ? (
                          <>
                            <div style={{ flex: 1, paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {tRow.productName}
                              </span>
                              {renderTypeBadge(tRow.productName, groupName)}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                                {formatCurrency(currentPrice)}
                              </span>

                              {/* (VER) Button */}
                              <button
                                onClick={() => setActiveVerModal(tRow)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3b82f6',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: '2px 4px'
                                }}
                              >
                                (VER)
                              </button>
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>

                    </div>
                  );
                })}

              </div>
            );
          })}

        </div>
      )}

      {/* (VER) Popover Modal / Inspection & Product Change Drawer */}
      {activeVerModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b5cf6', textTransform: 'uppercase' }}>
                  Detalle Paramétrico & Edición
                </span>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                  {activeVerModal.productName}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SKU: {activeVerModal.sku} | Rubro: {activeVerModal.group}</span>
              </div>
              <button onClick={() => setActiveVerModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Motivo Paramétrico */}
            <div style={{ padding: '12px 14px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} /> MOTIVO DE ELECCIÓN EN EL ARCHIVO MAESTRO:
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                {getConciseReason(activeVerModal.productName, activeVerModal.group, activeVerModal.reason)}
              </div>
            </div>

            {/* Price Edit Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Precio de Oferta ($)
              </label>
              <input
                type="number"
                value={editedPrices[activeVerModal.productId] !== undefined ? editedPrices[activeVerModal.productId] : (activeVerModal.targetPrice || 0)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setEditedPrices(prev => ({ ...prev, [activeVerModal.productId]: isNaN(val) ? 0 : val }));
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Replace Product Option */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => openReplacementModal(activeVerModal)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Replace size={16} /> Cambiar por Otro Producto
              </button>

              <button
                onClick={() => setActiveVerModal(null)}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Replacement Drawer Modal */}
      {changingProductRow && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Sustituir {changingProductRow.productName}
              </h3>
              <button onClick={() => setChangingProductRow(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={replacementSearch}
                onChange={(e) => setReplacementSearch(e.target.value)}
                placeholder="Buscar reemplazo en el rubro..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loadingProducts ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>Cargando catálogo...</div>
              ) : categoryProducts.filter(p => p.name.toLowerCase().includes(replacementSearch.toLowerCase())).map(p => (
                <div
                  key={p.id}
                  onClick={() => handleReplaceProduct(p)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-card)'
                  }}
                  className="hover:bg-gray-50"
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SKU: {p.sku} | Stock: {p.stock} un.</div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#8b5cf6' }}>
                    ${p.listPrice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
