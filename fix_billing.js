const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/BillingDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace '{ minimumFractionDigits: 0 }' with '{ minimumFractionDigits: 0, maximumFractionDigits: 0 }'
content = content.replace(/{ minimumFractionDigits: 0 }/g, "{ minimumFractionDigits: 0, maximumFractionDigits: 0 }");

// Fix the UI block for IVA:
const oldBlock = `<div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Neto Gravado:</span>
                            <span style={{ fontWeight: 600 }}>\${directBillingTotals.net.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>IVA Débito (21%):</span>
                            <span style={{ fontWeight: 600 }}>\${directBillingTotals.tax.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>`;

const newBlock = `{directInvoiceForm.billingType === 'OFFICIAL' && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Neto Gravado:</span>
                                <span style={{ fontWeight: 600 }}>\${directBillingTotals.net.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>IVA Débito (21%):</span>
                                <span style={{ fontWeight: 600 }}>\${directBillingTotals.tax.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              </div>
                            </>
                          )}`;

content = content.replace(oldBlock, newBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated BillingDashboard.tsx");
