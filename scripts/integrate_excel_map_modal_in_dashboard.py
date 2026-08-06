import re

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Agregar el import de ExcelSpatialMapModal al principio del archivo
if 'import ExcelSpatialMapModal' not in content:
    content = content.replace(
        "import React, { useState, useEffect } from 'react';",
        "import React, { useState, useEffect } from 'react';\nimport ExcelSpatialMapModal from './ExcelSpatialMapModal';"
    )

# 2. Agregar el estado isMapModalOpen
if 'const [isMapModalOpen, setIsMapModalOpen] = useState(false);' not in content:
    content = content.replace(
        "const [selectedWarehouse, setSelectedWarehouse] = useState<'D1' | 'D2' | 'D3' | 'ALL'>('ALL');",
        "const [selectedWarehouse, setSelectedWarehouse] = useState<'D1' | 'D2' | 'D3' | 'ALL'>('ALL');\n  const [isMapModalOpen, setIsMapModalOpen] = useState(false);"
    )

# 3. Agregar el botón de apertura y el modal en el JSX de subTab === 'wms-map'
button_html = '''            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>📍 Plano y Posiciones de Depósito (WMS)</h4>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#007AFF' }}
                  onClick={() => setIsMapModalOpen(true)}
                >
                  🖥️ Abrir Plano Fiel (95-100%) Pantalla Completa
                </button>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                209 Slots Físicos Exactos ordenados por Sector, Nave y Nivel.
              </p>
            </div>'''

content = re.sub(
    r'<div>\s*<h4 style=\{\{ margin: 0, fontSize: \'1\.05rem\', fontWeight: 700, color: \'var\(--text-primary\)\' \}\}>📍 Plano y Posiciones de Depósito \(WMS\)</h4>.*?</div>',
    button_html,
    content,
    flags=re.DOTALL
)

# 4. Renderizar el componente ExcelSpatialMapModal al final del componente
modal_jsx = '''      {/* Modal / Ventana Ampliada del Plano Gráfico 95-100% Fiel a mapa deposito.xlsx */}
      <ExcelSpatialMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        allProducts={allProducts}
        onAssignStock={async (slotCode, productId, lotNumber, expDate, qty) => {
          try {
            const token = localStorage.getItem('token');
            await fetch('http://localhost:3001/api/products/' + productId + '/stock', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                quantityChange: qty,
                reason: 'Carga inicial desde Plano 2D WMS',
                lotNumber: lotNumber,
                expirationDate: expDate,
                location: slotCode
              })
            });
            fetchProducts();
          } catch (err) {
            console.error('Error al asignar stock desde el plano:', err);
          }
        }}
      />
    </div>
  );
}'''

if '<ExcelSpatialMapModal' not in content:
    content = content.replace('    </div>\n  );\n}', modal_jsx)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("EXITO: Modal ExcelSpatialMapModal integrado en DepositoDashboard.tsx.")
