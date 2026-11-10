import React, { useState } from 'react';
import { api } from '../../utils/api';
import type { CajaActionModalState } from './types';

export function useDepositDrawers() {
  const [drawers, setDrawers] = useState<any[]>([]);
  const [historicalDrawers, setHistoricalDrawers] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [amountInput, setAmountInput] = useState('');
  const [cajaActionModal, setCajaActionModal] = useState<CajaActionModalState | null>(null);

  const [inspectDrawer, setInspectDrawer] = useState<any | null>(null);
  const [inspectTxs, setInspectTxs] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const filteredHistory = historicalDrawers.filter((d: any) => {
    const closedDate = new Date(d.closedAt);
    const [sYear, sMonth, sDay] = filterStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = filterEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    return closedDate >= start && closedDate <= end;
  });

  const fetchDrawers = async () => {
    setLoadingHistory(true);
    try {
      const allDrawers = await api.getCashDrawers();
      const active = await api.getActiveDrawers();
      setDrawers(active || []);

      const closed = (allDrawers || []).filter((d: any) => d.status === 'CLOSED');
      const history = [...closed].sort(
        (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
      );
      setHistoricalDrawers(history);
    } catch (err: any) {
      console.error('Error fetching drawers for history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleInspectDrawer = async (drawer: any) => {
    setInspectDrawer(drawer);
    setLoadingTxs(true);
    try {
      const txs = await api.getTransactions({ cashDrawerId: drawer.id });
      setInspectTxs(txs || []);
    } catch (err: any) {
      console.error('Error fetching transactions for historical drawer', err);
      alert('Error al cargar los comprobantes de la caja.');
    } finally {
      setLoadingTxs(false);
    }
  };

  const handleCloseInspect = () => {
    setInspectDrawer(null);
    setInspectTxs([]);
  };

  const handleCajaArqueoSubmit = async (
    realBalance: number,
    receipts: any[],
    checks: any[],
    routeNote?: string,
    notes?: string
  ) => {
    try {
      if (cajaActionModal?.mode === 'close' && cajaActionModal.drawerId) {
        await api.closeDrawer(
          cajaActionModal.drawerId,
          realBalance,
          receipts,
          checks,
          routeNote,
          notes
        );
        setCajaActionModal(null);
        fetchDrawers();
      }
    } catch (err: any) {
      alert(err.message || 'Error al cerrar caja.');
    }
  };

  const handleCajaActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActionModal) return;

    try {
      const amount = Number(amountInput);
      if (isNaN(amount) || amount < 0) {
        throw new Error('Ingrese un monto válido mayor o igual a 0.');
      }

      if (cajaActionModal.mode === 'open') {
        await api.openDrawer(cajaActionModal.branch, amount);
      } else if (cajaActionModal.mode === 'close' && cajaActionModal.drawerId) {
        await api.closeDrawer(cajaActionModal.drawerId, amount);
      }

      setCajaActionModal(null);
      setAmountInput('');
      fetchDrawers();
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la caja.');
    }
  };

  return {
    drawers,
    loadingHistory,
    amountInput,
    setAmountInput,
    cajaActionModal,
    setCajaActionModal,
    inspectDrawer,
    inspectTxs,
    loadingTxs,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filteredHistory,
    fetchDrawers,
    handleInspectDrawer,
    handleCloseInspect,
    handleCajaArqueoSubmit,
    handleCajaActionSubmit
  };
}
