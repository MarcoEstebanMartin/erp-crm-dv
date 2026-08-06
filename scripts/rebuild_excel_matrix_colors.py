import json
import openpyxl

wb = openpyxl.load_workbook('mapa deposito.xlsx', data_only=True)
ws = wb['Hoja 1']

matrix = []

for r in range(1, ws.max_row + 1):
    row_data = []
    for c in range(1, ws.max_column + 1):
        cell = ws.cell(row=r, column=c)
        val = str(cell.value).strip() if cell.value is not None else ""
        
        # Extraer color de fondo limpio
        fill_hex = "#ffffff"
        if cell.fill and cell.fill.start_color and cell.fill.start_color.rgb:
            raw_rgb = str(cell.fill.start_color.rgb).upper()
            # si es 00000000 o 000000 o nulo -> es transparente/blanco
            if raw_rgb not in ['00000000', '000000', 'FFFFFFFF', '00FFFFFF']:
                if len(raw_rgb) == 8:
                    fill_hex = f"#{raw_rgb[2:]}"
                elif len(raw_rgb) == 6:
                    fill_hex = f"#{raw_rgb}"

        # Clasificación por rubro y sección para aplicar paleta pastel elegante Stripe/Notion
        is_storage = val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']
        
        # Forzar fondo blanco/limpio para celdas sin relleno especial
        if fill_hex.lower() in ['#000000', '#00000000']:
            fill_hex = '#ffffff'

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

with open('scripts/excel_layout_clean.json', 'w', encoding='utf-8') as f:
    json.dump(data_to_export, f, indent=2, ensure_ascii=False)

print("EXITO: Layout limpio libre de fondos negros exportado a scripts/excel_layout_clean.json.")
