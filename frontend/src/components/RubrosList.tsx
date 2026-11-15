import { useState, useEffect } from 'react';
import { Plus, Edit, Check, X } from 'lucide-react';
import { api } from '../utils/api';

interface RubrosListProps {
  onRubroUpdated: () => void;
}

export default function RubrosList({ onRubroUpdated }: RubrosListProps) {
  const [rubros, setRubros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMargin, setEditMargin] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editPickingZone, setEditPickingZone] = useState<string>('CAJAS');

  const [isCreating, setIsCreating] = useState(false);
  const [newRubroName, setNewRubroName] = useState('');
  const [newRubroMargin, setNewRubroMargin] = useState('25');
  const [newRubroPickingZone, setNewRubroPickingZone] = useState<string>('CAJAS');

  const fetchRubros = async () => {
    try {
      setLoading(true);
      const data = await api.getRubros();
      setRubros(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener rubros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRubros();
  }, []);

  const handleEditClick = (rubro: any) => {
    setEditingId(rubro.id);
    setEditName(rubro.name);
    setEditPickingZone(rubro.pickingZone || 'CAJAS');
    // Extraer porcentaje base 1 (1.25 -> 25)
    const marginNum = rubro.profitMargin || 1.25;
    const percentage = Math.round((marginNum - 1) * 100);
    setEditMargin(percentage.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    
    const marginVal = Number(editMargin);
    if (isNaN(marginVal)) {
      setErrorMsg('La rentabilidad debe ser un número.');
      return;
    }
    
    // Convertir porcentaje a multiplicador (25 -> 1.25)
    const multiplier = 1 + (marginVal / 100);

    try {
      await api.updateRubro(id, {
        name: editName,
        profitMargin: multiplier,
        pickingZone: editPickingZone
      });
      setSuccessMsg(`Rubro "${editName}" actualizado. Precios recalculados.`);
      setEditingId(null);
      fetchRubros();
      onRubroUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar rubro.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleCreateNew = async () => {
    if (!newRubroName.trim()) {
      setErrorMsg('Ingresa un nombre para el rubro.');
      return;
    }
    const marginVal = Number(newRubroMargin);
    const multiplier = 1 + (isNaN(marginVal) ? 0.25 : marginVal / 100);

    try {
      await api.createRubro({
        name: newRubroName,
        profitMargin: multiplier,
        pickingZone: newRubroPickingZone
      });
      setSuccessMsg(`Rubro "${newRubroName}" creado con éxito.`);
      setIsCreating(false);
      setNewRubroName('');
      setNewRubroMargin('25');
      setNewRubroPickingZone('CAJAS');
      fetchRubros();
      onRubroUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear rubro.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {errorMsg && (
        <div role="alert" style={{ backgroundColor: 'var(--color-danger)', color: '#fff', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" style={{ backgroundColor: 'var(--color-success)', color: '#fff', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Rubros</h2>
        {!isCreating && (
          <button type="button" className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setIsCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            <span>Nuevo Rubro</span>
          </button>
        )}
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label="Rubros y rentabilidad" tabIndex={0} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
            <tr>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ID</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rubro</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rentabilidad (%)</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Zona Picking</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isCreating && (
              <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Nuevo</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <input
                    type="text"
                    className="input"
                    aria-label="Nombre del rubro"
                    placeholder="Nombre del rubro"
                    value={newRubroName}
                    onChange={(e) => setNewRubroName(e.target.value)}
                    autoFocus
                    style={{ padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px' }}
                  />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="input tabular-nums"
                      aria-label="Rentabilidad (%)"
                      value={newRubroMargin}
                      onChange={(e) => setNewRubroMargin(e.target.value)}
                      style={{ width: '80px', padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px', textAlign: 'right' }}
                    />
                    <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <select
                    className="select"
                    aria-label="Zona de picking"
                    value={newRubroPickingZone}
                    onChange={(e) => setNewRubroPickingZone(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px', minWidth: '130px' }}
                  >
                    <option value="CAJAS">Cajas / Secos</option>
                    <option value="FRIO">Frío / Lácteos</option>
                    <option value="TABLA">Bebidas / Tabla</option>
                  </select>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', borderRadius: '6px' }} onClick={handleCreateNew}>
                      <Check size={16} aria-hidden="true" /> Guardar
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', borderRadius: '6px' }} onClick={() => setIsCreating(false)}>
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading && !rubros.length ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>Cargando rubros...</td>
              </tr>
            ) : rubros.length === 0 && !isCreating ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>No hay rubros configurados.</td>
              </tr>
            ) : (
              rubros.map((r: any) => {
                const isEditing = editingId === r.id;
                const marginNum = r.profitMargin || 1.25;
                const percentage = Math.round((marginNum - 1) * 100);

                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="hover-bg-muted">
                    <td className="tabular-nums" style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>#{r.id}</td>
                    
                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          className="input"
                          aria-label={`Nombre de ${r.name}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px' }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                      )}
                    </td>
                    
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="input tabular-nums"
                            aria-label={`Rentabilidad de ${r.name}`}
                            value={editMargin}
                            onChange={(e) => setEditMargin(e.target.value)}
                            style={{ width: '80px', padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px', textAlign: 'right' }}
                          />
                          <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
                        </div>
                      ) : (
                        <span className="tabular-nums" style={{ backgroundColor: 'var(--bg-card)', padding: '4px 12px', borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-primary)', border: '1px solid var(--border-color)' }}>
                          {percentage}%
                        </span>
                      )}
                    </td>
                    
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isEditing ? (
                        <select
                          className="select"
                          aria-label={`Zona de picking de ${r.name}`}
                          value={editPickingZone}
                          onChange={(e) => setEditPickingZone(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px', minWidth: '130px' }}
                        >
                          <option value="CAJAS">Cajas / Secos</option>
                          <option value="FRIO">Frío / Lácteos</option>
                          <option value="TABLA">Bebidas / Tabla</option>
                        </select>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: r.pickingZone === 'FRIO' ? 'rgba(0, 122, 255, 0.08)' : r.pickingZone === 'TABLA' ? 'rgba(255, 149, 0, 0.08)' : 'rgba(142, 142, 147, 0.08)',
                          color: r.pickingZone === 'FRIO' ? '#007AFF' : r.pickingZone === 'TABLA' ? '#FF9500' : '#8E8E93',
                          border: r.pickingZone === 'FRIO' ? '1px solid rgba(0, 122, 255, 0.15)' : r.pickingZone === 'TABLA' ? '1px solid rgba(255, 149, 0, 0.15)' : '1px solid rgba(142, 142, 147, 0.15)'
                        }}>
                          {r.pickingZone === 'FRIO' ? 'Frío' : r.pickingZone === 'TABLA' ? 'Tabla' : 'Cajas'}
                        </span>
                      )}
                    </td>
                    
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-primary" style={{ padding: '6px', borderRadius: '6px' }} onClick={() => handleSaveEdit(r.id)} aria-label="Guardar">
                            <Check size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px', borderRadius: '6px' }} onClick={handleCancelEdit} aria-label="Cancelar">
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          className="btn btn-ghost" 
                          style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-secondary)' }} 
                          aria-label={`Editar ${r.name}`}
                          onClick={() => handleEditClick(r)}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
