import openpyxl
import json
import re

excel_path = 'Maestro.xlsx'
map_path = 'mapa deposito.xlsx'

wb_map = openpyxl.load_workbook(map_path, data_only=True)
ws_map = wb_map['Hoja 1']

# Mapear cada una de las celdas a su zona física intuitiva basada en las filas y columnas del Excel mapa deposito.xlsx
slots = []

for r in range(1, ws_map.max_row + 1):
    for c in range(1, ws_map.max_column + 1):
        cell = ws_map.cell(row=r, column=c)
        val = cell.value
        if val is not None:
            s_val = str(val).strip()
            if s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']:
                
                # Clasificar zona física en Depósito 1, 2 o 3 según coordenadas del dibujo
                dep_id = 'D1'
                dep_nombre = 'Depósito 1'
                sector = ''
                
                if c >= 20 and r <= 20:
                    dep_id = 'D2'
                    dep_nombre = 'Depósito 2'
                elif r >= 21:
                    if c >= 15 and c <= 30:
                        dep_id = 'D3'
                        dep_nombre = 'Depósito 3'
                    elif c >= 20:
                        dep_id = 'D2'
                        dep_nombre = 'Depósito 2'
                    else:
                        dep_id = 'D1'
                        dep_nombre = 'Depósito 1'

                # Asignar sector y nombre intuitivo según posición en el plano de Excel
                if dep_id == 'D1':
                    if r <= 10 and c >= 14 and c <= 19:
                        sector = 'Cámara 2 Frío'
                    elif r >= 14 and r <= 18 and c >= 9 and c <= 13:
                        sector = 'Cámara 1 Frío'
                    elif r >= 14 and r <= 18 and c >= 14 and c <= 18:
                        sector = 'Cámara 3 Seco'
                    elif r >= 11 and r <= 19 and c <= 8:
                        sector = 'Rack Entrada'
                    elif r >= 24 and c <= 14:
                        sector = 'Góndola Licores'
                    else:
                        sector = 'Nave Principal'

                elif dep_id == 'D2':
                    if r == 8:
                        sector = 'Pared Superior'
                    elif r >= 9 and r <= 17 and c <= 28:
                        sector = 'Racks Azules M1'
                    elif r >= 9 and r <= 17 and c >= 29 and c <= 38:
                        sector = 'Racks Azules M2'
                    elif r >= 9 and r <= 17 and c >= 39:
                        sector = 'Pared Derecha'
                    elif r >= 18 and r <= 21 and c >= 20 and c <= 32:
                        sector = 'Patio Pastas 308'
                    elif r >= 22 and r <= 26 and c >= 20 and c <= 32:
                        sector = 'Patio Aceites Natura'
                    elif r >= 18 and c >= 33:
                        sector = 'Racks Fondo D2'
                    else:
                        sector = 'Nave Secos D2'

                elif dep_id == 'D3':
                    if r <= 25 and c <= 25:
                        sector = 'Patio Leches UAT'
                    elif r >= 26 and c <= 25:
                        sector = 'Patio Papelería'
                    elif c >= 26:
                        sector = 'Racks Fondo D3'
                    else:
                        sector = 'Nave D3'

                # Código visual limpio intuitivo (ej: D1-CAM2-R08C15)
                sec_code = sector.upper().replace(' ', '-').replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
                clean_code = f"{dep_id}-{sec_code}-F{r:02d}C{c:02d}"

                slot_entry = {
                    'code': clean_code,
                    'excel_code': f"{dep_id}-R{r:02d}-C{c:02d}",
                    'dep_id': dep_id,
                    'deposito': dep_nombre,
                    'sector': sector,
                    'row': r,
                    'col': c,
                    'nivel': s_val,
                    'display_label': f"{sector} (Slot F{r:02d}-C{c:02d})"
                }

                slots.append(slot_entry)

print(f"Total slots procesados con etiquetas intuitivas: {len(slots)}")

# Guardar en json
with open('scripts/exact_slots_intuitive.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': slots}, f, indent=2, ensure_ascii=False)

print("✅ Guardado en scripts/exact_slots_intuitive.json")
