import json
import re

with open('scripts/depositomapa_layout.json', 'r', encoding='utf-8') as f:
    layout_data = json.load(f)

with open('scripts/depositomapa_slots.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

# Actualizar DepositoDashboard.tsx con filtrado por Cámaras y ajuste responsivo 100% sin cortes
dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Clasificar cada slot por su cámara física en Depósito 1
slots_with_chambers = []
for slot in slots_data['all_slots']:
    r = slot['row']
    c = slot['col']
    dep = slot['dep_id']
    chamber = 'GENERAL'

    if dep == 'D1':
        if r <= 4 and c >= 8 and c <= 15:
            chamber = 'CAMARA_2'
        elif r >= 4 and r <= 7 and c >= 7 and c <= 18:
            if c >= 13 and c <= 18 and r >= 5:
                chamber = 'CAMARA_3'
            else:
                chamber = 'CAMARA_1'
        elif r >= 5 and r <= 7 and c <= 6:
            chamber = 'RACK_ENTRADA'

    slot['chamber'] = chamber
    slots_with_chambers.append(slot)

with open('scripts/depositomapa_slots_chambers.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': slots_with_chambers}, f, indent=2, ensure_ascii=False)

wms_chamber_view = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {/* Header Principal Responsivo */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico 2D de Depósito (WMS Fiel a Excel)</h4>
                <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>210 Slots Limpios</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Hacé clic en los botones de Cámaras para resaltar sus slots y gestionar su contenido.
              </p>
            </div>

            {/* Selector de Depósitos y Pantalla Completa */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('ALL'); setSelectedSector('ALL'); }}
              >
                🌐 Planta Completa
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D1'); setSelectedSector('ALL'); }}
              >
                🏢 Depósito 1
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D2'); setSelectedSector('ALL'); }}
              >
                🏢 Depósito 2
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D3'); setSelectedSector('ALL'); }}
              >
                🔄 Depósito 3
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsMapModalOpen(true)}
              >
                🖥️ Ampliar Pantalla Completa
              </button>
            </div>
          </div>

          {/* Botones Interactivos para Seleccionar Cámaras / Sectores Físicos */}
          <div style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '8px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '4px' }}>Seleccionar Cámara / Sector:</span>
            
            <button
              type="button"
              className={`btn btn-sm ${selectedSector === 'CAMARA_2' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ backgroundColor: selectedSector === 'CAMARA_2' ? '#0284c7' : '#e0f2fe', color: selectedSector === 'CAMARA_2' ? '#fff' : '#0369a1', border: '1.5px solid #0284c7', fontWeight: 600, fontSize: '0.78rem' }}
              onClick={() => { setSelectedSector(selectedSector === 'CAMARA_2' ? 'ALL' : 'CAMARA_2'); setSelectedWarehouse('D1'); }}
            >
              ❄️ Cámara 2 Frío (Quesos)
            </button>

            <button
              type="button"
              className={`btn btn-sm ${selectedSector === 'CAMARA_1' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ backgroundColor: selectedSector === 'CAMARA_1' ? '#0891b2' : '#ecfeff', color: selectedSector === 'CAMARA_1' ? '#fff' : '#0e7490', border: '1.5px solid #0891b2', fontWeight: 600, fontSize: '0.78rem' }}
              onClick={() => { setSelectedSector(selectedSector === 'CAMARA_1' ? 'ALL' : 'CAMARA_1'); setSelectedWarehouse('D1'); }}
            >
              ❄️ Cámara 1 Frío (Lácteos)
            </button>

            <button
              type="button"
              className={`btn btn-sm ${selectedSector === 'CAMARA_3' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ backgroundColor: selectedSector === 'CAMARA_3' ? '#7e22ce' : '#f3e8ff', color: selectedSector === 'CAMARA_3' ? '#fff' : '#6b21a8', border: '1.5px solid #7e22ce', fontWeight: 600, fontSize: '0.78rem' }}
              onClick={() => { setSelectedSector(selectedSector === 'CAMARA_3' ? 'ALL' : 'CAMARA_3'); setSelectedWarehouse('D1'); }}
            >
              📦 Cámara 3 Seco (Conservas)
            </button>

            <button
              type="button"
              className={`btn btn-sm ${selectedSector === 'ALL' ? 'btn-secondary' : 'btn-outline'}`}
              style={{ fontSize: '0.75rem', marginLeft: 'auto' }}
              onClick={() => setSelectedSector('ALL')}
            >
              🔄 Limpiar Selección
            </button>
          </div>

          {/* Vista Principal Ajustada 100% Responsiva Sin Cortar */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
            
            {/* Contenedor del Mapa con Ajuste Responsivo Fluido */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', overflowX: 'auto', maxWidth: '100%' }}>
              <div style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '1.5px', width: '100%', tableLayout: 'fixed', fontSize: '0.65rem', fontFamily: 'sans-serif' }}>
                  <tbody>
                    {(() => {
                      const allRows = ''' + json.dumps(layout_data['matrix'], ensure_ascii=False) + ''';
                      let filteredRows = allRows;

                      if (selectedWarehouse === 'D1') {
                        filteredRows = allRows.slice(0, 10);
                      } else if (selectedWarehouse === 'D2') {
                        filteredRows = allRows.slice(10, 24);
                      } else if (selectedWarehouse === 'D3') {
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
                              bg = '#fce7f3'; color = '#881337'; border = '1.5px solid #f43f5e';
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
                              foundSlotObj = ''' + json.dumps(slots_with_chambers, ensure_ascii=False) + '''.find((s: any) => s.row === cell.r && s.col === cell.c);
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

                            const isChamberSelected = selectedSector !== 'ALL' && foundSlotObj && foundSlotObj.chamber === selectedSector;
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
                                  border: isSelected 
                                    ? '2.5px solid #007AFF' 
                                    : isChamberSelected 
                                    ? '2.5px solid #0284c7' 
                                    : hasStock 
                                    ? '2px solid #22c55e' 
                                    : border,
                                  backgroundColor: isSelected 
                                    ? '#e0f2fe' 
                                    : isChamberSelected 
                                    ? '#bae6fd' 
                                    : hasStock 
                                    ? '#dcfce7' 
                                    : bg,
                                  color: isSelected ? '#007AFF' : isChamberSelected ? '#0369a1' : hasStock ? '#15803d' : color,
                                  fontWeight: isSlot || cellText.length > 2 ? 'bold' : 'normal',
                                  padding: '2px 3px',
                                  textAlign: 'center',
                                  height: '28px',
                                  cursor: isSlot ? 'pointer' : 'default',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  borderRadius: isSlot ? '3px' : '1px'
                                }}
                                title={isSlot && foundSlotObj ? `${foundSlotObj.code} (${foundSlotObj.deposito})` : cellText}
                              >
                                {isSlot ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                    <span>{cellText}</span>
                                    {hasStock && <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>🟢</span>}
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

            {/* Panel Lateral de Inspección del Sector / Cámara Seleccionada */}
            <div style={{ width: '350px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                📍 Detalle de Selección
              </h4>

              {selectedSector !== 'ALL' && !selectedSlot && (
                <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #7dd3fc', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0369a1', marginBottom: '4px' }}>
                    {selectedSector === 'CAMARA_2' && '❄️ Cámara 2 Frío Seleccionada'}
                    {selectedSector === 'CAMARA_1' && '❄️ Cámara 1 Frío Seleccionada'}
                    {selectedSector === 'CAMARA_3' && '📦 Cámara 3 Seco Seleccionada'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#0284c7' }}>
                    Todos los slots pertenecientes a esta cámara están resaltados en el plano. Hacé clic en cualquier recuadro para ver o asignar mercadería.
                  </div>
                </div>
              )}

              {selectedSlot ? (
                <div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
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
                        <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '6px' }}>⚪</div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Slot Vacío (Disponible)</div>
                          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                            Posición sin productos asignados.
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '12px', fontSize: '0.82rem', padding: '8px 12px', fontWeight: 600 }}
                            onClick={() => setIsMapModalOpen(true)}
                          >
                            ➕ Cargar Mercadería en este Slot
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MERCADERÍA ASIGNADA</span>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                        </div>

                        {matchingProducts.map(({ product, lot }, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', backgroundColor: '#fafafa' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
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
                          style={{ width: '100%', marginTop: '4px', fontSize: '0.78rem', padding: '6px 12px' }}
                          onClick={() => setIsMapModalOpen(true)}
                        >
                          ✏️ Modificar / Cargar Más Stock
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ padding: '35px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Seleccioná una cámara o slot</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Tocá los botones de cámaras o cualquier celda A, A-B para inspeccionar.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}'''

pattern = r'\{subTab === \'wms-map\' && !selectedOrder && !showConsolidatedView && \(.*?\n      \)\}'
updated_content = re.sub(pattern, wms_chamber_view, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("EXITO: UI responsiva sin cortes y selección interactiva por cámaras instalada en DepositoDashboard.tsx.")
