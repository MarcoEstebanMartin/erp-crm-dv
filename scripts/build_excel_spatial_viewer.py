import json
import openpyxl

wb = openpyxl.load_workbook('mapa deposito.xlsx', data_only=True)
ws = wb['Hoja 1']

# Mapear las 33 filas x 45 columnas con sus valores exactos, colores y fusiones
matrix = []

for r in range(1, ws.max_row + 1):
    row_data = []
    for c in range(1, ws.max_column + 1):
        cell = ws.cell(row=r, column=c)
        val = str(cell.value).strip() if cell.value is not None else ""
        
        # Color hex
        fill_hex = "#ffffff"
        if cell.fill and cell.fill.start_color and cell.fill.start_color.rgb:
            raw_rgb = str(cell.fill.start_color.rgb)
            if len(raw_rgb) == 8: # AARRGGBB
                fill_hex = f"#{raw_rgb[2:]}"
            elif len(raw_rgb) == 6:
                fill_hex = f"#{raw_rgb}"

        # Clasificación de tipo
        is_storage = val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']
        
        row_data.append({
            'r': r,
            'c': c,
            'val': val,
            'fill': fill_hex,
            'is_storage': is_storage
        })
    matrix.append(row_data)

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
    'merged': merged_ranges
}

with open('scripts/excel_layout_exact.json', 'w', encoding='utf-8') as f:
    json.dump(data_to_export, f, indent=2, ensure_ascii=False)

print(f"EXITO: Matriz exacta exportada ({ws.max_row} filas x {ws.max_column} columnas).")
