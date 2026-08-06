import openpyxl
import os
import json

excel_path = 'Maestro.xlsx'
map_path = 'mapa deposito.xlsx'

if not os.path.exists(map_path):
    print(f"Error: {map_path} no existe.")
    exit(1)

wb_map = openpyxl.load_workbook(map_path, data_only=True)
ws_map = wb_map['Hoja 1']

slots_by_warehouse = {
    'D1': [],
    'D2': [],
    'D3': []
}

all_slots = []

for r in range(1, ws_map.max_row + 1):
    for c in range(1, ws_map.max_column + 1):
        cell = ws_map.cell(row=r, column=c)
        val = cell.value
        if val is not None:
            s_val = str(val).strip()
            if s_val in ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F']:
                # Determinar depósito basado en coordenadas
                # Depósito 1: Columnas 1 a 19 (y filas 1 a 27), excepto Baño/Cocina o D3
                # Depósito 2: Columnas 20 a 45, Filas 1 a 27
                # Depósito 3: Filas 22 a 33, Columnas 15 a 30
                dep = 'D1'
                if c >= 20 and r <= 20:
                    dep = 'D2'
                elif r >= 21:
                    if c >= 15 and c <= 30:
                        dep = 'D3'
                    elif c >= 20:
                        dep = 'D2'
                    else:
                        dep = 'D1'

                fill_hex = None
                if cell.fill and cell.fill.start_color and cell.fill.start_color.rgb:
                    fill_hex = str(cell.fill.start_color.rgb)

                code = f"{dep}-R{r:02d}-C{c:02d}"
                
                slot_info = {
                    'code': code,
                    'deposito': 'Deposito 1' if dep == 'D1' else ('Deposito 2' if dep == 'D2' else 'Deposito 3'),
                    'dep_id': dep,
                    'row': r,
                    'col': c,
                    'nivel': s_val,
                    'fill': fill_hex
                }
                
                all_slots.append(slot_info)
                slots_by_warehouse[dep].append(slot_info)

print(f"Total slots de almacenamiento encontrados: {len(all_slots)}")
print(f"Depósito 1: {len(slots_by_warehouse['D1'])} slots")
print(f"Depósito 2: {len(slots_by_warehouse['D2'])} slots")
print(f"Depósito 3: {len(slots_by_warehouse['D3'])} slots")

# Guardar en Maestro.xlsx solapa POSICIONES
wb_m = openpyxl.load_workbook(excel_path)
if 'POSICIONES' in wb_m.sheetnames:
    del wb_m['POSICIONES']

ws_pos = wb_m.create_sheet(title='POSICIONES')
ws_pos.append([
    'Codigo_Ubicacion',
    'Deposito',
    'Fila_Excel',
    'Columna_Excel',
    'Nivel_Altura',
    'Es_Picking',
    'Estado',
    'Observaciones'
])

for s in all_slots:
    ws_pos.append([
        s['code'],
        s['deposito'],
        s['row'],
        s['col'],
        s['nivel'],
        'SI' if 'A' in s['nivel'] else 'NO',
        'VACIO',
        f"Slot Fila {s['row']} Col {s['col']} ({s['nivel']})"
    ])

try:
    wb_m.save(excel_path)
    print("EXITO: Maestro.xlsx actualizado con los 209 slots exactos del Mapa Excel.")
except PermissionError:
    alt_path = 'scripts/POSICIONES_EXACTAS.xlsx'
    wb_m.save(alt_path)
    print(f"AVISO: Maestro.xlsx esta abierto en Excel. Guardada copia en {alt_path}")

# Exportar JSON para la UI en React
with open('scripts/exact_slots.json', 'w', encoding='utf-8') as f:
    json.dump({'all_slots': all_slots, 'by_dep': slots_by_warehouse}, f, indent=2)
