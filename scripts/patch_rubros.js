const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/components/RubrosList.tsx');
let content = fs.readFileSync(file, 'utf8');

const oldHeader = `        {!isCreating && (
          <button className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setIsCreating(true)}>
            <Plus size={16} />
            <span>Nuevo Rubro</span>
          </button>
        )}`;

const newHeader = `        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={async () => {
              const val = window.prompt("Ingrese el % de rentabilidad a aplicar a TODOS los rubros (ej: 25):", "25");
              if (!val) return;
              const parsed = parseFloat(val);
              if (isNaN(parsed) || parsed < 0) return alert("Por favor, ingrese un número válido mayor a 0.");
              if (!window.confirm(\`¿Seguro que desea aplicar un \${parsed}% de rentabilidad a los \${rubros.length} rubros?\`)) return;
              
              setLoading(true);
              let count = 0;
              for (const r of rubros) {
                try {
                  const multiplier = 1 + (parsed / 100);
                  await api.updateRubro(r.id, { name: r.name, profitMargin: multiplier });
                  count++;
                } catch (e) {
                  console.error(e);
                }
              }
              setLoading(false);
              alert(\`Se actualizaron \${count} rubros con éxito.\`);
              fetchRubros();
              onRubroUpdated();
            }}
          >
            <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>%</span>
            <span>Rentabilidad Masiva</span>
          </button>

          {!isCreating && (
            <button className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setIsCreating(true)}>
              <Plus size={16} />
              <span>Nuevo Rubro</span>
            </button>
          )}
        </div>`;

content = content.replace(oldHeader, newHeader);
fs.writeFileSync(file, content);
console.log("Updated RubrosList.tsx");
