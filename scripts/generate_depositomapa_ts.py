import openpyxl
import json
import re

def col2num(col_str):
    num = 0
    for c in col_str:
        num = num * 26 + (ord(c.upper()) - ord('A')) + 1
    return num

def num2col(num):
    col = ""
    while num > 0:
        num, remainder = divmod(num - 1, 26)
        col = chr(65 + remainder) + col
    return col

def parse_ranges(rng_text):
    if not rng_text or rng_text == 'None':
        return []
    tokens = re.split(r'[;,]\s*', rng_text)
    cell_list = []
    for token in tokens:
        token = token.strip()
        if not token:
            continue
        if ':' in token:
            parts = token.split(':')
            c1_str = "".join([ch for ch in parts[0] if ch.isalpha()])
            r1_int = int("".join([ch for ch in parts[0] if ch.isdigit()]))
            c2_str = "".join([ch for ch in parts[1] if ch.isalpha()])
            r2_int = int("".join([ch for ch in parts[1] if ch.isdigit()]))
            min_r, max_r = min(r1_int, r2_int), max(r1_int, r2_int)
            min_c, max_c = min(col2num(c1_str), col2num(c2_str)), max(col2num(c1_str), col2num(c2_str))
            for r in range(min_r, max_r + 1):
                for c in range(min_c, max_c + 1):
                    cell_list.append((r, c))
        else:
            c_str = "".join([ch for ch in token if ch.isalpha()])
            r_int = int("".join([ch for ch in token if ch.isdigit()]))
            cell_list.append((r_int, col2num(c_str)))
    return cell_list

wb = openpyxl.load_workbook('mapadeposito.xlsx', data_only=True)
ws = wb['Hoja 1']

# Parse parameter table from rows 35-45
sectors_config = []
for r in range(35, 46):
    non_storage_str = str(ws.cell(r, 1).value or "").strip()
    total_cells_str = str(ws.cell(r, 2).value or "").strip()
    nombre_str = str(ws.cell(r, 3).value or "").strip()
    abrev_str = str(ws.cell(r, 4).value or "").strip()
    
    if total_cells_str and nombre_str:
        sectors_config.append({
            'nombre': nombre_str,
            'abrev': abrev_str,
            'total_cells': parse_ranges(total_cells_str),
            'non_storage': parse_ranges(non_storage_str)
        })

matrix = []
all_slots = []

BLOCKED_TEXTS = ['DEPOSITO 1', 'DEPOSITO 2', 'DEPOSITO 3', '1.0', '1', '2', '3', '2.0', '3.0', 'CELDAS QUE NO CONTIENEN MERCADERIA', 'CELDAS TOTALES', 'NOMBRE', 'ABREVIACION']

for r in range(1, 33):
    row_cells = []
    for c in range(1, 24):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        s_val = str(val).strip() if val is not None else ""

        display_val = s_val
        if s_val in BLOCKED_TEXTS or s_val.startswith('DEPOSITO') or s_val.isdigit():
            display_val = ""

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

        # Deposito Assignment
        if r <= 7:
            dep_id = 'D1'
            dep_nombre = 'Depósito 1'
        elif r >= 9 and r <= 21:
            dep_id = 'D2'
            dep_nombre = 'Depósito 2'
        else:
            dep_id = 'D3'
            dep_nombre = 'Depósito 3'

        # Chamber Assignment from parameters
        chamber = 'GENERAL'
        if dep_id == 'D2':
            chamber = 'D2_GENERAL'
        elif dep_id == 'D3':
            chamber = 'D3_GENERAL'

        # Priority 1: total_cells
        for sc in sectors_config:
            if (r, c) in sc['total_cells']:
                if 'ESTANTERIA' in sc['nombre']: chamber = 'ESTANTERIA'
                elif 'CAMARA 1' in sc['nombre']: chamber = 'CAMARA_1'
                elif 'CAMARA 2' in sc['nombre']: chamber = 'CAMARA_2'
                elif 'CAMARA 3' in sc['nombre']: chamber = 'CAMARA_3'
                elif 'RACK ENTRADA' in sc['nombre']: chamber = 'RACK_ENTRADA'
                elif 'BAÑO' in sc['nombre'] or 'BANO' in sc['nombre']: chamber = 'BANO'

        # Priority 2 (HIGHER): Explicit non_storage cells
        is_explicit_non_storage = False
        for sc in sectors_config:
            if (r, c) in sc['non_storage']:
                is_explicit_non_storage = True
                if 'ESTANTERIA' in sc['nombre']: chamber = 'ESTANTERIA'
                elif 'CAMARA 1' in sc['nombre']: chamber = 'CAMARA_1'
                elif 'CAMARA 2' in sc['nombre']: chamber = 'CAMARA_2'
                elif 'CAMARA 3' in sc['nombre']: chamber = 'CAMARA_3'
                elif 'RACK ENTRADA' in sc['nombre']: chamber = 'RACK_ENTRADA'
                elif 'BAÑO' in sc['nombre'] or 'BANO' in sc['nombre']: chamber = 'BANO'

        # Storage check
        is_storage_val = s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']
        is_storage = is_storage_val and not is_explicit_non_storage

        col_let = num2col(c)
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

ts_content = f"""// Archivo autogenerado con el plano fiel de mapadeposito.xlsx y su tabla de parámetros
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
