import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { formatDiffPeso, formatPeso, getMonthName, getShortMonthName } from './gastos/gastos.types';
import { useGastosController } from './gastos/useGastosController';
import { GastosPlanillaTable } from './gastos/GastosPlanillaTable';
import { GastosCategoriesTab } from './gastos/GastosCategoriesTab';
import { GastosCreateModal, GastosImportExcelModal } from './gastos/GastosCreateAndImportModals';
import { GastosCopyMonthModal } from './gastos/GastosCopyMonthModal';

export default function GastosDashboard() {
  const g = useGastosController();
  const anyModalOpen = g.isCreateModalOpen || g.isImportModalOpen || g.isCopyModalOpen;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px' }}>
      {g.errorMsg && !anyModalOpen && (
        <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fff5f5', color: '#c53030', borderRadius: '6px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid #feb2b2' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} aria-hidden="true" />
            <span>{g.errorMsg}</span>
          </span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => g.setErrorMsg(null)} aria-label="Cerrar alerta">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {g.successMsg && (
        <div role="status" style={{ padding: '10px 14px', backgroundColor: '#f0fff4', color: '#22543d', borderRadius: '6px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid #9ae6b4' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={15} style={{ color: '#16A34A' }} aria-hidden="true" />
            <span>{g.successMsg}</span>
          </span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => g.setSuccessMsg(null)} aria-label="Cerrar notificación">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Gastos</h2>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              backgroundColor: '#fff',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => g.navigateMonth(-1)}
              aria-label="Mes anterior"
              style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span style={{ padding: '0 10px', fontSize: '0.88rem', fontWeight: 600, minWidth: '132px', textAlign: 'center' }}>
              {getMonthName(g.selectedMonth)} {g.selectedYear}
            </span>
            <button
              type="button"
              onClick={() => g.navigateMonth(1)}
              aria-label="Mes siguiente"
              style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', color: 'var(--text-secondary)' }}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {g.missingRows.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={g.copyingAll}
              onClick={g.handleCopyAllMissing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            >
              <Copy size={14} aria-hidden="true" />
              <span>{g.copyingAll ? 'Copiando...' : `Copiar ${g.missingRows.length} pendientes`}</span>
            </button>
          )}

          {g.isAdmin && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { g.setErrorMsg(null); g.setIsImportModalOpen(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            >
              <FileSpreadsheet size={14} aria-hidden="true" />
              <span>Excel</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { g.setErrorMsg(null); g.setIsCreateModalOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Detallado</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {getMonthName(g.selectedMonth)} {g.selectedYear}
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
            {formatPeso(g.totalGasto)}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {getShortMonthName(g.compareMonth)} {g.compareYear}
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '4px', color: 'var(--text-secondary)' }}>
            {formatPeso(g.totalCompare)}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Diferencia
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginTop: '4px',
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              color: g.totalDiff === 0 ? 'var(--text-muted)' : g.totalDiff > 0 ? 'var(--color-corp-red)' : '#15803D',
            }}
          >
            <span>{formatDiffPeso(g.totalDiff)}</span>
            {g.totalDiffPct !== null && g.totalDiff !== 0 && (
              <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                ({g.totalDiffPct > 0 ? '+' : ''}{g.totalDiffPct.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div role="tablist" aria-label="Vistas de gastos" style={{ display: 'inline-flex', gap: '4px', backgroundColor: '#F3F4F6', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            role="tab"
            aria-selected={g.activeTab === 'planilla'}
            onClick={() => g.setActiveTab('planilla')}
            style={{
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: g.activeTab === 'planilla' ? '#fff' : 'transparent',
              color: g.activeTab === 'planilla' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: g.activeTab === 'planilla' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Planilla
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={g.activeTab === 'categorias'}
            onClick={() => g.setActiveTab('categorias')}
            style={{
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: g.activeTab === 'categorias' ? '#fff' : 'transparent',
              color: g.activeTab === 'categorias' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: g.activeTab === 'categorias' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Por categoría
          </button>
        </div>

        {g.activeTab === 'planilla' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} aria-hidden="true" />
              <input
                type="search"
                value={g.searchQuery}
                onChange={(e) => g.setSearchQuery(e.target.value)}
                placeholder="Buscar concepto..."
                aria-label="Buscar concepto"
                className="input"
                style={{ paddingLeft: '30px', height: '34px', width: '190px', fontSize: '0.83rem' }}
              />
            </div>

            <select
              value={g.filterCategoryId}
              onChange={(e) => g.setFilterCategoryId(e.target.value)}
              aria-label="Filtrar por categoría"
              className="select"
              style={{ height: '34px', width: '165px', fontSize: '0.83rem' }}
            >
              <option value="">Todas</option>
              {g.categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        )}
      </div>

      {g.activeTab === 'planilla' ? (
        <GastosPlanillaTable
          rows={g.comparisonRows}
          categories={g.categories}
          periods={g.periods}
          selectedYear={g.selectedYear}
          selectedMonth={g.selectedMonth}
          compareYear={g.compareYear}
          compareMonth={g.compareMonth}
          onChangeComparePeriod={g.setComparePeriod}
          totalCurrent={g.totalGasto}
          totalCompare={g.totalCompare}
          totalDiff={g.totalDiff}
          savingRowKey={g.savingRowKey}
          savedRowKey={g.savedRowKey}
          isAdmin={g.isAdmin}
          onInlineSave={g.handleInlineSaveAmount}
          onQuickCopyRow={g.handleQuickCopyRow}
          onQuickAddRow={g.handleQuickAddRow}
          onDeleteExpense={g.handleDeleteExpense}
        />
      ) : (
        <GastosCategoriesTab
          expenses={g.expenses}
          sortedCategories={g.sortedCategories}
          isAdmin={g.isAdmin}
          onDeleteExpense={g.handleDeleteExpense}
        />
      )}

      <GastosCreateModal
        isOpen={g.isCreateModalOpen}
        onClose={() => { g.setErrorMsg(null); g.setIsCreateModalOpen(false); }}
        submitting={g.submitting}
        errorMsg={g.errorMsg}
        categories={g.categories}
        bankAccounts={g.bankAccounts}
        vehicles={g.vehicles}
        newAmount={g.newAmount}
        setNewAmount={g.setNewAmount}
        newDate={g.newDate}
        setNewDate={g.setNewDate}
        newCategoryId={g.newCategoryId}
        setNewCategoryId={g.setNewCategoryId}
        newDescription={g.newDescription}
        setNewDescription={g.setNewDescription}
        newPaymentMethod={g.newPaymentMethod}
        setNewPaymentMethod={g.setNewPaymentMethod}
        newCashSource={g.newCashSource}
        setNewCashSource={g.setNewCashSource}
        newBillingType={g.newBillingType}
        setNewBillingType={g.setNewBillingType}
        newBankAccountId={g.newBankAccountId}
        setNewBankAccountId={g.setNewBankAccountId}
        newVehicleId={g.newVehicleId}
        setNewVehicleId={g.setNewVehicleId}
        onSubmit={g.handleCreateExpense}
      />

      <GastosImportExcelModal
        isOpen={g.isImportModalOpen}
        onClose={() => { g.setErrorMsg(null); g.setIsImportModalOpen(false); }}
        importing={g.importing}
        errorMsg={g.errorMsg}
        selectedFile={g.selectedFile}
        onFileChange={g.handleFileChange}
        onSubmit={g.handleImportExcel}
      />

      <GastosCopyMonthModal
        isOpen={g.isCopyModalOpen}
        onClose={() => { g.setErrorMsg(null); g.setIsCopyModalOpen(false); }}
        errorMsg={g.errorMsg}
        selectedYear={g.selectedYear}
        selectedMonth={g.selectedMonth}
        copySourceYear={g.copySourceYear}
        setCopySourceYear={g.setCopySourceYear}
        copySourceMonth={g.copySourceMonth}
        setCopySourceMonth={g.setCopySourceMonth}
        copyTargetDate={g.copyTargetDate}
        setCopyTargetDate={g.setCopyTargetDate}
        sourceExpenses={g.sourceExpenses}
        setSourceExpenses={g.setSourceExpenses}
        loadingSource={g.loadingSource}
        submittingCopy={g.submittingCopy}
        onFetchSource={g.fetchSourceExpenses}
        onExecuteCopy={g.handleExecuteCopy}
      />
    </div>
  );
}
