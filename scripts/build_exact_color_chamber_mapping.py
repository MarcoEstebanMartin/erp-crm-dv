import openpyxl
import json

wb = openpyxl.load_workbook('depositomapa.xlsx', data_only=True)
ws = wb['Hoja 1']

slots_classified = []

for r in range(1, ws.max_row + 1):
    for c in range(1, ws.max_column + 1):
        cell_obj = ws.cell(row=r, column=c)
        val = cell_obj.value
        if val is not None:
            s_val = str(val).strip()
            if s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']:
                
                # Obtener color hex exacto de openpyxl
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

                # Clasificar cámara exacta en Depósito 1 por coordenadas físicas de depositomapa.xlsx
                chamber = 'GENERAL'

                if dep_id == 'D1':
                    # Cámara 2 Frío: Filas 1 a 3, Columnas 8 a 12 (Color Celeste)
                    if r <= 3 and c >= 8 and c <= 12:
                        chamber = 'CAMARA_2'
                    # Cámara 1 Frío: Filas 4 a 6, Columnas 5 a 9 (Color Cyan)
                    elif r >= 4 and r <= 6 and c >= 5 and c <= 9:
                        chamber = 'CAMARA_1'
                    # Cámara 3 Seco: Filas 4 a 6, Columnas 10 a 15 (Color Violeta)
                    elif r >= 4 and r <= 6 and c >= 10 and c <= 15:
                        chamber = 'CAMARA_3'
                    elif r >= 4 and r <= 6 and c >= 16:
                        chamber = 'BANO'
                    elif r <= 3 and c <= 4:
                        chamber = 'ENTRADA'
                    elif r >= 4 and c <= 4:
                        chamber = 'RACK_1'

                slot_info = {
                    'code': f"{dep_id}-R{r:02d}-C{c:02d}",
                    'dep_id': dep_id,
                    'row': r,
                    'col': c,
                    'nivel': s_val,
                    'fill': f"#{fill_hex}",
                    'chamber': chamber
                }
                
                slots_classified.append(slot_info)

print(f"Total slots clasificados por cámara: {len(slots_classified)}")
c2_count = len([s for s in slots_classified if s['chamber'] == 'CAMARA_2'])
c1_count = len([s for s in slots_classified if s['chamber'] == 'CAMARA_1'])
c3_count = len([s for s in slots_classified if s['chamber'] == 'CAMARA_3'])

print(f"Cámara 2 Frío: {c2_count} slots exactos")
print(f"Cámara 1 Frío: {c1_count} slots exactos")
print(f"Cámara 3 Seco: {c3_count} slots exactos")

with open('scripts/depositomapa_exact_chambers.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': slots_classified}, f, indent=2, ensure_ascii=False)

print("✅ depositomapa_exact_chambers.json guardado con éxito.")
