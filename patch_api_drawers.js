const fs = require('fs');

const file = 'frontend/src/utils/api.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "const active = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN');",
  "const active = drawers.find((d: any) => d.status === 'OPEN'); // Changed to return any open drawer for now"
);

c = c.replace(
  "return drawers.filter((d: any) => d.userId === user.id && d.status === 'OPEN');",
  "return drawers.filter((d: any) => d.status === 'OPEN');"
);

fs.writeFileSync(file, c);
console.log('Fixed API for global drawers');
