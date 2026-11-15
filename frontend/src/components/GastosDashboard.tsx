import { AlertCircle, Check, Copy, FileSpreadsheet, Plus, X } from 'lucide-react';
import { AVAILABLE_YEARS, getMonthName } from './gastos/gastos.types';
import { useGastosController } from './gastos/useGastosController';
import { GastosOverviewAndTable } from './gastos/GastosOverviewAndTable';
import { GastosCreateModal, GastosImportExcelModal } from './gastos/GastosCreateAndImportModals';
import { GastosCopyMonthModal } from './gastos/GastosCopyMonthModal';

export default function GastosDashboard() {
  const g = useGastosController();
  const anyModalOpen = g.isCreateModalOpen || g.isImportModalOpen || g.isCopyModalOpen;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      {g.errorMsg && !anyModalOpen && (
        <div role="alert" style={{ padding: '12px 16px', backgroundColor: '#fff5f5', color: '#c53030', borderRadius: '6px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid #feb2b2' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{g.errorMsg}</span>
          </span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => g.setErrorMsg(null)} aria-label="Cerrar alerta">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {g.successMsg && (
        <div role="status" style={{ padding: '12px 16px', backgroundColor: '#f0fff4', color: '#22543d', borderRadius: '6px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid #9ae6b4' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Check size={16} style={{ color: '#38a169' }} aria-hidden="true" />
            <span>{g.successMsg}</span>
          </span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => g.setSuccessMsg(null)} aria-label="Cerrar notificación">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Gastos Operativos</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={g.openCopyModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Copy size={15} aria-hidden="true" />
            <span>Copiar Mes</span>
          </button>

          {g.isAdmin && (
            <button type="button" className="btn btn-secondary" onClick={() => { g.setErrorMsg(null); g.setIsImportModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={15} aria-hidden="true" />
              <span>Importar Excel</span>
            </button>
          )}

          <button type="button" className="btn btn-primary" onClick={() => { g.setErrorMsg(null); g.setIsCreateModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={15} aria-hidden="true" />
            <span>Nuevo Gasto</span>
          </button>
        </div>
      </div>

      <search aria-label="Filtrar gastos" className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ minWidth: '120px' }}>
            <label htmlFor="gastos-year" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>Año</label>
            <select id="gastos-year" value={g.selectedYear} onChange={(e) => g.setSelectedYear(Number(e.target.value))} className="select">
              {AVAILABLE_YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <label htmlFor="gastos-month" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>Mes</label>
            <select id="gastos-month" value={g.selectedMonth} onChange={(e) => g.setSelectedMonth(Number(e.target.value))} className="select">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (<option key={m} value={m}>{getMonthName(m)}</option>))}
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <label htmlFor="gastos-category" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>Categoría</label>
            <select id="gastos-category" value={g.filterCategoryId} onChange={(e) => g.setFilterCategoryId(e.target.value)} className="select">
              <option value="">Todas</option>
              {g.categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>

          <div style={{ minWidth: '160px' }}>
            <label htmlFor="gastos-method" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>Medio de Pago</label>
            <select id="gastos-method" value={g.filterPaymentMethod} onChange={(e) => g.setFilterPaymentMethod(e.target.value)} className="select">
              <option value="">Todos</option>
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CHECK">Cheque</option>
            </select>
          </div>
        </div>
      </search>

      <GastosOverviewAndTable
        expenses={g.expenses}
        selectedMonth={g.selectedMonth}
        selectedYear={g.selectedYear}
        totalGasto={g.totalGasto}
        sortedCategories={g.sortedCategories}
        isAdmin={g.isAdmin}
        onDeleteExpense={g.handleDeleteExpense}
      />

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
