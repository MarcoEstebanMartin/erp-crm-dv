import openpyxl
import json

wb = openpyxl.load_workbook('depositomapa.xlsx', data_only=True)
ws = wb['Hoja 1']

slots_classified = []
matrix = []

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

        dep_id = 'D1'
        if r <= 10: dep_id = 'D1'
        elif r >= 11 and r <= 24: dep_id = 'D2'
        else: dep_id = 'D3'

        chamber = 'GENERAL'
        if dep_id == 'D1':
            # Estanterías: Pink cells (EAD1DC)
            # R2C5, R3C5, R4C5, R8C2..R8C5
            if (r in [2, 3, 4] and c == 5) or (r == 8 and c in [2, 3, 4, 5]):
                chamber = 'ESTANTERIA'
            
            # Rack Entrada: R7C2..R7C5
            elif r == 7 and c in [2, 3, 4, 5]:
                chamber = 'RACK_ENTRADA'

            # Cámara 2 Frío (Quesos): Rows 2 to 4, Cols 7 to 11 (Celeste)
            elif r in [2, 3, 4] and c in [7, 8, 9, 10, 11]:
                chamber = 'CAMARA_2'

            # Cámara 1 Frío (Lácteos): Rows 6 to 8, Cols 6 to 9 (Celeste)
            elif r in [6, 7, 8] and c in [6, 7, 8, 9]:
                chamber = 'CAMARA_1'

            # Cámara 3 Seco (Conservas): Rows 6 to 8, Cols 10 to 14 (Violeta)
            elif r in [6, 7, 8] and c in [10, 11, 12, 13, 14]:
                chamber = 'CAMARA_3'

            # Baño: Rows 6 to 8, Col 15 (Rosa oscuro)
            elif r in [6, 7, 8] and c == 15:
                chamber = 'BANO'

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
            slots_classified.append({
                'code': f"{dep_id}-R{r:02d}-C{c:02d}",
                'dep_id': dep_id,
                'row': r,
                'col': c,
                'nivel': s_val,
                'fill': f"#{fill_hex}",
                'chamber': chamber
            })
    matrix.append(row_cells)

print(f"Total slots procesados: {len(slots_classified)}")
print("Desglose Depósito 1:")
print(" - Estanterías:", len([s for s in slots_classified if s['chamber'] == 'ESTANTERIA']))
print(" - Rack Entrada:", len([s for s in slots_classified if s['chamber'] == 'RACK_ENTRADA']))
print(" - Cámara 2 Frío (Quesos):", len([s for s in slots_classified if s['chamber'] == 'CAMARA_2']))
print(" - Cámara 1 Frío (Lácteos):", len([s for s in slots_classified if s['chamber'] == 'CAMARA_1']))
print(" - Cámara 3 Seco (Conservas):", len([s for s in slots_classified if s['chamber'] == 'CAMARA_3']))
print(" - Baño:", len([s for s in slots_classified if s['chamber'] == 'BANO']))

with open('scripts/depositomapa_exact_chambers.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': slots_classified}, f, indent=2, ensure_ascii=False)
