const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/utils/api.ts');
let content = fs.readFileSync(filePath, 'utf8');

const snippet = `
  getAfipData: async (cuit: string) => {
    if (simulationMode) {
      return {
        name: 'Empresa de Prueba S.A. (Local)',
        address: 'Calle Falsa 123',
        location: 'CABA',
        isClient: true
      };
    }
    const res = await request(\`/personas/afip/\${cuit}\`);
    return res;
  },
`;

// Insert after `getClients: async (search?: string) => { return api.getPersonas('client', search); },`
content = content.replace(
  /getClients: async \(search\?: string\) => \{\s+return api\.getPersonas\('client', search\);\s+\},/,
  `getClients: async (search?: string) => {\n    return api.getPersonas('client', search);\n  },\n${snippet}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added getAfipData to api.ts');
