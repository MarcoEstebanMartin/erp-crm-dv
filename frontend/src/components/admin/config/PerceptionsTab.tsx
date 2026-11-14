import React, { useState, useEffect } from 'react';
import { api } from '../../../utils/api';

interface TabMessageProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function PerceptionsTab({ setErrorMsg, setSuccessMsg }: TabMessageProps) {
  const [perceptions, setPerceptions] = useState<any[]>([]);
  const [perceptionForm, setPerceptionForm] = useState({
    name: '',
    aliquot: 0,
    affectsIvaBook: false,
    jurisdiction: '',
  });

  useEffect(() => {
    api.getPerceptions()
      .then((res: any) => setPerceptions(res.perceptions || []))
      .catch(() => setPerceptions([]));
  }, []);

  const handleCreatePerception = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createPerception(perceptionForm);
      setSuccessMsg('Impuesto/Percepción creado correctamente.');
      const res = await api.getPerceptions();
      setPerceptions(res.perceptions || []);
      setPerceptionForm({ name: '', aliquot: 0, affectsIvaBook: false, jurisdiction: '' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar percepción.');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }}>
      <form onSubmit={handleCreatePerception} className="card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Nuevo Impuesto / Percepción</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label>Nombre / Código</label>
            <input
              type="text"
              className="input"
              placeholder="ej: IVA_5329"
              value={perceptionForm.name}
              onChange={(e) => setPerceptionForm({ ...perceptionForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Alícuota (%)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={perceptionForm.aliquot}
              onChange={(e) => setPerceptionForm({ ...perceptionForm, aliquot: Number(e.target.value) })}
              required
            />
          </div>
          <div className="form-group">
            <label>Jurisdicción (IIBB)</label>
            <input
              type="text"
              className="input"
              placeholder="ej: AR-B para Buenos Aires"
              value={perceptionForm.jurisdiction}
              onChange={(e) => setPerceptionForm({ ...perceptionForm, jurisdiction: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={perceptionForm.affectsIvaBook}
              onChange={(e) => setPerceptionForm({ ...perceptionForm, affectsIvaBook: e.target.checked })}
              style={{ width: '16px', height: '16px' }}
            />
            <label style={{ cursor: 'pointer', margin: 0 }}>¿Afecta Libro IVA Ventas?</label>
          </div>
          <button type="submit" className="btn btn-primary">
            Guardar Impuesto
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Impuestos Configurados</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre / Código</th>
                <th>Alícuota</th>
                <th>Jurisdicción</th>
                <th>Libro IVA</th>
              </tr>
            </thead>
            <tbody>
              {perceptions.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{Number(p.aliquot)}%</td>
                  <td>{p.jurisdiction || 'N/A'}</td>
                  <td>{p.affectsIvaBook ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
