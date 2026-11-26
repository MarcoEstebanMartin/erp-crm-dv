import { useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { type PendingInvoiceOption } from './AdminPaymentAllocationPreview';

export type ClientPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK';

interface UseAdminPaymentModalParams {
  paymentModal: { open: boolean; clientId: number; clientName: string } | null;
  clientProfileModal: { open: boolean; client: any; ledger: any[] } | null;
  onClose: () => void;
  onSuccess: (clientId: number) => Promise<void>;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export function useAdminPaymentModal({
  paymentModal,
  clientProfileModal,
  onClose,
  onSuccess,
  setErrorMsg,
  setSuccessMsg,
}: UseAdminPaymentModalParams) {
  const creditCheckboxRef = useRef<HTMLInputElement>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [checkDueDate, setCheckDueDate] = useState('');
  const [isEcheq, setIsEcheq] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPendingInvoices, setPaymentPendingInvoices] = useState<PendingInvoiceOption[]>([]);
  const [unbilledBalance, setUnbilledBalance] = useState(0);
  const [includeUnbilledBalance, setIncludeUnbilledBalance] = useState(false);
  const [availableCredit, setAvailableCredit] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null);
  const [paymentSelectedInvoiceIds, setPaymentSelectedInvoiceIds] = useState<number[]>([]);
  const [allowCreditOnAccount, setAllowCreditOnAccount] = useState(false);
  const [needsCreditOverride, setNeedsCreditOverride] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentModal && paymentModal.open) {
      setPaymentAmount('');
      setPaymentMethod('CASH');
      setPaymentDescription('');
      setCheckNumber('');
      setCheckBank('');
      setCheckDueDate('');
      setIsEcheq(false);
      setPaymentSelectedInvoiceIds([]);
      setUnbilledBalance(0);
      setIncludeUnbilledBalance(false);
      setAllowCreditOnAccount(false);
      setNeedsCreditOverride(false);
      setModalError(null);
      const profileBalance =
        clientProfileModal?.client?.id === paymentModal.clientId
          ? Math.round(Number(clientProfileModal.client.outstandingBalance || 0))
          : null;
      setOutstandingBalance(profileBalance);
      api
        .getPersonaPendingInvoices(paymentModal.clientId)
        .then((res) => {
          const rawInvoices: PendingInvoiceOption[] =
            res?.invoices && Array.isArray(res.invoices) ? res.invoices : [];
          const sortedInvoices = [...rawInvoices].sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return ta !== tb ? ta - tb : a.id - b.id;
          });
          const nextUnbilled = Math.max(0, Math.round(Number(res?.unbilledBalance || 0)));
          setPaymentPendingInvoices(sortedInvoices);
          setUnbilledBalance(nextUnbilled);
          if (nextUnbilled > 0) {
            setIncludeUnbilledBalance(true);
            setPaymentSelectedInvoiceIds([]);
          } else {
            setIncludeUnbilledBalance(false);
            setPaymentSelectedInvoiceIds(sortedInvoices.length > 0 ? [sortedInvoices[0].id] : []);
          }
          setAvailableCredit(Math.round(Number(res?.totalAvailableCredit || 0)));
          if (res?.outstandingBalance !== undefined && res?.outstandingBalance !== null) {
            setOutstandingBalance(Math.round(Number(res.outstandingBalance)));
          } else if (res?.netBalance !== undefined && res?.netBalance !== null) {
            setOutstandingBalance(Math.round(Number(res.netBalance)));
          }
        })
        .catch(() => {
          setPaymentPendingInvoices([]);
          setAvailableCredit(0);
        });
    } else {
      setPaymentPendingInvoices([]);
      setUnbilledBalance(0);
      setIncludeUnbilledBalance(false);
      setAvailableCredit(0);
      setOutstandingBalance(null);
      setAllowCreditOnAccount(false);
      setNeedsCreditOverride(false);
      setModalError(null);
    }
  }, [paymentModal, clientProfileModal]);

  const parsedAmount = Math.round(Number(paymentAmount) || 0);
  const selectedIdSet = new Set(paymentSelectedInvoiceIds);
  const selectedInvoices = paymentPendingInvoices.filter((i) => selectedIdSet.has(i.id));
  const selectedInvoicesTotal = selectedInvoices.reduce(
    (sum, inv) => sum + Math.max(0, Math.round(Number(inv.pendingAmount))),
    0,
  );
  const hasUnbilled = unbilledBalance > 0;
  const selectedTotal =
    selectedInvoicesTotal + (hasUnbilled && includeUnbilledBalance ? unbilledBalance : 0);
  const effectiveDebt = Math.max(0, outstandingBalance ?? 0);
  const hasAnySelection = selectedInvoices.length > 0 || (hasUnbilled && includeUnbilledBalance);
  const fillTargetAmount = hasAnySelection ? selectedTotal : effectiveDebt;
  const excessAmount =
    parsedAmount > 0 && outstandingBalance !== null && parsedAmount > effectiveDebt
      ? parsedAmount - effectiveDebt
      : 0;
  const showCreditToggle = excessAmount > 0 || needsCreditOverride;

  const updateAmountFromSelection = (nextIds: number[], nextIncludeUnbilled: boolean) => {
    const idSet = new Set(nextIds);
    const invSum = paymentPendingInvoices
      .filter((inv) => idSet.has(inv.id))
      .reduce((sum, inv) => sum + Math.max(0, Math.round(Number(inv.pendingAmount))), 0);
    const total = invSum + (hasUnbilled && nextIncludeUnbilled ? unbilledBalance : 0);
    setPaymentAmount(total > 0 ? String(total) : '');
    if (modalError) setModalError(null);
  };

  const handleToggleInvoice = (invoiceId: number) => {
    const nextSet = new Set(paymentSelectedInvoiceIds);
    if (nextSet.has(invoiceId)) {
      nextSet.delete(invoiceId);
    } else {
      nextSet.add(invoiceId);
    }
    const nextIds = paymentPendingInvoices
      .filter((inv) => nextSet.has(inv.id))
      .map((inv) => inv.id);
    setPaymentSelectedInvoiceIds(nextIds);
    updateAmountFromSelection(nextIds, includeUnbilledBalance);
  };

  const handleToggleUnbilledBalance = () => {
    const nextInclude = !includeUnbilledBalance;
    setIncludeUnbilledBalance(nextInclude);
    updateAmountFromSelection(paymentSelectedInvoiceIds, nextInclude);
  };

  const handleToggleAllInvoices = () => {
    const totalItems = (hasUnbilled ? 1 : 0) + paymentPendingInvoices.length;
    const currentSelectedCount =
      (hasUnbilled && includeUnbilledBalance ? 1 : 0) + paymentSelectedInvoiceIds.length;
    if (currentSelectedCount === totalItems) {
      setIncludeUnbilledBalance(false);
      setPaymentSelectedInvoiceIds([]);
      setPaymentAmount('');
      if (modalError) setModalError(null);
    } else {
      const allIds = paymentPendingInvoices.map((inv) => inv.id);
      setIncludeUnbilledBalance(hasUnbilled);
      setPaymentSelectedInvoiceIds(allIds);
      updateAmountFromSelection(allIds, hasUnbilled);
    }
  };

  const handlePaymentMethodChange = (next: ClientPaymentMethod) => {
    setPaymentMethod(next);
    if (next !== 'CHECK') {
      setCheckNumber('');
      setCheckBank('');
      setCheckDueDate('');
      setIsEcheq(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setModalError('Monto inválido.');
      return;
    }
    if (paymentMethod === 'CHECK' && !checkNumber.trim()) {
      setModalError('Ingresá el número de cheque o eCheq.');
      return;
    }
    if (showCreditToggle && !allowCreditOnAccount) {
      setModalError('Tildá "Dejar plata a favor" para continuar.');
      creditCheckboxRef.current?.focus();
      return;
    }
    if (paymentLoading) return;

    try {
      setPaymentLoading(true);
      setModalError(null);
      setErrorMsg(null);

      const applyToUnbilled =
        hasUnbilled && (includeUnbilledBalance || paymentSelectedInvoiceIds.length === 0);
      const singleExactOrderId =
        !applyToUnbilled &&
        paymentSelectedInvoiceIds.length === 1 &&
        parsedAmount <= selectedInvoicesTotal
          ? paymentSelectedInvoiceIds[0]
          : undefined;

      await api.registerPayment(paymentModal.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription.trim() || undefined,
        orderId: singleExactOrderId,
        orderIds: paymentSelectedInvoiceIds.length > 0 ? paymentSelectedInvoiceIds : undefined,
        applyToUnbilledBalance: applyToUnbilled || undefined,
        allowCreditOnAccount: showCreditToggle ? allowCreditOnAccount : false,
        ...(paymentMethod === 'CHECK'
          ? {
              checkNumber: checkNumber.trim(),
              checkBank: checkBank.trim() || undefined,
              checkDueDate: checkDueDate || undefined,
              isEcheq,
            }
          : {}),
      });

      setSuccessMsg('Cobro registrado.');
      await onSuccess(paymentModal.clientId);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Error al registrar cobro.';
      if (msg.includes('Dejar plata a favor')) {
        setNeedsCreditOverride(true);
      }
      setModalError(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

  return {
    creditCheckboxRef,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    handlePaymentMethodChange,
    paymentDescription,
    setPaymentDescription,
    checkNumber,
    setCheckNumber,
    checkBank,
    setCheckBank,
    checkDueDate,
    setCheckDueDate,
    isEcheq,
    setIsEcheq,
    paymentLoading,
    paymentPendingInvoices,
    unbilledBalance,
    includeUnbilledBalance,
    availableCredit,
    outstandingBalance,
    paymentSelectedInvoiceIds,
    allowCreditOnAccount,
    setAllowCreditOnAccount,
    modalError,
    setModalError,
    effectiveDebt,
    fillTargetAmount,
    excessAmount,
    showCreditToggle,
    handleToggleInvoice,
    handleToggleUnbilledBalance,
    handleToggleAllInvoices,
    handleSubmit,
  };
}
