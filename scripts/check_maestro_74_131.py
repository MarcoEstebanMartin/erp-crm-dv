import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx', data_only=True, read_only=True)
ws = wb['Productos']

for r in list(ws.iter_rows(values_only=True))[1:]:
    if r and r[0] and r[1]:
        s = str(r[0]).strip().zfill(4)
        if s in ['0074', '0131']:
            print(f'SKU: {s} | Name: {r[1]} | Rubro: {r[13]} | Subrubro: {r[14]}')
wb.close()
