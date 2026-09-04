import openpyxl
import os
import re
import json
import shutil

def restore_and_apply_gaps():
    excel_maestro = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx'
    excel_bak = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro_bak.xlsx'
    excel_nueva = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Lista General-15-08-2026.xlsx'

    # 1. Cargar Maestro_bak (Estructura original intacta)
    wb_bak = openpyxl.load_workbook(excel_bak, data_only=False)
    ws_bak = wb_bak['Productos']
    bak_rows = list(ws_bak.iter_rows(values_only=True))[1:]

    orig_by_norm = {}
    used_skus = set()

    for idx, r in enumerate(bak_rows, start=2):
        if not r or not r[0] or not r[1]: continue
        s_val = str(r[0]).strip()
        if s_val.isdigit():
            sku_num = int(s_val)
            name = str(r[1]).strip()
            if name == 'PRODUCTO': continue
            norm = re.sub(r'\s+', ' ', name.upper())
            used_skus.add(sku_num)
            
            orig_by_norm[norm] = {
                'row_idx': idx,
                'sku_num': sku_num,
                'sku_str': s_val.zfill(4),
                'name': name,
                'costo': r[16] if len(r)>16 else None,
                'precio_sin_iva': r[18] if len(r)>18 else None,
                'precio_final': r[19] if len(r)>19 else None,
                'rubro': r[13] if len(r)>13 else '',
                'subrubro': r[14] if len(r)>14 else '',
                'row_data': list(r)
            }

    # 2. Cargar Lista General del 15-08-2026 en orden
    wb_new = openpyxl.load_workbook(excel_nueva, data_only=True, read_only=True)
    ws_new = wb_new.active
    rows_new = list(ws_new.iter_rows(values_only=True))

    new_prods = []
    current_cat = ''
    current_subcat = ''

    for r in rows_new:
        if not r or not r[0]: continue
        c0 = str(r[0]).strip()
        c1 = r[1]
        
        if c1 is None:
            if re.match(r'^\d+\s*-\s*', c0):
                current_cat = c0
            elif c0 not in ['LISTA GENERAL DON VENANCIO 15 - 8 - 2026', 'Producto', 'TODOS LOS PRODUCTOS']:
                current_subcat = c0
            continue
        
        if c0 in ['Producto', 'TODOS LOS PRODUCTOS'] or c1 == 'PRECIO FINAL':
            continue
            
        try:
            precio = float(c1)
        except (ValueError, TypeError):
            continue

        norm = re.sub(r'\s+', ' ', c0.upper())
        new_prods.append({
            'name': c0,
            'norm': norm,
            'precio_final': precio,
            'category': current_cat,
            'subcategory': current_subcat
        })

    # 3. Asignar SKUs respetando saltos (gaps)
    # Mantenemos workbook Maestro original cargado
    wb_m = openpyxl.load_workbook(excel_bak) # Usar bak como plantilla limpia
    ws_m = wb_m['Productos']

    matched_norms = set()
    assigned_new_products = []
    last_known_sku = 0

    # Primero actualizar precios de los productos que ya existen
    for item in new_prods:
        norm = item['norm']
        orig_info = orig_by_norm.get(norm)
        if not orig_info:
            for m_norm, m_data in orig_by_norm.items():
                if (len(norm)>10 and norm in m_norm) or (len(m_norm)>10 and m_norm in norm):
                    orig_info = m_data
                    norm = m_norm
                    break

        if orig_info:
            matched_norms.add(norm)
            last_known_sku = orig_info['sku_num']
            # Actualizar precio en la fila original de Maestro
            row_idx = orig_info['row_idx']
            new_p = item['precio_final']
            ws_m.cell(row=row_idx, column=20, value=new_p)
            ws_m.cell(row=row_idx, column=19, value=round(new_p / 1.21, 2))
            ws_m.cell(row=row_idx, column=22, value='ACTIVO')
        else:
            # Producto NUEVO: buscar el próximo SKU disponible en el salto (gap)
            cand_sku = last_known_sku + 1
            while cand_sku in used_skus:
                cand_sku += 1
            used_skus.add(cand_sku)
            last_known_sku = cand_sku

            assigned_sku_str = str(cand_sku).zfill(4)
            assigned_new_products.append({
                'sku_str': assigned_sku_str,
                'name': item['name'],
                'price': item['precio_final'],
                'category': item['category'],
                'subcategory': item['subcategory']
            })

    # Marcar los productos de Maestro que NO vinieron en la nueva lista como INACTIVOS
    inactivated_count = 0
    for norm, orig_info in orig_by_norm.items():
        if norm not in matched_norms:
            row_idx = orig_info['row_idx']
            ws_m.cell(row=row_idx, column=22, value='INACTIVO')
            inactivated_count += 1

    # Insertar los productos nuevos al final del archivo Maestro.xlsx con sus SKUs asignados en los gaps
    for item in assigned_new_products:
        row_idx = ws_m.max_row + 1
        new_p = item['price']
        precio_sin_iva = round(new_p / 1.21, 2)
        costo = round(precio_sin_iva / 1.35, 2)
        rubro = item['category'].split('-')[-1].strip() if '-' in item['category'] else item['category']

        ws_m.cell(row=row_idx, column=1, value=item['sku_str'])
        ws_m.cell(row=row_idx, column=2, value=item['name'])
        ws_m.cell(row=row_idx, column=4, value=1)
        ws_m.cell(row=row_idx, column=5, value=1)
        ws_m.cell(row=row_idx, column=6, value='SECO')
        ws_m.cell(row=row_idx, column=7, value=10)
        ws_m.cell(row=row_idx, column=8, value=1)
        ws_m.cell(row=row_idx, column=9, value='DEP1-GENERAL')
        ws_m.cell(row=row_idx, column=10, value=21.0)
        ws_m.cell(row=row_idx, column=11, value='Almacen')
        ws_m.cell(row=row_idx, column=12, value='NO')
        ws_m.cell(row=row_idx, column=14, value=rubro)
        ws_m.cell(row=row_idx, column=15, value=item['subcategory'])
        ws_m.cell(row=row_idx, column=16, value=rubro)
        ws_m.cell(row=row_idx, column=17, value=costo)
        ws_m.cell(row=row_idx, column=18, value=35.0)
        ws_m.cell(row=row_idx, column=19, value=precio_sin_iva)
        ws_m.cell(row=row_idx, column=20, value=new_p)
        ws_m.cell(row=row_idx, column=22, value='ACTIVO')

    wb_m.save(excel_maestro)

    res = {
        'total_active_list': len(new_prods),
        'existing_updated': len(matched_norms),
        'new_assigned_in_gaps': len(assigned_new_products),
        'inactivated_missing': inactivated_count,
        'edam_sku': [p['sku_str'] for p in assigned_new_products if 'EDAM' in p['name'].upper()],
        'assigned_sample': assigned_new_products[:10]
    }
    print(json.dumps(res, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    restore_and_apply_gaps()
