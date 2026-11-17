import React from 'react';
import { Landmark, ChevronRight, Edit2 } from 'lucide-react';

interface BankAccount {
  id: number;
  name: string;
  accountNumber?: string | null;
  balance: number | string;
}

interface FinanzasBanksCardProps {
  bankAccounts: BankAccount[];
  onEditBank: (bank: BankAccount) => void;
}

export const FinanzasBanksCard: React.FC<FinanzasBanksCardProps> = ({ bankAccounts, onEditBank }) => {
  const activeBanks = bankAccounts.filter((b) => Math.round(Number(b.balance)) !== 0);
  const zeroBanks = bankAccounts.filter((b) => Math.round(Number(b.balance)) === 0);
  const totalBanks = bankAccounts.reduce((acc, b) => acc + Math.round(Number(b.balance)), 0);

  const renderBankItem = (b: BankAccount) => {
    const balanceRounded = Math.round(Number(b.balance));
    return (
      <details key={b.id} className="bank-item">
        <summary className="bank-summary">
          <span className="bank-summary-left">
            <ChevronRight size={14} className="bank-chevron" aria-hidden="true" />
            <span className="bank-summary-name">{b.name}</span>
          </span>
          <span
            className="tabular-nums"
            style={{
              fontWeight: 700,
              fontSize: '0.94rem',
              color: balanceRounded > 0 ? '#10b981' : 'var(--text-secondary)',
              fontFamily: 'monospace',
              flexShrink: 0,
            }}
          >
            ${balanceRounded.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
          </span>
        </summary>
        <div className="bank-detail-body">
          <span className="tabular-nums" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {b.accountNumber || 'Sin número'}
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
            onClick={() => onEditBank(b)}
          >
            <Edit2 size={12} aria-hidden="true" /> Editar
          </button>
        </div>
      </details>
    );
  };

  return (
    <section className="card" style={{ padding: '20px' }} aria-labelledby="bancos-heading">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 id="bancos-heading" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Landmark size={18} aria-hidden="true" /> Bancos
        </h3>
        <span
          className="tabular-nums"
          style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace', color: totalBanks > 0 ? '#10b981' : 'var(--text-secondary)' }}
        >
          ${totalBanks.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </span>
      </div>

      {bankAccounts.length === 0 ? (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', padding: '12px 0' }}>Sin cuentas</div>
      ) : (
        <div className="bank-accordion-list">
          {activeBanks.map(renderBankItem)}
          {zeroBanks.length > 0 && (
            <details className="bank-zero-group">
              <summary className="bank-summary">
                <span className="bank-summary-left">
                  <ChevronRight size={14} className="bank-chevron" aria-hidden="true" />
                  <span>Sin saldo ({zeroBanks.length})</span>
                </span>
                <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  $0
                </span>
              </summary>
              <div className="bank-zero-list">
                {zeroBanks.map(renderBankItem)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
};
