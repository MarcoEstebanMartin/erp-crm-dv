import React, { useState, useEffect } from 'react';
import { api } from '../../../utils/api';
import { useConfirm } from '../../../context/ConfirmContext';

interface PricingRulesTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

const inputStyle: React.CSSProperties = {
  height: '36px',
  padding: '6px 12px',
  fontSize: '0.85rem',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  boxSizing: 'border-box',
};

export default function PricingRulesTab({ setErrorMsg, setSuccessMsg }: PricingRulesTabProps) {
  const confirm = useConfirm();
  const [pricingRules, setPricingRules] = useState<{ discountRules: any[]; splitConfigs: any[] }>({
    discountRules: [],
    splitConfigs: [],
  });
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [rubrosList, setRubrosList] = useState<any[]>([]);

  const [discountRuleForm, setDiscountRuleForm] = useState({
    name: '',
    personaId: '' as any,
    priceList: '',
    rubroId: '' as any,
    productId: '' as any,
    billingType: '',
    discount: 0,
  });

  const [splitConfigForm, setSplitConfigForm] = useState({
    personaId: '',
    rubroId: '',
    percentageOfficial: 50,
    percentageInternal: 50,
  });

  useEffect(() => {
    const fetchPricingMetadata = async () => {
      setLoadingPricing(true);
      try {
        const [res, cls, rbs] = await Promise.all([
          api.getPricingRules(),
          api.getPersonas('client'),
          api.getRubros(),
        ]);
        setPricingRules(res || { discountRules: [], splitConfigs: [] });
        setClients(cls || []);
        setRubrosList(rbs || []);
      } catch (e) {
        console.error('Error fetching pricing metadata:', e);
      } finally {
        setLoadingPricing(false);
      }
    };
    fetchPricingMetadata();
  }, []);

  const handleCreateDiscountRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createDiscountRule({
        name: discountRuleForm.name || '',
        personaId: discountRuleForm.personaId ? Number(discountRuleForm.personaId) : null,
        priceList: discountRuleForm.priceList || null,
        rubroId: discountRuleForm.rubroId ? Number(discountRuleForm.rubroId) : null,
        productId: discountRuleForm.productId ? Number(discountRuleForm.productId) : null,
        billingType: discountRuleForm.billingType || null,
        discount: Number(discountRuleForm.discount),
      });
      setSuccessMsg('Regla de descuento creada con éxito.');
      setDiscountRuleForm({ name: '', personaId: '' as any, priceList: '', rubroId: '' as any, productId: '' as any, billingType: '', discount: 0 });
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la regla.');
    }
  };

  const handleDeleteDiscountRule = async (id: number) => {
    if (!await confirm('¿Está seguro de eliminar esta regla de descuento?', { type: 'danger' })) return;
    setErrorMsg(null);
    try {
      await api.deleteDiscountRule(id);
      setSuccessMsg('Regla eliminada.');
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar.');
    }
  };

  const handleCreateSplitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createSplitConfig({
        personaId: Number(splitConfigForm.personaId),
        rubroId: Number(splitConfigForm.rubroId),
        percentageOfficial: Number(splitConfigForm.percentageOfficial),
        percentageInternal: Number(splitConfigForm.percentageInternal),
      });
      setSuccessMsg('División de facturación configurada con éxito.');
      setSplitConfigForm({ personaId: '', rubroId: '', percentageOfficial: 50, percentageInternal: 50 });
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al configurar división.');
    }
  };

  const handleDeleteSplitConfig = async (id: number) => {
    if (!await confirm('¿Está seguro de eliminar esta configuración de división?', { type: 'danger' })) return;
    setErrorMsg(null);
    try {
      await api.deleteSplitConfig(id);
      setSuccessMsg('Configuración de división eliminada.');
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ margin: '0 0 6px 0' }}>🏷️ Reglas de Descuentos & Bonificaciones Especiales</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
          Define descuentos porcentuales específicos para clientes individuales, agrupaciones por lista de precios, rubros de productos o artículos concretos.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px', alignItems: 'start' }}>
          <form onSubmit={handleCreateDiscountRule} style={{ borderRight: '1px solid var(--border-color)', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Nueva Regla de Descuento</h4>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Nombre Descriptivo</label>
              <input type="text" className="input" placeholder="ej: Descuento Quesos 3%" value={discountRuleForm.name} onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, name: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Aplicar a Cliente</label>
              <select className="select" value={discountRuleForm.personaId} onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, personaId: e.target.value })} style={{ ...inputStyle, backgroundColor: '#fff' }}>
                <option value="">-- Todos los Clientes --</option>
                {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>O aplicar a Lista de Precios</label>
              <select className="select" value={discountRuleForm.priceList} onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, priceList: e.target.value })} style={{ ...inputStyle, backgroundColor: '#fff' }}>
                <option value="">-- Ninguna --</option>
                <option value="A">Lista A (Estándar)</option>
                <option value="B">Lista B (Especial)</option>
                <option value="C">Lista C (Distribuidor)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Rubro de Productos</label>
              <select className="select" value={discountRuleForm.rubroId} onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, rubroId: e.target.value })} style={{ ...inputStyle, backgroundColor: '#fff' }}>
                <option value="">-- Todos los Rubros --</option>
                {rubrosList.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Sucursal / Caja</label>
              <select className="select" value={discountRuleForm.billingType} onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, billingType: e.target.value })} style={{ ...inputStyle, backgroundColor: '#fff' }}>
                <option value="">-- Ambas --</option>
                <option value="OFFICIAL">Sucursal A (Oficial)</option>
                <option value="INTERNAL">Sucursal X (Interna)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Porcentaje de Descuento (%)</label>
              <input type="number" step="0.01" className="input" value={discountRuleForm.discount} onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, discount: Number(e.target.value) })} style={inputStyle} required />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              ➕ Crear Regla
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Reglas Activas</h4>
            {loadingPricing ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Cargando reglas...</div>
            ) : pricingRules.discountRules.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay reglas de descuento cargadas.</div>
            ) : (
              <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Nombre / Ámbito</th>
                      <th>Rubro / Prod.</th>
                      <th>Sucursal</th>
                      <th style={{ textAlign: 'right' }}>Descuento</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRules.discountRules.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>
                          {r.name || 'Descuento Sin Nombre'}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                            {r.persona ? `Cliente: ${r.persona.name}` : r.priceList ? `Lista: ${r.priceList}` : 'Global'}
                          </div>
                        </td>
                        <td>{r.product ? `Art: ${r.product.sku}` : r.rubro ? `Rubro: ${r.rubro.name}` : 'Todos'}</td>
                        <td>{r.billingType === 'OFFICIAL' ? 'Sucursal A' : r.billingType === 'INTERNAL' ? 'Sucursal X' : 'Cualquiera'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#27AE60' }}>{Number(r.discount)}%</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteDiscountRule(r.id)} style={{ color: 'var(--color-corp-red)', padding: '4px' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ margin: '0 0 6px 0' }}>⚖️ División Automática de Facturación (Split Billing)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
          Configura reglas para dividir pedidos armados automáticamente entre Oficial (Sucursal A) e Interna (Sucursal X) en los porcentajes definidos.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px', alignItems: 'start' }}>
          <form onSubmit={handleCreateSplitConfig} style={{ borderRight: '1px solid var(--border-color)', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Nueva Regla de División</h4>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Cliente (Requerido)</label>
              <select className="select" value={splitConfigForm.personaId} onChange={(e) => setSplitConfigForm({ ...splitConfigForm, personaId: e.target.value })} style={{ ...inputStyle, backgroundColor: '#fff' }} required>
                <option value="">-- Seleccionar Cliente --</option>
                {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Rubro a Dividir (Requerido)</label>
              <select className="select" value={splitConfigForm.rubroId} onChange={(e) => setSplitConfigForm({ ...splitConfigForm, rubroId: e.target.value })} style={{ ...inputStyle, backgroundColor: '#fff' }} required>
                <option value="">-- Seleccionar Rubro --</option>
                {rubrosList.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>% Sucursal A (Oficial)</label>
                <input type="number" className="input" value={splitConfigForm.percentageOfficial} onChange={(e) => setSplitConfigForm({ ...splitConfigForm, percentageOfficial: Number(e.target.value) })} style={inputStyle} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>% Sucursal X (Interno)</label>
                <input type="number" className="input" value={splitConfigForm.percentageInternal} onChange={(e) => setSplitConfigForm({ ...splitConfigForm, percentageInternal: Number(e.target.value) })} style={inputStyle} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              ➕ Crear Configuración
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Configuraciones de División Activas</h4>
            {loadingPricing ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Cargando divisiones...</div>
            ) : pricingRules.splitConfigs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay configuraciones de división de facturación.</div>
            ) : (
              <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Rubro</th>
                      <th style={{ textAlign: 'center' }}>Distribución A / X</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRules.splitConfigs.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.persona.name}</td>
                        <td>{c.rubro.name}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          <span style={{ color: '#2980B9' }}>{Number(c.percentageOfficial)}% A</span>
                          <span style={{ margin: '0 6px', color: 'var(--text-secondary)' }}>/</span>
                          <span style={{ color: '#E67E22' }}>{Number(c.percentageInternal)}% X</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteSplitConfig(c.id)} style={{ color: 'var(--color-corp-red)', padding: '4px' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
