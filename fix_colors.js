const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/components/BillingDashboard.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace Sucursal A button
const sucursalAOld = `<button
                        type="button"
                        className={\`btn \${directInvoiceForm.billingType === 'OFFICIAL' ? 'btn-primary' : 'btn-secondary'}\`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'OFFICIAL' }))}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
                      >
                        Sucursal A (Oficial)
                      </button>`;
const sucursalANew = `<button
                        type="button"
                        className={\`btn \${directInvoiceForm.billingType === 'OFFICIAL' ? 'btn-primary' : 'btn-secondary'}\`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'OFFICIAL' }))}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.8rem', 
                          padding: '10px',
                          backgroundColor: directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : undefined,
                          borderColor: directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : undefined
                        }}
                      >
                        Sucursal A (Oficial)
                      </button>`;
content = content.replace(sucursalAOld, sucursalANew);

// Replace Total Facturado span
const totalOld = `<span style={{ color: 'var(--accent-color)' }}>\${directBillingTotals.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>`;
const totalNew = `<span style={{ color: directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : 'var(--accent-color)' }}>\${directBillingTotals.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>`;
content = content.replace(totalOld, totalNew);

// Replace Emitir Factura button
const btnOld = `                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '12px',
                            fontWeight: 600,
                            cursor: (isDrawerInvalid || directCart.length === 0) ? 'not-allowed' : 'pointer',
                            backgroundColor: (isDrawerInvalid || directCart.length === 0) ? '#a1a1a6' : 'var(--accent-color)',
                            borderColor: (isDrawerInvalid || directCart.length === 0) ? '#a1a1a6' : 'var(--accent-color)'
                          }}
                          disabled={loading || isDrawerInvalid || directCart.length === 0}
                        >`;
const btnNew = `                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '12px',
                            fontWeight: 600,
                            cursor: (isDrawerInvalid || directCart.length === 0) ? 'not-allowed' : 'pointer',
                            backgroundColor: (isDrawerInvalid || directCart.length === 0) ? '#a1a1a6' : (directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : 'var(--accent-color)'),
                            borderColor: (isDrawerInvalid || directCart.length === 0) ? '#a1a1a6' : (directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : 'var(--accent-color)')
                          }}
                          disabled={loading || isDrawerInvalid || directCart.length === 0}
                        >`;
content = content.replace(btnOld, btnNew);

fs.writeFileSync(file, content);
console.log("Done");
