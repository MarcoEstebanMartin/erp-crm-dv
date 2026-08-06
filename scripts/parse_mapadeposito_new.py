import openpyxl
import json

wb = openpyxl.load_workbook('MAPADEPOSITO.xlsx', data_only=True)
ws = wb.active

matrix = []
all_slots = []

for r in range(1, ws.max_row + 1):
    row_cells = []
    for c in range(1, ws.max_column + 1):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        s_val = str(val).strip() if val is not None else ""

        # Color hex
        fill_hex = "FFFFFF"
        if cell_obj.fill and cell_obj.fill.start_color and cell_obj.fill.start_color.rgb:
            raw = str(cell_obj.fill.start_color.rgb).upper()
            if len(raw) == 8:
                fill_hex = raw[2:]
            elif len(raw) == 6:
                fill_hex = raw

        # Deposito
        dep_id = 'D1'
        dep_nombre = 'Depósito 1'
        if r <= 11:
            dep_id = 'D1'
            dep_nombre = 'Depósito 1'
        elif r >= 12 and r <= 27:
            dep_id = 'D2'
            dep_nombre = 'Depósito 2'
        else:
            dep_id = 'D3'
            dep_nombre = 'Depósito 3'

        chamber = 'GENERAL'
        if dep_id == 'D1':
            # Estantería: Pink or specific cells (R4C4, R5C4, R6C4, R10C1..C4)
            if (r in [4, 5, 6] and c == 4) or (r == 10 and c in [1, 2, 3, 4]):
                chamber = 'ESTANTERIA'
            elif r == 9 and c in [1, 2, 3, 4]:
                chamber = 'RACK_ENTRADA'
            elif r in [4, 5, 6] and c in [7, 8, 9, 10, 11]:
                chamber = 'CAMARA_2'
            elif r in [8, 9, 10] and c in [6, 7, 8, 9]:
                chamber = 'CAMARA_1'
            elif r in [8, 9, 10] and c in [11, 12, 13, 14, 15]:
                chamber = 'CAMARA_3'

        is_storage = s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']

        cell_data = {
            'r': r,
            'c': c,
            'val': s_val,
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

data_to_export = {
    'rows': ws.max_row,
    'cols': ws.max_column,
    'matrix': matrix,
    'slots_count': len(all_slots)
}

print(f"Total rows: {ws.max_row}, cols: {ws.max_column}, slots: {len(all_slots)}")
d1_slots = [s for s in all_slots if s['dep_id'] == 'D1']
d2_slots = [s for s in all_slots if s['dep_id'] == 'D2']
d3_slots = [s for s in all_slots if s['dep_id'] == 'D3']
print(f"Slots D1: {len(d1_slots)}, Slots D2: {len(d2_slots)}, Slots D3: {len(d3_slots)}")

with open('scripts/depositomapa_layout.json', 'w', encoding='utf-8') as f:
    json.dump(data_to_export, f, indent=2, ensure_ascii=False)

with open('scripts/depositomapa_exact_chambers.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': all_slots}, f, indent=2, ensure_ascii=False)
