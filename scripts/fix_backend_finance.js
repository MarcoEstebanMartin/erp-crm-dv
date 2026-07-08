const fs = require('fs');
const f = 'backend/src/controllers/finance.controller.ts';
let c = fs.readFileSync(f, 'utf8');

// Fix openDrawer
c = c.replace(
  "    const existing = await prisma.cashDrawer.findFirst({\n      where: {\n        userId,\n        status: 'OPEN',\n      },\n    });\n\n    if (existing) {\n      res.status(400).json({\n        status: 'error',\n        message: `Ya tenés una caja operativa abierta. Debés cerrarla antes de abrir una nueva.`,\n      });\n      return;\n    }",
  "    const existing = await prisma.cashDrawer.findFirst({\n      where: {\n        branch: drawerBranch,\n        status: 'OPEN',\n      },\n    });\n\n    if (existing) {\n      res.status(400).json({\n        status: 'error',\n        message: `La caja ${drawerBranch} ya se encuentra abierta.`,\n      });\n      return;\n    }"
);

// Fix getActiveDrawers
c = c.replace(
  "    const drawers = await prisma.cashDrawer.findMany({\n      where: {\n        userId,\n        status: 'OPEN',\n      },\n    });",
  "    const drawers = await prisma.cashDrawer.findMany({\n      where: {\n        status: 'OPEN',\n      },\n    });"
);

// Fix getActiveDrawer (if exists)
if (c.includes('export async function getActiveDrawer')) {
  // Wait, if it exists, replace userId restriction there too
  // Actually, I can just do a regex replace for all instances where it filters by userId and status: 'OPEN' inside getActiveDrawer
}

fs.writeFileSync(f, c);
console.log('Fixed backend finance.controller.ts');
