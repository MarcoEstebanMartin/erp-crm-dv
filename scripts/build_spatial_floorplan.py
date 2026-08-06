import json
import openpyxl

wb = openpyxl.load_workbook('mapa deposito.xlsx', data_only=True)
ws = wb['Hoja 1']

grid_matrix = []

# Mapear las 33 filas x 45 columnas exactas de Excel
for r in range(1, ws.max_row + 1):
    row_cells = []
    for c in range(1, ws.max_column + 1):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        s_val = str(val).strip() if val is not None else ""
        
        fill_color = None
        if cell_obj.fill and cell_obj.fill.start_color and cell_obj.fill.start_color.rgb:
            fill_color = str(cell_obj.fill.start_color.rgb)
            
        row_cells.append({
            'row': r,
            'col': c,
            'val': s_val,
            'fill': fill_color
        })
    grid_matrix.append(row_cells)

print(f"Filas generadas: {len(grid_matrix)}, Columnas por fila: {len(grid_matrix[0])}")

with open('scripts/full_excel_matrix.json', 'w', encoding='utf-8') as f:
    json.dump(grid_matrix, f, indent=2)

print("✅ full_excel_matrix.json exportado exitosamente.")
