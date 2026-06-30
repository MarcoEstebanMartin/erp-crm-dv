const fs = require('fs');
const file = 'frontend/src/utils/api.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "const active = drawers.find((d: any) => d.status === 'OPEN'); // Changed to return any open drawer for now\n      if (active) {\n        throw new Error(`Ya tenés una caja operativa abierta. Debés cerrarla antes de abrir una nueva.`);\n      }\n\n      const drawerBranch = branch || 'CONSOLIDADA';",
  "const drawerBranch = branch || 'CONSOLIDADA';\n      const active = drawers.find((d: any) => d.status === 'OPEN' && d.branch === drawerBranch);\n      if (active) {\n        throw new Error(`La caja ${drawerBranch} ya se encuentra abierta.`);\n      }"
);

fs.writeFileSync(file, c);
console.log('Fixed openDrawer API check');
