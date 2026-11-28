import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { useWeeklyCitySalesQuery, useWeeklySalesQuery } from '../../hooks/queries';
import {
  buildCitySalesDetailTsv,
  buildWeeklySalesTsv,
  computeArDatePreset,
  formatCityLabel,
  formatShortArDate,
  formatShortArRange,
  shiftArWeekRange,
} from '../reports/reportDateHelpers';
import {
  type CityDetailBranchFilter,
  WeeklySalesCityDetailView,
} from './WeeklySalesCityDetailView';
import { type SalesByCityRow, WeeklySalesCityListTable } from './WeeklySalesCityListTable';

export type { SalesByCityRow };

interface WeeklySalesByCityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate: string;
  initialEndDate: string;
  initialReport?: any;
}

const formatPeso = (value: number) => `$${Math.round(value || 0).toLocaleString('es-AR')}`;

export function WeeklySalesByCityModal({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  initialReport,
}: WeeklySalesByCityModalProps) {
  const [range, setRange] = useState({ startDate: initialStartDate, endDate: initialEndDate });
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<CityDetailBranchFilter>('ALL');
  const [search, setSearch] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [copyAnnouncement, setCopyAnnouncement] = useState('');
  const copyTimerRef = useRef<number | null>(null);
  const lastAnnouncementRef = useRef('');
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const cityButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastCityRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRange({ startDate: initialStartDate, endDate: initialEndDate });
    }
    setSelectedCity(null);
    setBranchFilter('ALL');
    setSearch('');
    setCopyStatus('idle');
    setCopyAnnouncement('');
    lastCityRef.current = null;
  }, [isOpen, initialStartDate, initialEndDate]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const currentWeek = computeArDatePreset('this_week');
  const isCurrentWeek =
    range.startDate === currentWeek.startDate && range.endDate === currentWeek.endDate;
  const isInitialRange =
    range.startDate === initialStartDate && range.endDate === initialEndDate;

  const { data: queriedReport, isFetching } = useWeeklySalesQuery(
    range.startDate,
    range.endDate,
    isOpen,
  );
  const {
    data: cityDetail,
    isFetching: isFetchingDetail,
    isError: isErrorDetail,
    refetch: refetchDetail,
  } = useWeeklyCitySalesQuery(selectedCity, range.startDate, range.endDate, isOpen && Boolean(selectedCity));

  const report = queriedReport ?? (isInitialRange ? initialReport : undefined);
  const officialSales = Number(report?.sales?.official || 0);
  const internalSales = Number(report?.sales?.internal || 0);
  const totalSales = Number(report?.summary?.netSales ?? officialSales + internalSales);
  const totalOrders =
    Number(report?.sales?.officialCount || 0) + Number(report?.sales?.internalCount || 0);
  const rows: SalesByCityRow[] = Array.isArray(report?.salesByCity) ? report.salesByCity : [];

  const selectedCityRow = selectedCity ? rows.find((r) => r.city === selectedCity) : undefined;
  const kpiOfficial = selectedCity
    ? (cityDetail?.summary.official ?? selectedCityRow?.official ?? 0)
    : officialSales;
  const kpiInternal = selectedCity
    ? (cityDetail?.summary.internal ?? selectedCityRow?.internal ?? 0)
    : internalSales;
  const kpiTotal = selectedCity
    ? (cityDetail?.summary.total ?? selectedCityRow?.total ?? 0)
    : totalSales;
  const kpiOrders = selectedCity
    ? (cityDetail?.summary.count ?? selectedCityRow?.count ?? 0)
    : totalOrders;
  const kpiOfficialPct = kpiTotal > 0 ? Math.round((kpiOfficial / kpiTotal) * 100) : 0;
  const kpiInternalPct = kpiTotal > 0 ? Math.round((kpiInternal / kpiTotal) * 100) : 0;

  const filteredDetailItems = useMemo(() => {
    const items = cityDetail?.items ?? [];
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (branchFilter !== 'ALL' && item.branch !== branchFilter) return false;
      if (!term) return true;
      return (
        item.clientName.toLowerCase().includes(term) ||
        item.voucher.toLowerCase().includes(term)
      );
    });
  }, [cityDetail?.items, branchFilter, search]);

  const filteredDetailTotal = useMemo(
    () => filteredDetailItems.reduce((acc, item) => acc + item.amount, 0),
    [filteredDetailItems],
  );

  const handleShiftWeek = (delta: number) => {
    setRange((prev) => shiftArWeekRange(prev.startDate, delta));
  };

  const handleSelectCity = (city: string) => {
    lastCityRef.current = city;
    setSelectedCity(city);
    setBranchFilter('ALL');
    setSearch('');
    setCopyStatus('idle');
    window.requestAnimationFrame(() => backButtonRef.current?.focus());
  };

  const handleBackToCities = () => {
    const targetCity = lastCityRef.current;
    setSelectedCity(null);
    setBranchFilter('ALL');
    setSearch('');
    setCopyStatus('idle');
    if (targetCity) {
      window.requestAnimationFrame(() => cityButtonRefs.current[targetCity]?.focus());
    }
  };

  const handleCopyForSheets = async () => {
    let tsv = '';
    if (selectedCity) {
      if (filteredDetailItems.length === 0) return;
      tsv = buildCitySalesDetailTsv(
        filteredDetailItems.map((item) => ({
          dateLabel: formatShortArDate(item.date),
          clientName: item.clientName,
          voucher: item.voucher,
          branch: item.branch,
          amount: item.amount,
        })),
        filteredDetailTotal,
      );
    } else {
      if (rows.length === 0) return;
      tsv = buildWeeklySalesTsv(
        rows.map((row) => ({
          cityLabel: formatCityLabel(row.city),
          official: row.official,
          internal: row.internal,
          total: row.total,
          count: row.count,
        })),
        {
          official: officialSales,
          internal: internalSales,
          total: totalSales,
          orders: totalOrders,
        },
      );
    }
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    try {
      await navigator.clipboard.writeText(tsv);
      setCopyStatus('copied');
      const nextMsg = lastAnnouncementRef.current === 'Copiado' ? 'Copiado\u00A0' : 'Copiado';
      lastAnnouncementRef.current = nextMsg;
      setCopyAnnouncement(nextMsg);
    } catch {
      setCopyStatus('failed');
      const nextMsg = lastAnnouncementRef.current === 'Error al copiar' ? 'Error al copiar\u00A0' : 'Error al copiar';
      lastAnnouncementRef.current = nextMsg;
      setCopyAnnouncement(nextMsg);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyStatus('idle');
      setCopyAnnouncement('');
      copyTimerRef.current = null;
    }, 2000);
  };

  const isCopyDisabled = selectedCity ? filteredDetailItems.length === 0 : rows.length === 0;

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="weekly-sales-modal-title"
      style={{
        width: 'min(820px, calc(100vw - 24px))',
        maxHeight: 'min(94dvh, 960px)',
        padding: 0,
        borderRadius: '14px',
        border: '1px solid var(--border-color, #e5e7eb)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.16)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'min(94dvh, 960px)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {selectedCity && (
              <button
                ref={backButtonRef}
                type="button"
                className="btn btn-ghost"
                aria-label="Volver a localidades"
                onClick={handleBackToCities}
                style={{
                  padding: '5px',
                  minInlineSize: '30px',
                  minBlockSize: '30px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
            )}
            <h2
              id="weekly-sales-modal-title"
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.015em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedCity ? formatCityLabel(selectedCity) : 'Ventas por localidad'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '8px',
                padding: '3px',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Semana anterior"
                onClick={() => handleShiftWeek(-1)}
                style={{ padding: '4px 6px', minHeight: 'auto', lineHeight: 1 }}
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  padding: '0 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatShortArRange(range.startDate, range.endDate)}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Semana siguiente"
                onClick={() => handleShiftWeek(1)}
                style={{ padding: '4px 6px', minHeight: 'auto', lineHeight: 1 }}
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            {!isCurrentWeek && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRange(currentWeek)}
                style={{ padding: '5px 10px', fontSize: '0.76rem', minHeight: 'auto' }}
              >
                Esta semana
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              aria-label={
                selectedCity
                  ? 'Copiar ventas de la localidad para Google Sheets'
                  : 'Copiar ventas por localidad para Google Sheets'
              }
              title={copyStatus === 'copied' ? 'Copiado' : copyStatus === 'failed' ? 'No se pudo copiar' : 'Copiar para Google Sheets'}
              onClick={handleCopyForSheets}
              disabled={isCopyDisabled}
              style={{
                padding: '6px',
                minInlineSize: '30px',
                minBlockSize: '30px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: copyStatus === 'copied' ? '#16a34a' : copyStatus === 'failed' ? '#dc2626' : 'var(--text-secondary)',
              }}
            >
              {copyStatus === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
            <span role="status" className="visually-hidden">
              {copyAnnouncement}
            </span>

            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Cerrar"
              onClick={onClose}
              style={{ padding: '6px', minHeight: 'auto', color: 'var(--text-secondary)' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '10px',
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: '#fafafa',
          }}
        >
          {[
            { label: 'Total', value: formatPeso(kpiTotal), meta: `${kpiOrders} ${kpiOrders === 1 ? 'pedido' : 'pedidos'}` },
            { label: 'Sucursal A', value: formatPeso(kpiOfficial), meta: `${kpiOfficialPct}%` },
            { label: 'Sucursal X', value: formatPeso(kpiInternal), meta: `${kpiInternalPct}%` },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.label}
              </div>
              <div
                className="tabular-nums"
                style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', letterSpacing: '-0.02em' }}
              >
                {card.value}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {card.meta}
              </div>
            </div>
          ))}
        </div>

        {selectedCity ? (
          <WeeklySalesCityDetailView
            cityLabel={formatCityLabel(selectedCity)}
            items={filteredDetailItems}
            totalAmount={filteredDetailTotal}
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
            search={search}
            onSearchChange={setSearch}
            isLoading={isFetchingDetail && !cityDetail}
            isError={isErrorDetail && !cityDetail}
            onRetry={() => refetchDetail()}
          />
        ) : (
          <WeeklySalesCityListTable
            rows={rows}
            isLoading={!report && isFetching}
            isDimmed={isFetching && !report}
            officialSales={officialSales}
            internalSales={internalSales}
            totalSales={totalSales}
            totalOrders={totalOrders}
            onSelectCity={handleSelectCity}
            registerCityButtonRef={(city, el) => {
              cityButtonRefs.current[city] = el;
            }}
          />
        )}
      </div>
    </NativeModalDialog>
  );
}
