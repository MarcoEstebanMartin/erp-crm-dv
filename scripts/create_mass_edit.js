const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/components/ProductsList.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add filteredProducts computation before return (
const returnStartStr = `  return (`;
const filteredStr = `  const filteredProducts = products
    .filter((p: any) => !selectedRubro || extractLabel(p.rubro) === selectedRubro)
    .filter((p: any) => !selectedSubrubro || extractLabel(p.description) === selectedSubrubro);

  return (`
content = content.replace(returnStartStr, filteredStr);

// 2. Add button
const buttonOld = `        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setProductModal({ open: true, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, minStock: 0 } })}>
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        </div>`;

const buttonNew = `        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={async () => {
              const val = window.prompt("Ingrese el % de rentabilidad a aplicar a TODOS los productos filtrados en pantalla (ej: 25):", "25");
              if (!val) return;
              const parsed = parseFloat(val);
              if (isNaN(parsed) || parsed < 0) return alert("Por favor, ingrese un número válido mayor a 0.");
              if (!window.confirm(\`¿Seguro que desea aplicar un \${parsed}% de rentabilidad a los \${filteredProducts.length} productos mostrados?\`)) return;
              
              let count = 0;
              for (const p of filteredProducts) {
                const costo = Number(p.costPrice) || 0;
                if (costo > 0) {
                  const factor = 1 + (parsed / 100);
                  const precioFinal = costo * factor;
                  const newListPrice = precioFinal / 1.21;
                  await onUpdateProduct({ ...p, listPrice: newListPrice });
                  count++;
                }
              }
              alert(\`Se actualizaron \${count} productos con éxito.\`);
            }}
          >
            <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>%</span>
            <span>Rentabilidad Masiva</span>
          </button>

          <button className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setProductModal({ open: true, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, minStock: 0 } })}>
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        </div>`;
content = content.replace(buttonOld, buttonNew);

fs.writeFileSync(file, content);
console.log("Done adding mass edit");
