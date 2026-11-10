import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
};

const DEFAULT_SUPPLIERS = [
  'REMOTTI- RTO', 'NIZA SA', 'DIST.JUNIN', 'A.G.D.', 'CASA NINI', 'R.P.B.',
  'FIDEOS EL RECORD', 'SODECAR SA', 'CREMIGAL', 'FRATELLI BRANCA', 'COMISION M.PAGO', 'PERC-ING.BRUTOS'
];

const DEFAULT_LOCALITIES = [
  'GENERAL VILLEGAS', 'EMILIO V. BUNGE', 'BANDERALÓ', 'BERNARDO LARROUDÉ', 'PIEDRITAS',
  'CORONEL CHARLONE', 'BUCHARDO', 'TRES ALGARROBOS', 'CARLOS TEJEDOR', 'FLORENTINO AMEGHINO',
  'BLAQUIER', 'RIVADAVIA', 'FORTÍN OLAVARRÍA', 'INTENDENTE ALVEAR', 'RUFINO', 'CEBALLOS',
  'REALICÓ', 'VILLA SAUZE', 'SANSINENA', 'SANTA ELEODORA', 'SANTA REGINA', 'VILLA SABOYA', 'CAÑADA SECA'
];

const getMonday = (dStr: string) => {
  const d = new Date(dStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export function useWeeklyCashController() {
  const confirm = useConfirm();
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [credit, setCredit] = useState<number>(0);
  const [buffer, setBuffer] = useState<number>(20000000);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestedCredit, setSuggestedCredit] = useState<number>(0);
  const [weeksDropdownOpen, setWeeksDropdownOpen] = useState(false);

  const setupNewWeek = async (weekStart: string) => {
    setSelectedWeekStart(weekStart);
    setPurchases(DEFAULT_SUPPLIERS.map(s => ({ company: s, date: '', amount: 0 })));
    setSales(DEFAULT_LOCALITIES.map(l => ({ locality: l, date: '', amountA: 0, amountX: 0 })));
    setBuffer(20000000);
    setIsDirty(true);
    try {
      const suggested = await api.getSuggestedCredit(weekStart);
      setCredit(suggested || 0);
      setSuggestedCredit(suggested || 0);
    } catch (e) {
      console.error('Error fetching suggested credit:', e);
      setCredit(0);
      setSuggestedCredit(0);
    }
  };

  const loadWeeklyReports = async (selectWeek?: string) => {
    try {
      const data = await api.getWeeklyReports();
      setWeeklyReports(data || []);
      if (data && data.length > 0) {
        const targetWeek = selectWeek || data[data.length - 1].weekStart;
        setSelectedWeekStart(targetWeek);
        const report = data.find((r: any) => r.weekStart === targetWeek);
        if (report) {
          setPurchases(report.purchases || []);
          setSales(report.sales || []);
          setCredit(Number(report.credit) || 0);
          setBuffer(Number(report.buffer) || 20000000);
          setIsDirty(false);
          try {
            const suggested = await api.getSuggestedCredit(targetWeek);
            setSuggestedCredit(suggested || 0);
          } catch {
            setSuggestedCredit(0);
          }
        } else {
          setupNewWeek(targetWeek);
        }
      } else {
        const currentMonday = getMonday(new Date().toISOString().split('T')[0]);
        setupNewWeek(currentMonday);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadWeeklyReports();
  }, []);

  const handleSelectWeek = async (weekStart: string) => {
    if (isDirty) {
      if (!await confirm('Tenés cambios sin guardar en esta planilla. ¿Querés descartarlos y cambiar de semana?', { type: 'warning' })) return;
    }
    const report = weeklyReports.find(r => r.weekStart === weekStart);
    setSelectedWeekStart(weekStart);
    if (report) {
      setPurchases(report.purchases || []);
      setSales(report.sales || []);
      setCredit(Number(report.credit) || 0);
      setBuffer(Number(report.buffer) || 20000000);
      setIsDirty(false);
      try {
        const suggested = await api.getSuggestedCredit(weekStart);
        setSuggestedCredit(suggested || 0);
      } catch {
        setSuggestedCredit(0);
      }
    } else {
      setupNewWeek(weekStart);
    }
    setWeeksDropdownOpen(false);
  };

  const handleSaveWeekly = async () => {
    setSaving(true);
    try {
      await api.saveWeeklyReport({ weekStart: selectedWeekStart, purchases, sales, credit, buffer });
      alert('Planilla semanal guardada con éxito.');
      setIsDirty(false);
      await loadWeeklyReports(selectedWeekStart);
    } catch (err: any) {
      alert('Error al guardar la planilla: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeekly = async () => {
    if (!await confirm(`¿Estás seguro de que querés eliminar la planilla de la semana ${selectedWeekStart}? Esta acción no se puede deshacer.`, { type: 'danger' })) return;
    try {
      await api.deleteWeeklyReport(selectedWeekStart);
      alert('Planilla eliminada con éxito.');
      setIsDirty(false);
      await loadWeeklyReports();
    } catch (err: any) {
      alert('Error al eliminar la planilla: ' + (err.message || err));
    }
  };

  const handleCreateNewWeek = () => {
    const defaultVal = new Date().toISOString().split('T')[0];
    const userVal = window.prompt('Ingresá una fecha de la semana que querés crear (se ajustará automáticamente al lunes de esa semana):', defaultVal);
    if (userVal) handleSelectWeek(getMonday(userVal));
  };

  const addPurchaseRow = () => { setPurchases(prev => [...prev, { company: '', date: '', amount: 0 }]); setIsDirty(true); };
  const removePurchaseRow = (idx: number) => { setPurchases(prev => prev.filter((_, i) => i !== idx)); setIsDirty(true); };
  const handlePurchaseChange = (idx: number, field: string, val: any) => {
    setPurchases(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    setIsDirty(true);
  };

  const addSalesRow = () => { setSales(prev => [...prev, { locality: '', date: '', amountA: 0, amountX: 0 }]); setIsDirty(true); };
  const removeSalesRow = (idx: number) => { setSales(prev => prev.filter((_, i) => i !== idx)); setIsDirty(true); };
  const handleSalesChange = (idx: number, field: string, val: any) => {
    setSales(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    setIsDirty(true);
  };

  const handleAutofillSales = async () => {
    try {
      const autoSales = await api.getAutofillSales(selectedWeekStart);
      if (!autoSales || autoSales.length === 0) {
        alert('No se encontraron ventas entregadas en el sistema para esta semana.');
        return;
      }
      setSales(prevSales => {
        const newSales = [...prevSales];
        const matchedLocalities = new Set<string>();
        autoSales.forEach((as: any) => {
          const matchIdx = newSales.findIndex(s => normalizeString(s.locality) === normalizeString(as.locality));
          if (matchIdx >= 0) {
            newSales[matchIdx] = { ...newSales[matchIdx], amountA: as.amountA, amountX: as.amountX, date: as.date || newSales[matchIdx].date };
            matchedLocalities.add(normalizeString(as.locality));
          }
        });
        autoSales.forEach((as: any) => {
          if (!matchedLocalities.has(normalizeString(as.locality))) {
            newSales.push({ locality: as.locality, date: as.date || '', amountA: as.amountA, amountX: as.amountX });
          }
        });
        return newSales;
      });
      setIsDirty(true);
      alert('Ventas completadas con éxito en base a los pedidos entregados.');
    } catch (err: any) {
      alert('Error al autocompletar ventas: ' + (err.message || err));
    }
  };

  return {
    weeklyReports, selectedWeekStart, purchases, sales, credit, setCredit,
    buffer, setBuffer, isDirty, setIsDirty, saving, suggestedCredit,
    weeksDropdownOpen, setWeeksDropdownOpen,
    handleSelectWeek, handleSaveWeekly, handleDeleteWeekly, handleCreateNewWeek,
    addPurchaseRow, removePurchaseRow, handlePurchaseChange,
    addSalesRow, removeSalesRow, handleSalesChange, handleAutofillSales
  };
}
