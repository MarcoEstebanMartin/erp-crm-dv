import openpyxl
import os

file_path = 'Maestro.xlsx'
if not os.path.exists(file_path):
    print("Error: No se encuentra Maestro.xlsx")
    exit(1)

wb = openpyxl.load_workbook(file_path)

if 'POSICIONES' in wb.sheetnames:
    del wb['POSICIONES']

ws = wb.create_sheet(title='POSICIONES')

headers = [
    'Codigo_Ubicacion',
    'Deposito',
    'Sector_Zona',
    'Tipo_Estructura',
    'Nivel',
    'Es_Picking',
    'Rubro_Permitido',
    'Observaciones_Fisicas'
]

ws.append(headers)

positions_data = [
    # DEPOSITO 1 - CAMARA 2 FRIO
    ['D1-CAM2-R01-A', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'A (Piso)', 'SI', 'Quesos Tybo / Barra', 'Rack Negro Pared Izquierda (Picking)'],
    ['D1-CAM2-R01-B', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'B (Viga 1)', 'NO', 'Quesos Reserva / Pulmón', 'Rack Negro Pared Izquierda (Pulmón)'],
    ['D1-CAM2-R02-A', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'A (Piso)', 'SI', 'Mozzarella / Gouda', 'Rack Negro Pared Izquierda (Picking)'],
    ['D1-CAM2-R02-B', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'B (Viga 1)', 'NO', 'Mozzarella Reserva', 'Rack Negro Pared Izquierda (Pulmón)'],
    ['D1-CAM2-P01', 'Deposito 1', 'Cámaras Frío 2', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Queso Melincué Barra', 'Pasillo Central Slot 1'],
    ['D1-CAM2-P02', 'Deposito 1', 'Cámaras Frío 2', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Queso Melincué Tybo', 'Pasillo Central Slot 2'],
    ['D1-CAM2-P03', 'Deposito 1', 'Cámaras Frío 2', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Queso Cremoso Remotti', 'Pasillo Central Slot 3'],
    ['D1-CAM2-P04', 'Deposito 1', 'Cámaras Frío 2', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Fiambres / Embutidos', 'Pasillo Central Slot 4'],
    ['D1-CAM2-P05', 'Deposito 1', 'Cámaras Frío 2', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Queso Sardo / Bloque', 'Fondo Cámara Slot 5'],
    ['D1-CAM2-P06', 'Deposito 1', 'Cámaras Frío 2', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Por Salut / Fresco', 'Fondo Cámara Slot 6'],
    ['D1-CAM2-R03-A', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'A (Piso)', 'SI', 'Salames / Jamones / Fiambres', 'Rack Negro Pared Derecha (Picking)'],
    ['D1-CAM2-R03-B', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'B (Viga 1)', 'NO', 'Fiambres Reserva / Cajas', 'Rack Negro Pared Derecha (Pulmón)'],
    ['D1-CAM2-R04-A', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'A (Piso)', 'SI', 'Cremas / Mantecas / Lácteos', 'Rack Negro Pared Derecha (Picking)'],
    ['D1-CAM2-R04-B', 'Deposito 1', 'Cámaras Frío 2', 'Rack 2 Niveles', 'B (Viga 1)', 'NO', 'Mantecas / Cremas Reserva', 'Rack Negro Pared Derecha (Pulmón)'],

    # DEPOSITO 1 - CAMARA 1 FRIO
    ['D1-CAM1-EST-N1', 'Deposito 1', 'Cámara 1 Frío', 'Estantería 5 Niveles', 'N1 (Piso)', 'SI', 'Queso Por Salut / Azul Potes', 'Estantería Roja Nivel 1 (Inferior)'],
    ['D1-CAM1-EST-N2', 'Deposito 1', 'Cámara 1 Frío', 'Estantería 5 Niveles', 'N2', 'SI', 'Quesos Fraccionados / Potes', 'Estantería Roja Nivel 2'],
    ['D1-CAM1-EST-N3', 'Deposito 1', 'Cámara 1 Frío', 'Estantería 5 Niveles', 'N3', 'SI', 'Yogures Potes / Cremas', 'Estantería Roja Nivel 3'],
    ['D1-CAM1-EST-N4', 'Deposito 1', 'Cámara 1 Frío', 'Estantería 5 Niveles', 'N4', 'SI', 'Postres / Sodecar Fraccionados', 'Estantería Roja Nivel 4'],
    ['D1-CAM1-EST-N5', 'Deposito 1', 'Cámara 1 Frío', 'Estantería 5 Niveles', 'N5 (Superior)', 'NO', 'Reposición Potes / Cajas', 'Estantería Roja Nivel 5 (Superior)'],
    ['D1-CAM1-P01', 'Deposito 1', 'Cámara 1 Frío', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Mozzarella Cremigal', 'Piso Frente Estantería 1'],
    ['D1-CAM1-P02', 'Deposito 1', 'Cámara 1 Frío', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Queso Por Salut Melincué', 'Piso Frente Estantería 2'],
    ['D1-CAM1-P03', 'Deposito 1', 'Cámara 1 Frío', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Sodecar / Embutidos', 'Piso Lateral 3'],
    ['D1-CAM1-P04', 'Deposito 1', 'Cámara 1 Frío', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Stock Reserva Frío', 'Piso Lateral 4'],

    # DEPOSITO 1 - CAMARA 3 SECO
    ['D1-CAM3-R01-A', 'Deposito 1', 'Cámara 3 Seco', 'Rack Seco 2 Niveles', 'A (Piso)', 'SI', 'Conservas Cumaná / Puré Tomate', 'Rack Seco Nivel A (Picking)'],
    ['D1-CAM3-R01-B', 'Deposito 1', 'Cámara 3 Seco', 'Rack Seco 2 Niveles', 'B (Viga 1)', 'NO', 'Cumaná Reserva / Cajas', 'Rack Seco Nivel B (Pulmón)'],
    ['D1-CAM3-EST-N1', 'Deposito 1', 'Cámara 3 Seco', 'Estantería Metálica', 'N1 (Piso)', 'SI', 'Aceites Fraccionados', 'Estantería Secos Nivel 1'],
    ['D1-CAM3-EST-N2', 'Deposito 1', 'Cámara 3 Seco', 'Estantería Metálica', 'N2', 'SI', 'Fraccionado Seco Pequeño', 'Estantería Secos Nivel 2'],
    ['D1-CAM3-EST-N3', 'Deposito 1', 'Cámara 3 Seco', 'Estantería Metálica', 'N3', 'SI', 'Galletitas / Especies', 'Estantería Secos Nivel 3'],
    ['D1-CAM3-P01', 'Deposito 1', 'Cámara 3 Seco', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Conservas Cumaná', 'Slot Piso Central 1'],
    ['D1-CAM3-P02', 'Deposito 1', 'Cámara 3 Seco', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Aceites Secos', 'Slot Piso Central 2'],

    # DEPOSITO 1 - RACK 1 ENTRADA & ESTANTERIA APERITIVOS
    ['D1-RACK1-M01-A', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'A (Piso)', 'SI', 'Bebidas / Aperitivos Rotación', 'Módulo 1 Piso (Picking)'],
    ['D1-RACK1-M01-B', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'B (Medio)', 'NO', 'Bebidas Pulmón Nivel 1', 'Módulo 1 Medio (Pulmón)'],
    ['D1-RACK1-M01-C', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'C (Alto)', 'NO', 'Bebidas Pulmón Nivel 2', 'Módulo 1 Alto (Pulmón)'],
    ['D1-RACK1-M02-A', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'A (Piso)', 'SI', "Aperitivos Sernova / Gordon's", 'Módulo 2 Piso (Picking)'],
    ['D1-RACK1-M02-B', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'B (Medio)', 'NO', 'Aperitivos Pulmón Nivel 1', 'Módulo 2 Medio (Pulmón)'],
    ['D1-RACK1-M02-C', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'C (Alto)', 'NO', 'Aperitivos Pulmón Nivel 2', 'Módulo 2 Alto (Pulmón)'],
    ['D1-RACK1-M03-A', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'A (Piso)', 'SI', 'Vinos / Espumantes', 'Módulo 3 Piso (Picking)'],
    ['D1-RACK1-M03-B', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'B (Medio)', 'NO', 'Vinos Pulmón Nivel 1', 'Módulo 3 Medio (Pulmón)'],
    ['D1-RACK1-M03-C', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'C (Alto)', 'NO', 'Vinos Pulmón Nivel 2', 'Módulo 3 Alto (Pulmón)'],
    ['D1-RACK1-M04-A', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'A (Piso)', 'SI', 'Sidras / Jugos', 'Módulo 4 Piso (Picking)'],
    ['D1-RACK1-M04-B', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'B (Medio)', 'NO', 'Jugos / Sidras Pulmón Nivel 1', 'Módulo 4 Medio (Pulmón)'],
    ['D1-RACK1-M04-C', 'Deposito 1', 'Rack 1 Entrada', 'Rack Heavy Duty 3 Niv', 'C (Alto)', 'NO', 'Jugos / Sidras Pulmón Nivel 2', 'Módulo 4 Alto (Pulmón)'],
    ['D1-EST-LIC-N1', 'Deposito 1', 'Estantería Licores', 'Estantería 3 Niveles', 'N1 (Piso)', 'SI', 'Botellas Aperitivos Alta Rotación', 'Nivel 1 Piso'],
    ['D1-EST-LIC-N2', 'Deposito 1', 'Estantería Licores', 'Estantería 3 Niveles', 'N2 (Medio)', 'SI', 'Licores / Fernet / Aperitivos', 'Nivel 2 Medio'],
    ['D1-EST-LIC-N3', 'Deposito 1', 'Estantería Licores', 'Estantería 3 Niveles', 'N3 (Alto)', 'SI', 'Botellas Sueltas / Packs Especiales', 'Nivel 3 Alto'],

    # DEPOSITO 2 - RACKS AZULES & PATIOS DE PISO
    ['D2-RACK-AZUL-M01-A', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'A (Piso)', 'SI', 'Cajas Cumaná / Puré / Tomate', 'Módulo 1 Piso (Picking)'],
    ['D2-RACK-AZUL-M01-B', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'B (Medio)', 'NO', 'Cumaná Reserva', 'Módulo 1 Medio (Pulmón)'],
    ['D2-RACK-AZUL-M01-C', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'C (Alto)', 'NO', 'Cumaná Reserva Masiva', 'Módulo 1 Alto (Pulmón)'],
    ['D2-RACK-AZUL-M02-A', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'A (Piso)', 'SI', 'Latas Durazno / Ensaladas', 'Módulo 2 Piso (Picking)'],
    ['D2-RACK-AZUL-M02-B', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'B (Medio)', 'NO', 'Latas Reserva', 'Módulo 2 Medio (Pulmón)'],
    ['D2-RACK-AZUL-M02-C', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'C (Alto)', 'NO', 'Latas Reserva Masiva', 'Módulo 2 Alto (Pulmón)'],
    ['D2-RACK-AZUL-M03-A', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'A (Piso)', 'SI', 'Legumbres / Arroz / Harinas', 'Módulo 3 Piso (Picking)'],
    ['D2-RACK-AZUL-M03-B', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'B (Medio)', 'NO', 'Harinas / Arroz Reserva', 'Módulo 3 Medio (Pulmón)'],
    ['D2-RACK-AZUL-M03-C', 'Deposito 2', 'Racks Azules', 'Rack Estructural 3 Niv', 'C (Alto)', 'NO', 'Harinas Reserva Masiva', 'Módulo 3 Alto (Pulmón)'],
    ['D2-PISO-FID-01', 'Deposito 2', 'Patio Fideos 308', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Fideos 308 Tallarín', 'Slot Fideos 1'],
    ['D2-PISO-FID-02', 'Deposito 2', 'Patio Fideos 308', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Fideos 308 Guisero', 'Slot Fideos 2'],
    ['D2-PISO-FID-03', 'Deposito 2', 'Patio Fideos 308', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Fideos 308 Moñito', 'Slot Fideos 3'],
    ['D2-PISO-FID-04', 'Deposito 2', 'Patio Fideos 308', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Fideos 308 Nido / Especial', 'Slot Fideos 4'],
    ['D2-PISO-FID-05', 'Deposito 2', 'Patio Fideos 308', 'Slot Piso Pallet', 'Piso', 'NO', 'Pallet Fideos 308 Reserva 1', 'Slot Fideos Reserva 5'],
    ['D2-PISO-FID-06', 'Deposito 2', 'Patio Fideos 308', 'Slot Piso Pallet', 'Piso', 'NO', 'Pallet Fideos 308 Reserva 2', 'Slot Fideos Reserva 6'],
    ['D2-PISO-ACE-01', 'Deposito 2', 'Patio Aceites', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Aceite Natura 900ml', 'Slot Aceites 1'],
    ['D2-PISO-ACE-02', 'Deposito 2', 'Patio Aceites', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Aceite Natura 1.5L', 'Slot Aceites 2'],
    ['D2-PISO-ACE-03', 'Deposito 2', 'Patio Aceites', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Aceite Cañuelas / Cada Día', 'Slot Aceites 3'],
    ['D2-PISO-ACE-04', 'Deposito 2', 'Patio Aceites', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Aceite Mezcla / Girasol Bidón', 'Slot Aceites 4'],
    ['D2-PISO-ACE-05', 'Deposito 2', 'Patio Aceites', 'Slot Piso Pallet', 'Piso', 'NO', 'Pallet Aceite Natura Reserva 1', 'Slot Aceites Reserva 5'],
    ['D2-PISO-ACE-06', 'Deposito 2', 'Patio Aceites', 'Slot Piso Pallet', 'Piso', 'NO', 'Pallet Aceite Natura Reserva 2', 'Slot Aceites Reserva 6'],

    # DEPOSITO 3 - LECHES UAT & PAPELERIA
    ['D3-PISO-UAT-01', 'Deposito 3', 'Patio Leches UAT', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Leche UAT Cremigal Entera', 'Slot Leches UAT 1'],
    ['D3-PISO-UAT-02', 'Deposito 3', 'Patio Leches UAT', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Leche UAT Cremigal Descremada', 'Slot Leches UAT 2'],
    ['D3-PISO-UAT-03', 'Deposito 3', 'Patio Leches UAT', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Leche Chocolatada / Sachet', 'Slot Leches UAT 3'],
    ['D3-PISO-UAT-04', 'Deposito 3', 'Patio Leches UAT', 'Slot Piso Pallet', 'Piso', 'NO', 'Pallet Leche UAT Reserva Masiva', 'Slot Leches UAT Reserva 4'],
    ['D3-PISO-PAPEL-01', 'Deposito 3', 'Patio Papelería', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Papel Higiénico Felpita', 'Slot Papelería 1'],
    ['D3-PISO-PAPEL-02', 'Deposito 3', 'Patio Papelería', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Rollos Cocina RolMayor', 'Slot Papelería 2'],
    ['D3-PISO-PAPEL-03', 'Deposito 3', 'Patio Papelería', 'Slot Piso Pallet', 'Piso', 'SI', 'Pallet Servilletas / Bobinas', 'Slot Papelería 3'],
    ['D3-PISO-PAPEL-04', 'Deposito 3', 'Patio Papelería', 'Slot Piso Pallet', 'Piso', 'NO', 'Pallet Papelería Reserva', 'Slot Papelería Reserva 4'],
    ['D3-RACK-FONDO-M01-A', 'Deposito 3', 'Racks Fondo', 'Rack 2 Niveles', 'A (Piso)', 'SI', 'Reserva Papelería / Fideos', 'Módulo 1 Piso'],
    ['D3-RACK-FONDO-M01-B', 'Deposito 3', 'Racks Fondo', 'Rack 2 Niveles', 'B (Viga 1)', 'NO', 'Reserva Masiva Nivel 1', 'Módulo 1 Alto'],
    ['D3-RACK-FONDO-M02-A', 'Deposito 3', 'Racks Fondo', 'Rack 2 Niveles', 'A (Piso)', 'SI', 'Reserva Envases / Rollos', 'Módulo 2 Piso'],
    ['D3-RACK-FONDO-M02-B', 'Deposito 3', 'Racks Fondo', 'Rack 2 Niveles', 'B (Viga 1)', 'NO', 'Reserva Masiva Nivel 2', 'Módulo 2 Alto']
]

for row in positions_data:
    ws.append(row)

wb.save(file_path)
print(f"EXITO: Solapa POSICIONES cargada con {len(positions_data)} posiciones estructurales.")
