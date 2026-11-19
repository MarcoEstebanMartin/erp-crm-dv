import { describe, expect, it } from 'vitest';
import { standardizePersonaName } from '../normalize';

describe('standardizePersonaName', () => {
  it('convierte nombres de clientes y proveedores a mayúsculas respetando tildes y ñ', () => {
    expect(standardizePersonaName('Juan Lopez')).toBe('JUAN LOPEZ');
    expect(standardizePersonaName('  Juan Manuel Ibarra  ')).toBe('JUAN MANUEL IBARRA');
    expect(standardizePersonaName('Granja Rosalía')).toBe('GRANJA ROSALÍA');
    expect(standardizePersonaName('Peña y Cía. S.A.')).toBe('PEÑA Y CÍA. S.A.');
    expect(standardizePersonaName('YPF Boxes')).toBe('YPF BOXES');
  });
});
