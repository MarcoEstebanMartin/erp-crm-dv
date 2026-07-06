const fs = require('fs');
const path = require('path');

const dashboards = ['AdminDashboard.tsx'];
const dir = path.join(__dirname, 'frontend/src/components');

dashboards.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Add zipCodes import if not present
  if (!content.includes("import zipCodes from '../utils/zipCodes.json'")) {
    content = content.replace("import { api } from '../utils/api';", "import { api } from '../utils/api';\nimport zipCodes from '../utils/zipCodes.json';");
  }

  // 1. Update initial state
  if (file === 'AdminDashboard.tsx') {
    content = content.replace(
      /data:\s*\{\s*id:\s*0,\s*name:\s*'([^']*)',\s*cuit:\s*'([^']*)',\s*address:\s*'([^']*)',\s*city:\s*'([^']*)'/,
      "data: { id: 0, name: '$1', cuit: '$2', address: '$3', city: '$4', province: '', zipCode: ''"
    );
  } else {
    // Facturacion and Vendedor don't wrap data in data{} for create
    content = content.replace(
      /id:\s*0,\s*name:\s*'([^']*)',\s*cuit:\s*'([^']*)',\s*address:\s*'([^']*)',\s*city:\s*'([^']*)'/,
      "id: 0, name: '$1', cuit: '$2', address: '$3', city: '$4', province: '', zipCode: ''"
    );
  }

  // 2. Add "Buscar" button next to CUIT and remove the patched onBlur
  const handleFetchSnippetRegex = /onBlur=\{async\s*\([^)]*\)\s*=>\s*\{[^}]*setClientModal[^}]*\}[^}]*\}\}[^}]*\}\}/g;
  content = content.replace(handleFetchSnippetRegex, ""); // Remove the onBlur

  // We need to find the CUIT input block and replace it with an input + button row.
  const isDataWrapped = file === 'AdminDashboard.tsx';
  const dataPrefix = isDataWrapped ? 'clientModal.data' : 'clientModal';
  const stateUpdatePrefix = isDataWrapped ? 'data: { ...clientModal.data, ' : '';
  const stateUpdateSuffix = isDataWrapped ? ' }' : '';
  const prevPrefix = isDataWrapped ? 'prev.data' : 'prev';

  // Find CUIT block
  const cuitLabelRegex = /<label>CUIT \(Sin guiones\)<\/label>\s*<input\s*type="text"\s*className="input"\s*placeholder="[^"]*"\s*value=\{[^}]*cuit\}\s*onChange=\{[^}]*cuit:[^}]*\}\s*\/>/g;
  
  const cuitReplacement = `
    <label>CUIT (Sin guiones)</label>
    <div style={{ display: 'flex', gap: '10px' }}>
      <input
        type="text"
        className="input"
        placeholder="ej: 20222334449"
        value={${dataPrefix}.cuit}
        onChange={(e) => setClientModal({ ...clientModal, ${stateUpdatePrefix}cuit: e.target.value${stateUpdateSuffix} })}
        style={{ flex: 1 }}
      />
      <button 
        type="button" 
        className="btn btn-primary"
        onClick={async () => {
          const c = ${dataPrefix}.cuit;
          if (c && c.length >= 8) {
            try {
              const json = await api.getAfipData(c);
              if (json && json.status === 'success' && json.data) {
                setClientModal(prev => ({...prev, ${isDataWrapped ? 'data: {...prev.data,' : ''} name: json.data.name || ${prevPrefix}.name, address: json.data.address || ${prevPrefix}.address, city: json.data.location || ${prevPrefix}.city, province: json.data.province || ${prevPrefix}.province ${isDataWrapped ? '}' : ''}}));
              } else if (json && json.name) {
                setClientModal(prev => ({...prev, ${isDataWrapped ? 'data: {...prev.data,' : ''} name: json.name || ${prevPrefix}.name, address: json.address || ${prevPrefix}.address, city: json.location || ${prevPrefix}.city, province: json.province || ${prevPrefix}.province ${isDataWrapped ? '}' : ''}}));
              }
            } catch(err) { console.error('Error AFIP', err); }
          }
        }}
      >
        Buscar
      </button>
    </div>
  `;
  content = content.replace(cuitLabelRegex, cuitReplacement);

  // 3. Add ZipCode and Province inputs next to City
  // Find City block
  const cityBlockRegex = /<div className="form-group">\s*<label>(Localidad|Ciudad)<\/label>\s*<input\s*type="text"\s*className="input"\s*placeholder="[^"]*"\s*value=\{[^}]*city[^}]*\}\s*onChange=\{[^}]*city:[^}]*\}\s*\/>\s*<\/div>/g;

  const zipCodeStateRow = `
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div className="form-group">
        <label>Código Postal</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="input"
            placeholder="ej: 1629"
            value={${dataPrefix}.zipCode || ''}
            onChange={(e) => setClientModal({ ...clientModal, ${stateUpdatePrefix}zipCode: e.target.value${stateUpdateSuffix} })}
            style={{ flex: 1 }}
          />
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => {
              const code = ${dataPrefix}.zipCode;
              const found = zipCodes.filter(z => z.zipCode === code);
              if (found.length === 1) {
                setClientModal(prev => ({...prev, ${isDataWrapped ? 'data: {...prev.data,' : ''} city: found[0].city, province: found[0].province ${isDataWrapped ? '}' : ''}}));
              } else if (found.length > 1) {
                // In a real app we would show a modal, here we just pick the first for MVP to keep it simple, or user can edit.
                setClientModal(prev => ({...prev, ${isDataWrapped ? 'data: {...prev.data,' : ''} city: found[0].city, province: found[0].province ${isDataWrapped ? '}' : ''}}));
                alert('Múltiples localidades encontradas. Se autocompletó con: ' + found[0].city);
              } else {
                alert('Código postal no encontrado en la base de datos local.');
              }
            }}
          >
            Buscar
          </button>
        </div>
      </div>
      <div className="form-group">
        <label>Provincia</label>
        <input
          type="text"
          className="input"
          placeholder="ej: Buenos Aires"
          value={${dataPrefix}.province || ''}
          onChange={(e) => setClientModal({ ...clientModal, ${stateUpdatePrefix}province: e.target.value${stateUpdateSuffix} })}
        />
      </div>
    </div>
  `;

  content = content.replace(cityBlockRegex, `$&` + zipCodeStateRow);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched', file);
});
