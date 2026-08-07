import openpyxl
import json

wb = openpyxl.load_workbook('MAPADEPOSITO.xlsx', data_only=True)
ws = wb.active

matrix = []
all_slots = []
BLOCKED_TEXTS = ['DEPOSITO 1', 'DEPOSITO 2', 'DEPOSITO 3', '1.0', '1', '2', '3', '2.0', '3.0']

for r in range(1, ws.max_row + 1):
    row_cells = []
    for c in range(1, ws.max_column + 1):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        s_val = str(val).strip() if val is not None else ""

        display_val = s_val
        # Ocultar números sueltos de índice (ej: 1, 2, 3) y encabezados "DEPOSITO X"
        if s_val in BLOCKED_TEXTS or s_val.startswith('DEPOSITO') or s_val.isdigit():
            display_val = ""

        # Manejo de color HEX exacto de MAPADEPOSITO.xlsx
        fill_hex = "FFFFFF"
        if cell_obj.fill and cell_obj.fill.start_color and cell_obj.fill.start_color.rgb:
            raw = str(cell_obj.fill.start_color.rgb).upper()
            if raw in ['00000000', '000000', '0']:
                fill_hex = "FFFFFF"
            elif len(raw) == 8:
                fill_hex = raw[2:]
            elif len(raw) == 6:
                fill_hex = raw
            
            if fill_hex == "000000":
                fill_hex = "FFFFFF"

        # Clasificación estricta de Depósitos según filas de MAPADEPOSITO.xlsx
        if r <= 7:
            dep_id = 'D1'
            dep_nombre = 'Depósito 1'
        elif r >= 8 and r <= 22:
            dep_id = 'D2'
            dep_nombre = 'Depósito 2'
        else:
            dep_id = 'D3'
            dep_nombre = 'Depósito 3'

        # Clasificación por Cámara / Sector
        chamber = 'GENERAL'
        upper_val = s_val.upper()
        if 'CAMARA 2' in upper_val or (dep_id == 'D1' and r in [1, 2, 3] and c in [7, 8, 9, 10, 11]):
            chamber = 'CAMARA_2'
        elif 'CAMARA 1' in upper_val or (dep_id == 'D1' and r in [4, 5] and c in [6, 7, 8, 9]):
            chamber = 'CAMARA_1'
        elif 'CAMARA 3' in upper_val or (dep_id == 'D1' and r in [5, 6] and c in [11, 12, 13, 14, 15]):
            chamber = 'CAMARA_3'
        elif 'BAÑO' in upper_val or 'BANO' in upper_val or (dep_id == 'D1' and c in [16, 17] and r == 6):
            chamber = 'BANO'
        elif dep_id == 'D1' and c in [1, 2, 3, 4]:
            chamber = 'ESTANTERIA'
        elif dep_id == 'D2':
            chamber = 'D2_GENERAL'
        elif dep_id == 'D3':
            chamber = 'D3_GENERAL'

        is_storage = s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']

        cell_data = {
            'r': r,
            'c': c,
            'val': display_val,
            'fill': f"#{fill_hex}",
            'is_storage': is_storage,
            'dep_id': dep_id,
            'chamber': chamber
        }
        row_cells.append(cell_data)

        if is_storage:
            slot_code = f"{dep_id}-R{r:02d}-C{c:02d}"
            all_slots.append({
                'code': slot_code,
                'dep_id': dep_id,
                'deposito': dep_nombre,
                'row': r,
                'col': c,
                'nivel': s_val,
                'fill': f"#{fill_hex}",
                'chamber': chamber
            })

    matrix.append(row_cells)

ts_content = f"""// Archivo autogenerado con el plano fiel de MAPADEPOSITO.xlsx
export interface SlotCellData {{
  r: number;
  c: number;
  val: string;
  fill: string;
  is_storage: boolean;
  dep_id: string;
  chamber: string;
}}

export interface DepositSlot {{
  code: string;
  dep_id: string;
  deposito: string;
  row: number;
  col: number;
  nivel: string;
  fill: string;
  chamber: string;
}}

export const DEPOSITO_MATRIX: SlotCellData[][] = {json.dumps(matrix, indent=2, ensure_ascii=False)};

export const DEPOSITO_SLOTS: DepositSlot[] = {json.dumps(all_slots, indent=2, ensure_ascii=False)};

export const SECTORS_INFO: Record<string, {{ label: string; bg: string; color: string; border: string; icon: string }}> = {{
  ESTANTERIA: {{ label: 'Depósito 1 - Estanterías', bg: '#fce7f3', color: '#9d174d', border: '#f472b6', icon: '🏷️' }},
  RACK_ENTRADA: {{ label: 'Rack Entrada', bg: '#fef3c7', color: '#92400e', border: '#f59e0b', icon: '🚪' }},
  CAMARA_2: {{ label: 'Cámara 2 Frío (Quesos)', bg: '#e0f2fe', color: '#0369a1', border: '#0284c7', icon: '❄️' }},
  CAMARA_1: {{ label: 'Cámara 1 Frío (Lácteos)', bg: '#ecfeff', color: '#0e7490', border: '#0891b2', icon: '🥛' }},
  CAMARA_3: {{ label: 'Cámara 3 Seco (Conservas)', bg: '#f3e8ff', color: '#6b21a8', border: '#7e22ce', icon: '📦' }},
  BANO: {{ label: 'Baño / Sanitarios', bg: '#ffe4e6', color: '#9f1239', border: '#fb7185', icon: '🚻' }},
  D2_GENERAL: {{ label: 'Depósito 2 (Sector General)', bg: '#fce5cd', color: '#7c2d12', border: '#f97316', icon: '🏢' }},
  D3_GENERAL: {{ label: 'Depósito 3 (Sector General)', bg: '#d9d2e9', color: '#4c1d95', border: '#8b5cf6', icon: '🏭' }},
  GENERAL: {{ label: 'Pasillo / Circulación', bg: '#ffffff', color: '#334155', border: '#e2e8f0', icon: '📍' }},
}};
"""

with open('frontend/src/components/deposito/depositomapaData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"OK: depositomapaData.ts re-generado exitosamente ({len(all_slots)} slots, {len(matrix)} filas x {len(matrix[0])} columnas)")
