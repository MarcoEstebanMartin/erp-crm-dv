import re

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Asegurar import de ExcelSpatialMapModal al principio
if 'import ExcelSpatialMapModal' not in content:
    content = content.replace(
        "import { useState, useEffect, useCallback } from 'react';",
        "import { useState, useEffect, useCallback } from 'react';\nimport ExcelSpatialMapModal from './ExcelSpatialMapModal';"
    )

# 2. Asegurar estado isMapModalOpen
if 'const [isMapModalOpen, setIsMapModalOpen] = useState(false);' not in content:
    content = content.replace(
        "const [selectedWarehouse, setSelectedWarehouse] = useState<string>('D1');",
        "const [selectedWarehouse, setSelectedWarehouse] = useState<string>('D1');\n  const [isMapModalOpen, setIsMapModalOpen] = useState(false);"
    )

# 3. Corregir tipos y fetchData en ExcelSpatialMapModal JSX
modal_jsx_clean = '''      {/* Modal / Ventana Ampliada del Plano Gráfico 95-100% Fiel a mapa deposito.xlsx */}
      <ExcelSpatialMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        allProducts={allProducts}
        onAssignStock={async (slotCode: string, productId: number, lotNumber: string, expDate: string, qty: number) => {
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
            fetchData();
          } catch (err) {
            console.error('Error al asignar stock desde el plano:', err);
          }
        }}
      />
    </div>
  );
}'''

content = re.sub(
    r'<ExcelSpatialMapModal.*?</div\s*>\s*</\s*div\s*>\s*;\s*\}',
    modal_jsx_clean,
    content,
    flags=re.DOTALL
)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("EXITO: DepositoDashboard.tsx corregido.")
