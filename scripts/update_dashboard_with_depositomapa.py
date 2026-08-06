import json
import re

with open('scripts/depositomapa_layout.json', 'r', encoding='utf-8') as f:
    layout_data = json.load(f)

with open('scripts/depositomapa_slots.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

primary_wms_view = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Principal Fiel a depositomapa.xlsx */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico 2D Fiel (Basado en depositomapa.xlsx)</h4>
                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '3px 10px' }}>210 Slots Limpios</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Layout libre de oficinas y cocina. Hacé clic en cualquier celda A, A-B o A-B-C para gestionar el stock e inventario.
              </p>
            </div>

            {/* Selector de Depósitos y Pantalla Completa */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('ALL')}
              >
                🌐 Planta Completa (210 Slots)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D1')}
              >
                🏢 Depósito 1
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D2')}
              >
                🏢 Depósito 2
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D3')}
              >
                🔄 Depósito 3
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setIsMapModalOpen(true)}
              >
                🖥️ Ampliar Pantalla Completa
              </button>
            </div>
          </div>

          {/* Leyenda de Delimitación de Cámaras */}
          <div style={{ padding: '8px 20px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '16px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Sectores Físicos:</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0f2fe', border: '1.5px solid #0284c7', color: '#0369a1', fontWeight: 600 }}>❄️ Cámara 2 Frío</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfeff', border: '1.5px solid #0891b2', color: '#0e7490', fontWeight: 600 }}>❄️ Cámara 1 Frío</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f3e8ff', border: '1.5px solid #7e22ce', color: '#6b21a8', fontWeight: 600 }}>📦 Cámara 3 Seco</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fce7f3', border: '1.5px solid #f43f5e', color: '#881337', fontWeight: 600 }}>🚾 Baño</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Mostrando: {selectedWarehouse === 'ALL' ? 'Todos los Depósitos' : (selectedWarehouse === 'D1' ? 'Depósito 1' : selectedWarehouse === 'D2' ? 'Depósito 2' : 'Depósito 3')}
            </span>
          </div>

          {/* Vista Principal Única del Plano Gráfico 2D + Ficha Lateral */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', overflowX: 'auto' }}>
              <div style={{
                display: 'inline-block',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
              }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '2px', fontSize: '0.68rem', fontFamily: 'sans-serif' }}>
                  <tbody>
                    {(() => {
                      const allRows = ''' + json.dumps(layout_data['matrix'], ensure_ascii=False) + ''';
                      let filteredRows = allRows;

                      if (selectedWarehouse === 'D1') {
                        // Depósito 1: Filas 1 a 10
                        filteredRows = allRows.slice(0, 10);
                      } else if (selectedWarehouse === 'D2') {
                        // Depósito 2: Filas 11 a 24
                        filteredRows = allRows.slice(10, 24);
                      } else if (selectedWarehouse === 'D3') {
                        // Depósito 3: Filas 24 a 34
                        filteredRows = allRows.slice(24, 34);
                      }

                      return filteredRows.map((row: any[], rIdx: number) => (
                        <tr key={rIdx}>
                          {row.map((cell: any, cIdx: number) => {
                            const isSlot = cell.is_storage;
                            const cellText = cell.val;
                            
                            let bg = '#ffffff';
                            let color = '#334155';
                            let border = '1px solid #e2e8f0';

                            if (cellText.includes('BAÑO')) {
                              bg = '#fce7f3'; color = '#881337'; border = '2px solid #f43f5e';
                            } else if (cellText.includes('CAMARA 2')) {
                              bg = '#e0f2fe'; color = '#0369a1'; border = '2px solid #0284c7';
                            } else if (cellText.includes('CAMARA 1')) {
                              bg = '#ecfeff'; color = '#0e7490'; border = '2px solid #0891b2';
                            } else if (cellText.includes('CAMARA 3')) {
                              bg = '#f3e8ff'; color = '#6b21a8'; border = '2px solid #7e22ce';
                            }

                            if (isSlot) {
                              if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                              else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                              else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                              else if (cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                            }

                            let hasStock = false;
                            let foundSlotObj: any = null;
                            if (isSlot) {
                              foundSlotObj = ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + '''.find((s: any) => s.row === cell.r && s.col === cell.c);
                              if (foundSlotObj) {
                                allProducts.forEach(p => {
                                  if (p.lots && p.lots.length > 0) {
                                    p.lots.forEach((l: any) => {
                                      if ((l.location === foundSlotObj.code || l.location.startsWith(foundSlotObj.code)) && l.stock > 0) hasStock = true;
                                    });
                                  } else if (p.defaultLocation === foundSlotObj.code && p.stock > 0) {
                                    hasStock = true;
                                  }
                                });
                              }
                            }

                            const isSelected = selectedSlot && foundSlotObj && selectedSlot.code === foundSlotObj.code;

                            return (
                              <td
                                key={cIdx}
                                onClick={() => {
                                  if (isSlot && foundSlotObj) {
                                    setSelectedSlot(foundSlotObj);
                                    setSelectedMapLocation(foundSlotObj.code);
                                  }
                                }}
                                style={{
                                  border: isSlot 
                                    ? (isSelected ? '2.5px solid #007AFF' : hasStock ? '2px solid #22c55e' : border) 
                                    : border,
                                  backgroundColor: isSelected ? '#e0f2fe' : hasStock ? '#dcfce7' : bg,
                                  color: isSelected ? '#007AFF' : hasStock ? '#15803d' : color,
                                  fontWeight: isSlot || cellText.length > 2 ? 'bold' : 'normal',
                                  padding: '4px 6px',
                                  textAlign: 'center',
                                  minWidth: isSlot ? '38px' : '26px',
                                  height: '30px',
                                  cursor: isSlot ? 'pointer' : 'default',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  borderRadius: isSlot ? '4px' : '2px'
                                }}
                                title={isSlot && foundSlotObj ? `${foundSlotObj.code} (${foundSlotObj.deposito})` : cellText}
                              >
                                {isSlot ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                    <span>{cellText}</span>
                                    {hasStock && <span style={{ color: '#22c55e', fontSize: '0.65rem' }}>🟢</span>}
                                  </div>
                                ) : (
                                  cellText
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Lateral de Inspección y Carga de Stock */}
            <div style={{ width: '380px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                📍 Detalle de Slot Seleccionado
              </h4>

              {selectedSlot ? (
                <div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {selectedSlot.code}
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px' }}>
                      📍 {selectedSlot.deposito}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Fila {selectedSlot.row}, Columna {selectedSlot.col} de depositomapa.xlsx. Nivel: <strong>{selectedSlot.nivel}</strong>.
                    </div>
                  </div>

                  {(() => {
                    const matchingProducts: { product: any; lot: any }[] = [];
                    allProducts.forEach(p => {
                      if (p.lots && p.lots.length > 0) {
                        p.lots.forEach((l: any) => {
                          if ((l.location === selectedSlot.code || l.location.startsWith(selectedSlot.code)) && l.stock > 0) {
                            matchingProducts.push({ product: p, lot: l });
                          }
                        });
                      } else if (p.defaultLocation === selectedSlot.code && p.stock > 0) {
                        matchingProducts.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
                      }
                    });

                    if (matchingProducts.length === 0) {
                      return (
                        <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>⚪</div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Slot Vacío (Disponible)</div>
                          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                            Posición sin productos asignados. Queda lista para la carga inicial.
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '14px', fontSize: '0.82rem', padding: '8px 14px', fontWeight: 600 }}
                            onClick={() => setIsMapModalOpen(true)}
                          >
                            ➕ Cargar Mercadería en este Slot
                          </button>
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

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ width: '100%', marginTop: '6px', fontSize: '0.8rem', padding: '7px 12px' }}
                          onClick={() => setIsMapModalOpen(true)}
                        >
                          ✏️ Modificar / Cargar Más Stock
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Seleccioná un recuadro A, A-B o A-B-C</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Hacé clic en cualquier celda del plano para ver su estado.</div>
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
updated_content = re.sub(pattern, primary_wms_view, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("EXITO: DepositoDashboard.tsx actualizado con la matriz depositomapa.xlsx.")
