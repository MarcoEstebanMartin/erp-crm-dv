import openpyxl

file_path = 'Maestro.xlsx'
wb = openpyxl.load_workbook(file_path)

if 'Inventario Inicial' in wb.sheetnames:
    del wb['Inventario Inicial']

ws = wb.create_sheet(title='Inventario Inicial')

headers = [
    'SKU',
    'PRODUCTO',
    'DEPOSITO',
    'UBICACION EXACTA',
    'NUMERO_LOTE',
    'FECHA_VENCIMIENTO',
    'CAJAS_CERRADAS',
    'UNIDADES_SUELTAS',
    'OBSERVACIONES'
]

ws.append(headers)

demo_stock_data = [
    # DEPOSITO 1 - CAMARA 2 FRIO
    [1, 'MELINCUE BARRA TYBO x KG', 1, 'D1-CAM2-P01', 'L-240810', '2026-12-30', 40, 0, 'Pallet completo pasillo central slot 1'],
    [8, 'MELINCUE MOZZARELLA BARRA x KG', 1, 'D1-CAM2-P02', 'L-240815', '2026-11-25', 30, 0, 'Pallet completo pasillo central slot 2'],
    [3, 'MELINCUE CREMOSO x KG', 1, 'D1-CAM2-R01-A', 'L-240818', '2026-10-15', 15, 4, 'Rack negro pared izquierda nivel A'],
    [3, 'MELINCUE CREMOSO x KG', 1, 'D1-CAM2-R01-B', 'L-240825', '2027-01-10', 20, 0, 'Rack negro pared izquierda nivel B (Pulmón)'],

    # DEPOSITO 1 - CAMARA 1 FRIO
    [14, 'MELINCUE POR SALUT x KG', 1, 'D1-CAM1-EST-N1', 'L-240822', '2026-10-05', 10, 8, 'Estantería roja nivel 1 (Picking)'],
    [62, 'CREMIGAL MOZZARELLA CILINDRO x KG', 1, 'D1-CAM1-P01', 'L-240830', '2026-11-30', 25, 0, 'Pallet piso frente estantería'],

    # DEPOSITO 1 - CAMARA 3 SECO
    [132, 'CUMANA TOMATE PERITA ENT. x 400gr', 1, 'D1-CAM3-R01-A', 'L-240701', '2027-06-30', 50, 0, 'Rack seco nivel A'],
    [121, 'CUMANA ARVEJAS LATA x300gr', 1, 'D1-CAM3-P01', 'L-240705', '2027-07-15', 35, 0, 'Pallet piso central conservas'],

    # DEPOSITO 1 - RACK 1 ENTRADA & APERITIVOS
    [439, 'SERNOVA VODKA x700ml', 1, 'D1-RACK1-M02-A', 'L-240510', '2028-12-31', 20, 6, 'Módulo 2 piso (Picking)'],
    [437, "GORDON`S GIN x700ml", 1, 'D1-EST-LIC-N1', 'L-240512', '2028-12-31', 12, 4, 'Estantería licores nivel 1'],

    # DEPOSITO 2 - RACKS AZULES Y PATIOS DE PISO
    [179, 'NATURA ACEITE PVCx900CC', 2, 'D2-PISO-ACE-01', 'L-240601', '2027-05-30', 60, 0, 'Pallet Aceites Slot 1'],
    [176, 'NATURA ACEITE PVCx1500CC', 2, 'D2-PISO-ACE-02', 'L-240605', '2027-05-30', 45, 0, 'Pallet Aceites Slot 2'],

    # DEPOSITO 3 - LECHES UAT Y PAPELERIA
    [33, 'LECHE UAT ENTERA SACHET x LT CREMIGAL', 3, 'D3-PISO-UAT-01', 'L-240801', '2026-10-30', 80, 0, 'Pallet Leches UAT Slot 1'],
    [32, 'LECHE UAT DESC. SACHET x LT CREMIGAL', 3, 'D3-PISO-UAT-02', 'L-240802', '2026-10-30', 70, 0, 'Pallet Leches UAT Slot 2']
]

for row in demo_stock_data:
    ws.append(row)

wb.save(file_path)
print(f"EXITO: Solapa 'Inventario Inicial' poblada con {len(demo_stock_data)} lotes de demostracion.")
