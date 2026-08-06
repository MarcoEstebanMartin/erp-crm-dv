import openpyxl
import json

wb = openpyxl.load_workbook('mapa deposito.xlsx', data_only=True)
ws = wb['Hoja 1']

merged = [str(m) for m in ws.merged_cells.ranges]

cells = []
storage_slots = []

for r in range(1, ws.max_row + 1):
    for c in range(1, ws.max_column + 1):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        if val is not None:
            s_val = str(val).strip()
            # obtener color de fondo si existe
            fill_color = None
            if cell_obj.fill and cell_obj.fill.start_color and cell_obj.fill.start_color.rgb:
                fill_color = str(cell_obj.fill.start_color.rgb)
            
            entry = {
                'row': r,
                'col': c,
                'val': s_val,
                'fill': fill_color
            }
            cells.append(entry)

            if s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']:
                storage_slots.append(entry)

print(f"Total celdas con datos: {len(cells)}")
print(f"Total celdas de almacenamiento (slots A, A-B, A-B-C, etc.): {len(storage_slots)}")
print(f"Merged ranges: {len(merged)}")

with open('scripts/parsed_map_cells.json', 'w', encoding='utf-8') as f:
    json.dump({'cells': cells, 'storage_slots': storage_slots, 'merged': merged}, f, indent=2, ensure_ascii=False)

print("✅ Guardado en scripts/parsed_map_cells.json")
