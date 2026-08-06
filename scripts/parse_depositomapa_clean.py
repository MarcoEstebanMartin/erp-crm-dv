import openpyxl
import json

wb = openpyxl.load_workbook('depositomapa.xlsx', data_only=True)
ws = wb['Hoja 1']

matrix = []
all_slots = []

for r in range(1, ws.max_row + 1):
    row_cells = []
    for c in range(1, ws.max_column + 1):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        s_val = str(val).strip() if val is not None else ""
        
        # Color hex
        fill_hex = "#ffffff"
        if cell_obj.fill and cell_obj.fill.start_color and cell_obj.fill.start_color.rgb:
            raw_rgb = str(cell_obj.fill.start_color.rgb).upper()
            if raw_rgb not in ['00000000', '000000', 'FFFFFFFF', '00FFFFFF']:
                if len(raw_rgb) == 8:
                    fill_hex = f"#{raw_rgb[2:]}"
                elif len(raw_rgb) == 6:
                    fill_hex = f"#{raw_rgb}"

        is_storage = s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']
        
        # Clasificar depósito (1, 2 o 3) según la posición en el nuevo mapa limpio
        dep_id = 'D1'
        dep_nombre = 'Depósito 1'
        if r <= 10:
            dep_id = 'D1'
            dep_nombre = 'Depósito 1'
        elif r >= 11 and r <= 24:
            dep_id = 'D2'
            dep_nombre = 'Depósito 2'
        elif r >= 25:
            dep_id = 'D3'
            dep_nombre = 'Depósito 3'

        cell_data = {
            'r': r,
            'c': c,
            'val': s_val,
            'fill': fill_hex,
            'is_storage': is_storage,
            'dep_id': dep_id
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
                'fill': fill_hex
            })

    matrix.append(row_cells)

# Mapear merged ranges
merged_ranges = []
for m in ws.merged_cells.ranges:
    merged_ranges.append({
        'min_row': m.min_row,
        'max_row': m.max_row,
        'min_col': m.min_col,
        'max_col': m.max_col
    })

data_to_export = {
    'rows': ws.max_row,
    'cols': ws.max_column,
    'matrix': matrix,
    'merged': merged_ranges,
    'slots_count': len(all_slots)
}

with open('scripts/depositomapa_layout.json', 'w', encoding='utf-8') as f:
    json.dump(data_to_export, f, indent=2, ensure_ascii=False)

with open('scripts/depositomapa_slots.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': all_slots}, f, indent=2, ensure_ascii=False)

print(f"EXITO: depositomapa.xlsx procesado ({ws.max_row} filas x {ws.max_column} columnas, {len(all_slots)} slots de almacenamiento).")
