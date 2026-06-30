const fs = require('fs');
const f = 'frontend/src/utils/api.ts';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "closeDrawer: async (drawerId: number, realBalance: number) => {",
  "closeDrawer: async (drawerId: number, realBalance: number, receipts?: any[], checks?: any[]) => {"
);

const targetMock = `      const closingBalance = Number(drawer.openingBalance) + cashIncome - cashOutcome;`;
const insertMock = `
      // Simular recibos
      if (receipts && receipts.length > 0) {
        receipts.forEach((r: any) => {
          trans.push({
            id: trans.length > 0 ? trans[trans.length - 1].id + 1 : 1,
            personaId: Number(r.clientId),
            userId: user.id,
            billingType: r.billingType || 'INTERNAL',
            type: 'INCOME',
            paymentMethod: r.paymentMethod || 'CASH',
            amount: Number(r.amount),
            description: 'Recibo/Cobranza - Arqueo de Caja',
            cashDrawerId: drawer.id,
            createdAt: new Date().toISOString(),
            verified: false
          });
          cashIncome += Number(r.amount);
        });
        mockDb.set('db_transactions', trans);
      }

      const closingBalance = Number(drawer.openingBalance) + cashIncome - cashOutcome;`;

if (!c.includes("// Simular recibos")) {
  c = c.replace(targetMock, insertMock);
}

c = c.replace(
  "body: JSON.stringify({ drawerId, realBalance })",
  "body: JSON.stringify({ drawerId, realBalance, receipts, checks })"
);

fs.writeFileSync(f, c);
console.log("Patched api.ts closeDrawer");
