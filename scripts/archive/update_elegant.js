const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/components/BillingDashboard.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace Sucursal A button
const sucursalAOld = `<button
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
const sucursalANew = `<button
                        type="button"
                        className={\`btn \${directInvoiceForm.billingType === 'OFFICIAL' ? 'btn-official' : 'btn-secondary'}\`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'OFFICIAL' }))}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
                      >
                        Sucursal A (Oficial)
                      </button>`;
content = content.replace(sucursalAOld, sucursalANew);

// Replace Sucursal X button
const sucursalXOld = `<button
                        type="button"
                        className={\`btn \${directInvoiceForm.billingType === 'INTERNAL' ? 'btn-primary' : 'btn-secondary'}\`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'INTERNAL' }))}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.8rem', 
                          padding: '10px',
                          backgroundColor: directInvoiceForm.billingType === 'INTERNAL' ? 'var(--accent-color)' : undefined,
                          borderColor: directInvoiceForm.billingType === 'INTERNAL' ? 'var(--accent-color)' : undefined
                        }}
                      >
                        Sucursal X (Interno)
                      </button>`;
const sucursalXNew = `<button
                        type="button"
                        className={\`btn \${directInvoiceForm.billingType === 'INTERNAL' ? 'btn-internal' : 'btn-secondary'}\`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'INTERNAL' }))}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
                      >
                        Sucursal X (Interno)
                      </button>`;
content = content.replace(sucursalXOld, sucursalXNew);

// Replace Total Facturado span
const totalOld = `<span style={{ color: directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : 'var(--accent-color)' }}>\${directBillingTotals.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>`;
const totalNew = `<span className={directInvoiceForm.billingType === 'OFFICIAL' ? 'text-official' : 'text-internal'} style={{ fontWeight: 800, fontSize: '1.2rem' }}>\${directBillingTotals.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>`;
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
                            backgroundColor: (isDrawerInvalid || directCart.length === 0) ? '#a1a1a6' : (directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : 'var(--accent-color)'),
                            borderColor: (isDrawerInvalid || directCart.length === 0) ? '#a1a1a6' : (directInvoiceForm.billingType === 'OFFICIAL' ? 'var(--color-info)' : 'var(--accent-color)')
                          }}
                          disabled={loading || isDrawerInvalid || directCart.length === 0}
                        >`;
const btnNew = `                        <button
                          type="submit"
                          className={\`btn \${directInvoiceForm.billingType === 'OFFICIAL' ? 'btn-official' : 'btn-internal'}\`}
                          style={{
                            width: '100%',
                            padding: '12px',
                            fontWeight: 600,
                            cursor: (isDrawerInvalid || directCart.length === 0) ? 'not-allowed' : 'pointer',
                            opacity: (isDrawerInvalid || directCart.length === 0) ? 0.5 : 1
                          }}
                          disabled={loading || isDrawerInvalid || directCart.length === 0}
                        >`;
content = content.replace(btnOld, btnNew);

fs.writeFileSync(file, content);
console.log("Updated BillingDashboard.tsx with elegant classes");
