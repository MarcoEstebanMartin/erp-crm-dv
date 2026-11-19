import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fieldReceiptsApi,
  type CollectorSettlementDTO,
  type OfflineBundleBankAccount,
} from '../../api/fieldReceipts.api';
import { HOME_QUERY_KEYS } from '../../hooks/queries/useHomeQuery';
import { isPendingOpenSettlement, resolveSettlementChannel } from './fieldSettlementChannel';

export function useFieldRendiciones() {
  const queryClient = useQueryClient();
  const [settlements, setSettlements] = useState<CollectorSettlementDTO[]>([]);
  const [banks, setBanks] = useState<OfflineBundleBankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [declaredCashById, setDeclaredCashById] = useState<Record<number, string>>({});
  const [bankByPaymentId, setBankByPaymentId] = useState<Record<number, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchFieldRendiciones = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [list, bundle] = await Promise.all([
        fieldReceiptsApi.listAllSettlements(),
        fieldReceiptsApi.getOfflineBundle(),
      ]);
      setSettlements(list);
      setBanks(bundle.bankAccounts || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cargar rendiciones en calle.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openSettlements = useMemo(
    () => settlements.filter(isPendingOpenSettlement),
    [settlements],
  );

  const sellerFieldSettlements = useMemo(
    () => openSettlements.filter((s) => resolveSettlementChannel(s) === 'SELLER'),
    [openSettlements],
  );

  const driverFieldSettlements = useMemo(
    () => openSettlements.filter((s) => resolveSettlementChannel(s) === 'DRIVER'),
    [openSettlements],
  );

  const pendingTransfers = useMemo(
    () =>
      settlements.flatMap((s) =>
        (s.receipts || [])
          .filter((r) => r.status !== 'VOIDED')
          .flatMap((r) =>
            (r.payments || [])
              .filter((p) => p.paymentMethod === 'BANK_TRANSFER' && p.status === 'PENDING_BANK')
              .map((p) => ({ settlement: s, receipt: r, payment: p })),
          ),
      ),
    [settlements],
  );

  const handleApproveSettlement = async (s: CollectorSettlementDTO) => {
    setBusyId(s.id);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const raw = declaredCashById[s.id] ?? String(Math.round(Number(s.expectedCash || 0)));
      const declared = Math.round(Number(raw) || 0);
      await fieldReceiptsApi.approveSettlement(s.id, declared);
      setStatusMsg(`Rendición de ${s.collector?.username || `#${s.collectorUserId}`} aprobada.`);
      await Promise.all([
        fetchFieldRendiciones(),
        queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEYS.pendingRendiciones }),
      ]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al aprobar rendición.');
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyTransfer = async (
    paymentId: number,
    action: 'CLEAR' | 'REJECT',
    currentBankId: number | null,
  ) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if (action === 'CLEAR') {
        const selectedBank = Number(bankByPaymentId[paymentId] || currentBankId || banks[0]?.id || 0);
        if (!selectedBank) {
          setErrorMsg('Seleccioná una cuenta bancaria para acreditar.');
          return;
        }
        await fieldReceiptsApi.verifyTransfer(paymentId, 'CLEAR', selectedBank);
        setStatusMsg('Transferencia acreditada.');
      } else {
        const reason = window.prompt('Motivo del rechazo de la transferencia:');
        if (!reason || reason.trim().length < 3) return;
        await fieldReceiptsApi.verifyTransfer(paymentId, 'REJECT', undefined, reason.trim());
        setStatusMsg('Transferencia rechazada y deuda restituida al cliente.');
      }
      await Promise.all([
        fetchFieldRendiciones(),
        queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEYS.pendingRendiciones }),
      ]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar transferencia.');
    }
  };

  return {
    loading,
    busyId,
    banks,
    sellerFieldSettlements,
    driverFieldSettlements,
    pendingTransfers,
    declaredCashById,
    setDeclaredCashById,
    bankByPaymentId,
    setBankByPaymentId,
    previewImage,
    setPreviewImage,
    statusMsg,
    setStatusMsg,
    errorMsg,
    setErrorMsg,
    fetchFieldRendiciones,
    handleApproveSettlement,
    handleVerifyTransfer,
  };
}
