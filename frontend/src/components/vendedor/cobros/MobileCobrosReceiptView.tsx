import React from 'react';
import { CheckCircle } from 'lucide-react';
import { formatIntegerARS } from '../../../utils/currency';

interface MobileCobrosReceiptViewProps {
  receipt: any;
  clientName?: string;
  paymentMethod: string;
  checkNumber: string;
  isEcheq: boolean;
  onBack: () => void;
}

export const MobileCobrosReceiptView: React.FC<MobileCobrosReceiptViewProps> = ({
  receipt, clientName, paymentMethod, checkNumber, isEcheq, onBack,
}) => {
  const methodLabel =
    receipt.paymentMethod === 'CASH'
      ? 'Efectivo'
      : receipt.paymentMethod === 'BANK_TRANSFER'
        ? 'Transferencia'
        : isEcheq
          ? 'E-Cheq'
          : 'Cheque';

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', padding: '28px 20px', textAlign: 'center', marginTop: '20px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <CheckCircle size={34} aria-hidden="true" />
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Cobro registrado</h2>
        <p className="tabular-nums" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: 500 }}>Recibo {receipt.receiptNumber}</p>

        <div style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '16px', textAlign: 'left', marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cliente</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{clientName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monto</span>
            <span className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatIntegerARS(receipt.amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Medio</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{methodLabel}</span>
          </div>
          {checkNumber && paymentMethod === 'CHECK' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cheque</span>
              <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{isEcheq ? `E-CHEQ #${checkNumber}` : checkNumber}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sucursal</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{receipt.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}</span>
          </div>
        </div>

        <button type="button" onClick={onBack} style={{ width: '100%', backgroundColor: 'var(--accent-color)', color: '#FFFFFF', fontWeight: 600, padding: '13px', borderRadius: '10px', fontSize: '0.95rem', border: 'none', cursor: 'pointer' }}>
          Volver
        </button>
      </div>
    </div>
  );
};
