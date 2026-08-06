import json
import re

with open('scripts/exact_slots_intuitive.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

# Generar el componente React TSX sin carteles ni banners explicativos, con nombres de ubicaciones claros e intuitivos
ui_code = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Minimalista sin Carteles */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>📍 Plano y Posiciones de Depósito (WMS)</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                209 Slots Físicos Exactos ordenados por Sector, Nave y Nivel.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('ALL')}
              >
                🌐 Planta Completa (209)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D1')}
              >
                🏢 Depósito 1 (44)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D2')}
              >
                🏢 Depósito 2 (123)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D3')}
              >
                🔄 Depósito 3 (42)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {/* Grilla Minimalista de Celdas con Sectores Claros */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', overflowX: 'auto' }}>
              
              <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Referencia de Alturas:</span>
                <span style={{ color: '#334155', fontWeight: 600 }}>A = 1 Nivel (Piso)</span>
                <span style={{ color: '#b45309', fontWeight: 600 }}>A-B = 2 Niveles</span>
                <span style={{ color: '#1d4ed8', fontWeight: 600 }}>A-B-C = 3 Niveles</span>
                <span style={{ color: '#15803d', fontWeight: 600 }}>A-B-C-D-E-F = 6 Niveles</span>
              </div>

              {/* Matriz Visual con Identificación Física Transparente */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '10px', maxHeight: '540px', overflowY: 'auto', paddingRight: '6px' }}>
                {(() => {
                  const filteredSlots = selectedWarehouse === 'ALL' 
                    ? ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + ''' 
                    : ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + '''.filter((s: any) => s.dep_id === selectedWarehouse);

                  return filteredSlots.map((slot: any) => {
                    const active = selectedMapLocation === slot.code;
                    
                    let assignedProduct: any = null;
                    let assignedLot: any = null;
                    allProducts.forEach(p => {
                      if (p.lots && p.lots.length > 0) {
                        p.lots.forEach((l: any) => {
                          if (l.location === slot.code && l.stock > 0) {
                            assignedProduct = p;
                            assignedLot = l;
                          }
                        });
                      } else if (p.defaultLocation === slot.code && p.stock > 0) {
                        assignedProduct = p;
                        assignedLot = { lotNumber: 'S/L', stock: p.stock };
                      }
                    });

                    const isOccupied = !!assignedProduct;

                    return (
                      <div
                        key={slot.code}
                        onClick={() => setSelectedMapLocation(active ? '' : slot.code)}
                        style={{
                          border: active ? '2px solid var(--color-primary)' : isOccupied ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '10px',
                          backgroundColor: active ? 'var(--bg-secondary)' : isOccupied ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: active ? '0 0 0 3px rgba(0, 122, 255, 0.15)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '85px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: active ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                              {slot.code}
                            </span>
                            <span style={{ 
                              fontSize: '0.62rem', 
                              fontWeight: 700, 
                              padding: '1px 5px', 
                              borderRadius: '3px',
                              backgroundColor: slot.nivel === 'A-B-C-D-E-F' ? '#dcfce7' : slot.nivel === 'A-B-C' ? '#dbeafe' : slot.nivel === 'A-B' ? '#fef3c7' : '#f1f5f9',
                              color: slot.nivel === 'A-B-C-D-E-F' ? '#15803d' : slot.nivel === 'A-B-C' ? '#1d4ed8' : slot.nivel === 'A-B' ? '#b45309' : '#475569'
                            }}>
                              {slot.nivel}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#3b82f6', marginBottom: '2px' }}>
                            📍 {slot.sector}
                          </div>

                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                            {slot.deposito} (Fila {slot.row}, Col {slot.col})
                          </div>
                        </div>

                        <div style={{ marginTop: '6px', fontSize: '0.72rem' }}>
                          {isOccupied ? (
                            <div style={{ color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span>🟢</span> [{assignedProduct.sku}] {assignedProduct.name}
                            </div>
                          ) : (
                            <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              ⚪ Vacío (Disponible)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Panel Lateral de Ficha de Ubicación */}
            <div style={{ width: '320px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                📍 Detalle de Ubicación Físico
              </h4>

              {selectedMapLocation ? (
                <div>
                  {(() => {
                    const currentSlot = ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + '''.find((s: any) => s.code === selectedMapLocation);
                    return (
                      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {selectedMapLocation}
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2563eb', marginBottom: '2px' }}>
                          📍 Sector: {currentSlot?.sector || 'Almacén General'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {currentSlot?.deposito} — Fila {currentSlot?.row}, Columna {currentSlot?.col} del Excel. Nivel: <strong>{currentSlot?.nivel}</strong>.
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const matchingProducts: { product: any; lot: any }[] = [];
                    allProducts.forEach(p => {
                      if (p.lots && p.lots.length > 0) {
                        p.lots.forEach((l: any) => {
                          if (l.location === selectedMapLocation && l.stock > 0) {
                            matchingProducts.push({ product: p, lot: l });
                          }
                        });
                      } else if (p.defaultLocation === selectedMapLocation && p.stock > 0) {
                        matchingProducts.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
                      }
                    });

                    if (matchingProducts.length === 0) {
                      return (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>⚪</div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Slot Vacío (Disponible)</div>
                          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                            Posición sin productos asignados. Queda lista para cuando hagas el stock inicial.
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MERCADERÍA ASIGNADA</span>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                        </div>

                        {matchingProducts.map(({ product, lot }, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#fafafa' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                              [{product.sku}] {product.name}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <div>Lote: <strong style={{ color: 'var(--text-primary)' }}>{lot.lotNumber}</strong></div>
                              <div>Stock: <strong style={{ color: 'var(--color-primary)' }}>{lot.stock} un.</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Seleccioná una celda / slot</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Hacé clic en cualquiera de las tarjetas para ver su detalle de sector físico.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}'''

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'\{subTab === \'wms-map\' && !selectedOrder && !showConsolidatedView && \(.*?\n      \)\}'
updated_content = re.sub(pattern, ui_code, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("EXITO: UI sin carteles explicativos y con sectores intuitivos instalada en DepositoDashboard.tsx.")
