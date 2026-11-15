import React, { useState } from 'react';
import { Banknote, ChevronLeft, Landmark, Loader2, ScrollText } from 'lucide-react';
import { formatIntegerARS } from '../../../utils/currency';
import type { MobileCobrosPersona } from './MobileCobrosClientList';

interface MobileCobrosFormViewProps {
  persona: MobileCobrosPersona;
  pendingInvoices: any[];
  selectedInvoiceId: number | null;
  isCreditOnAccount: boolean;
  amount: string;
  paymentMethod: string;
  checkNumber: string;
  isEcheq: boolean;
  billingType: string;
  loading: boolean;
  errorMsg: string | null;
  onBack: () => void;
  onSelectInvoice: (val: string) => void;
  onToggleCreditOnAccount: (checked: boolean) => void;
  onChangeAmount: (val: string) => void;
  onChangePaymentMethod: (method: string) => void;
  onChangeCheckNumber: (val: string) => void;
  onToggleEcheq: (checked: boolean) => void;
  onChangeBillingType: (bt: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Efectivo', icon: Banknote },
  { id: 'BANK_TRANSFER', label: 'Transferencia', icon: Landmark },
  { id: 'CHECK', label: 'Cheque', icon: ScrollText },
] as const;

export const MobileCobrosFormView: React.FC<MobileCobrosFormViewProps> = ({
  persona, pendingInvoices, selectedInvoiceId, isCreditOnAccount, amount, paymentMethod,
  checkNumber, isEcheq, billingType, loading, errorMsg, onBack, onSelectInvoice,
  onToggleCreditOnAccount, onChangeAmount, onChangePaymentMethod, onChangeCheckNumber,
  onToggleEcheq, onChangeBillingType, onSubmit,
}) => {
  const [copiedAlias, setCopiedAlias] = useState(false);
  const parsedAmount = parseFloat(amount);
  const isOverpayment = parsedAmount > persona.outstandingBalance && persona.outstandingBalance > 0;

  const handleCopyAlias = () => {
    navigator.clipboard?.writeText('donvenancio2024').catch(() => undefined);
    setCopiedAlias(true);
    window.setTimeout(() => setCopiedAlias(false), 2000);
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
      <button
        type="button" onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', padding: '4px 0', marginBottom: '14px' }}
      >
        <ChevronLeft size={18} aria-hidden="true" />
        <span>Volver</span>
      </button>

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)', marginBottom: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{persona.name}</h2>
          {persona.city && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{persona.city}</span>}
        </div>

        {persona.outstandingBalance < 0 ? (
          <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#047857', display: 'block' }}>A favor</span>
              <span className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#065F46' }}>{formatIntegerARS(Math.abs(persona.outstandingBalance))}</span>
            </div>
            <span style={{ fontSize: '0.75rem', backgroundColor: '#D1FAE5', color: '#065F46', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>Crédito</span>
          </div>
        ) : (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#B91C1C', display: 'block' }}>Saldo</span>
              <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#991B1B' }}>{formatIntegerARS(persona.outstandingBalance)}</span>
            </div>
            <button
              type="button" onClick={() => onChangeAmount(Math.round(persona.outstandingBalance).toString())}
              style={{ fontSize: '0.75rem', backgroundColor: '#FFFFFF', color: '#991B1B', border: '1px solid #FCA5A5', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cobrar total
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div role="alert" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 12px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, marginBottom: '14px' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {pendingInvoices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F9FAFB', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <label htmlFor="cobro-invoice-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Imputación</label>
            <select
              id="cobro-invoice-select" value={selectedInvoiceId || ''} disabled={isCreditOnAccount}
              onChange={(e) => onSelectInvoice(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: isCreditOnAccount ? '#F3F4F6' : '#FFFFFF', color: isCreditOnAccount ? '#9CA3AF' : 'var(--text-primary)', fontSize: '0.9rem' }}
            >
              <option value="">Seleccionar factura</option>
              {pendingInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} · {formatIntegerARS(inv.pendingAmount)}</option>
              ))}
            </select>

            <label htmlFor="cobro-credit-account" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              <input
                id="cobro-credit-account" type="checkbox" checked={isCreditOnAccount}
                onChange={(e) => onToggleCreditOnAccount(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: isCreditOnAccount ? 600 : 400 }}>Dejar a favor</span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="cobro-amount" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Monto (ARS)</label>
            {persona.outstandingBalance > 0 && (
              <button
                type="button" onClick={() => onChangeAmount((persona.outstandingBalance / 2).toFixed(0))}
                style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                50%
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', border: `1.5px solid ${isOverpayment ? '#F59E0B' : 'var(--border-color)'}`, borderRadius: '10px', padding: '4px 14px' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '10px', userSelect: 'none' }}>$</span>
            <input
              id="cobro-amount" type="number" step="0.01" required value={amount} className="tabular-nums"
              onChange={(e) => onChangeAmount(e.target.value)} placeholder="0"
              style={{ width: '100%', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', padding: '10px 0' }}
            />
          </div>
          {isOverpayment && (
            <span role="status" style={{ fontSize: '0.75rem', color: '#D97706' }}>El monto supera el saldo; quedará a favor.</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Medio de pago</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isActive = paymentMethod === method.id;
              return (
                <button
                  key={method.id} type="button" aria-pressed={isActive} onClick={() => onChangePaymentMethod(method.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '12px 8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                    backgroundColor: isActive ? 'var(--accent-color)' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {paymentMethod === 'BANK_TRANSFER' && (
          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 12px', border: '1px solid #93C5FD', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Alias Mercado Pago</span>
                <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>donvenancio2024</span>
              </div>
              <button
                type="button" onClick={handleCopyAlias}
                style={{ fontSize: '0.75rem', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                {copiedAlias ? 'Copiado' : 'Copiar alias'}
              </button>
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.73rem', color: '#1E40AF' }}>
              <strong>CVU:</strong> <code>0000003100085432453321</code>
            </div>
          </div>
        )}

        {paymentMethod === 'CHECK' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="cobro-check-number" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cheque *</label>
            <input
              id="cobro-check-number" type="text" required value={checkNumber} onChange={(e) => onChangeCheckNumber(e.target.value)}
              placeholder="Número de cheque" autoCorrect="off" autoCapitalize="none" spellCheck={false}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}
            />
            <label
              htmlFor="cobro-echeq"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: isEcheq ? '#F0F9FF' : '#F9FAFB', border: `1px solid ${isEcheq ? '#0EA5E9' : 'var(--border-color)'}`, padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', userSelect: 'none' }}
            >
              <input id="cobro-echeq" type="checkbox" checked={isEcheq} onChange={(e) => onToggleEcheq(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#0284C7', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isEcheq ? '#0369A1' : 'var(--text-primary)' }}>E-Cheq</span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sucursal</span>
          <div style={{ display: 'flex', backgroundColor: '#F3F4F6', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            {[
              { id: 'OFFICIAL', label: 'Sucursal A' },
              { id: 'INTERNAL', label: 'Sucursal X' },
            ].map((branch) => {
              const active = billingType === branch.id;
              return (
                <button
                  key={branch.id} type="button" disabled={selectedInvoiceId !== null} aria-pressed={active} onClick={() => onChangeBillingType(branch.id)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '7px', fontSize: '0.83rem', fontWeight: 600, border: 'none',
                    cursor: selectedInvoiceId !== null ? 'not-allowed' : 'pointer',
                    backgroundColor: active ? '#FFFFFF' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: selectedInvoiceId !== null && !active ? 0.4 : 1,
                  }}
                >
                  {branch.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit" disabled={loading || !amount || parsedAmount <= 0}
          style={{
            width: '100%', backgroundColor: 'var(--color-corp-red)', color: '#FFFFFF', fontWeight: 700, fontSize: '1rem',
            padding: '14px', borderRadius: '10px', border: 'none', marginTop: '6px',
            cursor: loading || !amount || parsedAmount <= 0 ? 'not-allowed' : 'pointer',
            opacity: loading || !amount || parsedAmount <= 0 ? 0.5 : 1,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          }}
        >
          {loading ? (<><Loader2 size={18} className="spin-animation" aria-hidden="true" /><span>Procesando...</span></>) : 'Confirmar cobro'}
        </button>
      </form>
    </div>
  );
};
