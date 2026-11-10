import React, { useState } from 'react';
import { api } from '../../utils/api';
import {
  type AuditTarget,
  type DeclaredCheckItem,
  type RouteGroup,
  type SellerGroup,
  formatCurrency,
  getDetectedRoutesAndCities
} from './types';

export function useRendicionesAudit() {
  const [sellers, setSellers] = useState<SellerGroup[]>([]);
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [auditTarget, setAuditTarget] = useState<AuditTarget | null>(null);
  const [arqueoResult, setArqueoResult] = useState<any | null>(null);
  const [realCash, setRealCash] = useState<string>('');
  const [realChecks, setRealChecks] = useState<string>('');
  const [auditRouteNote, setAuditRouteNote] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('');
  const [declaredChecksList, setDeclaredChecksList] = useState<DeclaredCheckItem[]>([]);
  const [newCheckNumber, setNewCheckNumber] = useState<string>('');
  const [newCheckBank, setNewCheckBank] = useState<string>('');
  const [newCheckAmount, setNewCheckAmount] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDrawerId, setSelectedDrawerId] = useState<string>('');

  const fetchRendiciones = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getPendingRendiciones();
      setSellers(data.sellers || []);
      setRoutes(data.routes || []);
    } catch (err: any) {
      console.error('Error fetching rendiciones', err);
      setErrorMsg(err.message || 'Error al cargar las rendiciones pendientes.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAudit = async (type: 'seller' | 'route', data: any) => {
    setAuditTarget({ type, data });
    setRealCash('');
    setRealChecks('');
    if (type === 'route') {
      setAuditRouteNote(data.driverName ? `Ruta de ${data.driverName}` : '');
    } else {
      const detected = getDetectedRoutesAndCities(data.transactions);
      setAuditRouteNote(detected.primary);
    }
    setAuditNotes('');
    setDeclaredChecksList([]);
    setNewCheckNumber('');
    setNewCheckBank('');
    setNewCheckAmount('');
    setErrorMsg(null);
    setSelectedDrawerId('');

    try {
      const active = await api.getActiveDrawers();
      if (active && active.length > 0) {
        setSelectedDrawerId(String(active[0].id));
      }
    } catch (err) {
      console.error('Error al cargar cajas activas:', err);
    }
  };

  const handleCloseAudit = () => {
    setAuditTarget(null);
    setRealCash('');
    setRealChecks('');
    setAuditRouteNote('');
    setAuditNotes('');
    setDeclaredChecksList([]);
    setNewCheckNumber('');
    setNewCheckBank('');
    setNewCheckAmount('');
    setSelectedDrawerId('');
  };

  const handleAddDeclaredCheck = () => {
    const amt = Number(newCheckAmount);
    if (isNaN(amt) || amt <= 0) return;
    const updated = [
      ...declaredChecksList,
      {
        number: newCheckNumber.trim() || 'S/N',
        bank: newCheckBank.trim() || 'Banco',
        amount: amt
      }
    ];
    setDeclaredChecksList(updated);
    const sumChecks = updated.reduce((acc, c) => acc + c.amount, 0);
    setRealChecks(String(sumChecks));
    setNewCheckNumber('');
    setNewCheckBank('');
    setNewCheckAmount('');
  };

  const handleRemoveDeclaredCheck = (index: number) => {
    const updated = declaredChecksList.filter((_, i) => i !== index);
    setDeclaredChecksList(updated);
    const sumChecks = updated.reduce((acc, c) => acc + c.amount, 0);
    setRealChecks(String(sumChecks));
  };

  const handleDeleteReceipt = async (tx: any) => {
    const receiptName = tx.receiptNumber || `N° ${tx.id}`;
    const clientName = tx.persona?.name || 'Cliente';
    const amountStr = formatCurrency(Number(tx.amount));

    if (
      !window.confirm(
        `¿Estás seguro de eliminar el recibo ${receiptName} (${clientName} por ${amountStr})?\n\nEsta acción restablecerá ${amountStr} al saldo pendiente del cliente.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.deleteReceipt(tx.id);

      if (auditTarget) {
        const remainingTxs = auditTarget.data.transactions.filter((t: any) => t.id !== tx.id);
        const amt = Number(tx.amount);
        const isOfficial = tx.billingType === 'OFFICIAL';
        const method = tx.paymentMethod;

        const updatedData = {
          ...auditTarget.data,
          totalToCollect: auditTarget.data.totalToCollect - amt,
          totalBranchA: isOfficial ? auditTarget.data.totalBranchA - amt : auditTarget.data.totalBranchA,
          totalBranchX: !isOfficial ? auditTarget.data.totalBranchX - amt : auditTarget.data.totalBranchX,
          totalCash: method === 'CASH' ? auditTarget.data.totalCash - amt : auditTarget.data.totalCash,
          totalChecks: method === 'CHECK' ? auditTarget.data.totalChecks - amt : auditTarget.data.totalChecks,
          totalTransfers:
            method === 'BANK_TRANSFER' ? auditTarget.data.totalTransfers - amt : auditTarget.data.totalTransfers,
          transactions: remainingTxs
        };

        setAuditTarget({ ...auditTarget, data: updatedData });
      }

      fetchRendiciones();
      alert(res.message || 'Recibo eliminado correctamente.');
    } catch (err: any) {
      console.error('Error al eliminar recibo:', err);
      setErrorMsg(err.message || 'Error al eliminar recibo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditTarget) return;

    const cashVal = Number(realCash || 0);
    const checksVal = Number(realChecks || 0);

    if (isNaN(cashVal) || cashVal < 0 || isNaN(checksVal) || checksVal < 0) {
      setErrorMsg('Por favor ingrese montos válidos mayores o iguales a cero.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        realCash: cashVal,
        realChecks: checksVal,
        routeNote: auditRouteNote ? auditRouteNote.trim() : undefined,
        notes: auditNotes ? auditNotes.trim() : undefined,
        declaredChecks: declaredChecksList
      };

      if (selectedDrawerId) {
        payload.destinationDrawerId = Number(selectedDrawerId);
      }

      if (auditTarget.type === 'seller') {
        payload.sellerId = auditTarget.data.user.id;
      } else {
        payload.routeId = auditTarget.data.routeId;
      }

      const res = await api.verifyRendicion(payload);

      if (res.status === 'success' && res.data) {
        setArqueoResult(res.data);
      } else {
        setSuccessMsg(res.message || 'Arqueo procesado y caja cerrada correctamente.');
        setTimeout(() => setSuccessMsg(null), 5000);
      }

      handleCloseAudit();
      fetchRendiciones();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al confirmar el arqueo.');
    } finally {
      setActionLoading(false);
    }
  };

  return {
    sellers,
    routes,
    loading,
    errorMsg,
    successMsg,
    auditTarget,
    arqueoResult,
    setArqueoResult,
    realCash,
    setRealCash,
    realChecks,
    setRealChecks,
    auditRouteNote,
    setAuditRouteNote,
    auditNotes,
    setAuditNotes,
    declaredChecksList,
    newCheckNumber,
    setNewCheckNumber,
    newCheckBank,
    setNewCheckBank,
    newCheckAmount,
    setNewCheckAmount,
    actionLoading,
    fetchRendiciones,
    handleOpenAudit,
    handleCloseAudit,
    handleAddDeclaredCheck,
    handleRemoveDeclaredCheck,
    handleDeleteReceipt,
    handleVerifySubmit
  };
}
