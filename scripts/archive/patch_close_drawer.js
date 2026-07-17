const fs = require('fs');
const f = 'backend/src/controllers/finance.controller.ts';
let c = fs.readFileSync(f, 'utf8');

const target = `    if (drawer.status === 'CLOSED') {
      res.status(400).json({ status: 'error', message: 'Esta caja ya se encuentra cerrada.' });
      return;
    }`;

const insert = `
    const { receipts } = req.body;
    
    // Procesar recibos entrantes (cobranzas) para sumarlos a la caja ANTES del arqueo
    if (receipts && Array.isArray(receipts)) {
      for (const r of receipts) {
        await prisma.transaction.create({
          data: {
            personaId: Number(r.clientId),
            userId,
            billingType: r.billingType || 'INTERNAL',
            type: 'INCOME',
            paymentMethod: r.paymentMethod || 'CASH',
            amount: Number(r.amount),
            description: 'Recibo/Cobranza - Arqueo de Caja',
            cashDrawerId: drawer.id
          }
        });
      }
    }
`;

if (!c.includes("const { receipts } = req.body;")) {
  c = c.replace(target, target + insert);
  fs.writeFileSync(f, c);
  console.log("Patched closeDrawer to handle receipts.");
}
