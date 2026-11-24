import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { computeArDatePreset } from '../reports/reportDateHelpers';
import { isBankReconcilableTx } from './finanzasHelpers';
import { FinanzasTransferenciasTab } from './FinanzasTransferenciasTab';
import { FinanzasBankReconciliationModal } from './FinanzasBankReconciliationModal';

export default function TransferenciasDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [filterStartDate, setFilterStartDate] = useState(() => computeArDatePreset('this_week').startDate);
  const [filterEndDate, setFilterEndDate] = useState(() => computeArDatePreset('this_week').endDate);

  const [reconModalOpen, setReconModalOpen] = useState(false);
  const [reconBankId, setReconBankId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTxs, banks] = await Promise.all([
        api.getTransactions(),
        api.getBankAccounts(),
      ]);
      setTransactions(allTxs || []);
      setBankAccounts(banks || []);
      setReconBankId((prev) => prev || (banks?.[0]?.id ? String(banks[0].id) : ''));
    } catch (err: any) {
      setError(err?.message || 'Error al cargar transferencias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const transfersInPeriod = useMemo(() => {
    const [sYear, sMonth, sDay] = filterStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = filterEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    return transactions.filter((t) => {
      if (!isBankReconcilableTx(t)) return false;
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, filterStartDate, filterEndDate]);

  if (loading && transactions.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>;
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Transferencias</h3>
        <search aria-label="Filtrar período de transferencias" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="transfers-start-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Desde</label>
          <input
            id="transfers-start-date"
            type="date"
            className="input"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            style={{ padding: '6px 10px', width: 'auto' }}
          />
          <label htmlFor="transfers-end-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hasta</label>
          <input
            id="transfers-end-date"
            type="date"
            className="input"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            style={{ padding: '6px 10px', width: 'auto' }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void fetchData()}
            aria-label="Actualizar"
            title="Actualizar"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </search>
      </div>

      {error && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.84rem' }}>
          {error}
        </div>
      )}

      <FinanzasTransferenciasTab
        transfers={transfersInPeriod}
        onOpenReconcile={() => {
          if (!reconBankId && bankAccounts[0]?.id) {
            setReconBankId(String(bankAccounts[0].id));
          }
          setReconModalOpen(true);
        }}
      />

      <FinanzasBankReconciliationModal
        isOpen={reconModalOpen}
        onClose={() => setReconModalOpen(false)}
        bankAccounts={bankAccounts}
        reconBankId={reconBankId}
        setReconBankId={setReconBankId}
        onRefreshMainData={() => void fetchData()}
      />
    </div>
  );
}
