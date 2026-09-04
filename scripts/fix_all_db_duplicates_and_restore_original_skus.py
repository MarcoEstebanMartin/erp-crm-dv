import openpyxl
import shutil
import os
import re
import json

def fix_all():
    excel_maestro = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx'
    excel_bak = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx.bak'
    excel_nueva = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Lista General-15-08-2026.xlsx'

    tmp_bak = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro_bak_fix.xlsx'
    shutil.copyfile(excel_bak, tmp_bak)

    # 1. Cargar Maestro Original (BAK)
    wb_bak = openpyxl.load_workbook(tmp_bak, data_only=True, read_only=True)
    ws_bak = wb_bak['Productos']
    bak_rows = list(ws_bak.iter_rows(values_only=True))[1:]

    orig_by_sku = {}
    orig_by_norm = {}
    used_skus = set()

    for r in bak_rows:
        if not r or not r[0] or not r[1]: continue
        s_val = str(r[0]).strip()
        if s_val.isdigit():
            sku_num = int(s_val)
            sku_str = s_val.zfill(4)
            name = str(r[1]).strip()
            if name == 'PRODUCTO': continue
            norm = re.sub(r'\s+', ' ', name.upper())
            used_skus.add(sku_num)

            p_data = {
                'sku_num': sku_num,
                'sku_str': sku_str,
                'name': name,
                'norm': norm,
                'costo': r[16] if len(r)>16 else None,
                'precio_sin_iva': r[18] if len(r)>18 else None,
                'precio_final': r[19] if len(r)>19 else None,
                'rubro': r[13] if len(r)>13 else '',
                'subrubro': r[14] if len(r)>14 else '',
                'proveedor': r[15] if len(r)>15 else '',
                'pesable': r[11] if len(r)>11 else 'NO',
                'units_box': r[4] if len(r)>4 else 1,
                'alicuota': r[9] if len(r)>9 else 21.0,
                'cat_comercial': r[10] if len(r)>10 else 'Almacen'
            }
            orig_by_sku[sku_str] = p_data
            orig_by_norm[norm] = p_data

    wb_bak.close()

    # 2. Cargar Lista General del 15-08-2026
    wb_new = openpyxl.load_workbook(excel_nueva, data_only=True, read_only=True)
    ws_new = wb_new.active
    rows_new = list(ws_new.iter_rows(values_only=True))

    new_list_items = []
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
        new_list_items.append({
            'name': c0,
            'norm': norm,
            'precio_final': precio,
            'category': current_cat,
            'subcategory': current_subcat
        })

    # 3. Mapear Lista General contra Productos Originales
    matched_orig_skus = set()
    final_products_list = []
    last_known_sku = 0

    for item in new_list_items:
        norm = item['norm']
        orig = orig_by_norm.get(norm)
        if not orig:
            for m_norm, m_data in orig_by_norm.items():
                if m_data['sku_str'] in matched_orig_skus: continue
                if norm == m_norm or (len(norm)>8 and norm in m_norm) or (len(m_norm)>8 and m_norm in norm):
                    orig = m_data
                    break

        if orig:
            matched_orig_skus.add(orig['sku_str'])
            last_known_sku = orig['sku_num']
            final_products_list.append({
                'sku_str': orig['sku_str'],
                'name': orig['name'],
                'precio_final': item['precio_final'],
                'precio_sin_iva': round(item['precio_final'] / 1.21, 2),
                'costo': orig['costo'] or round((item['precio_final'] / 1.21) / 1.35, 2),
                'rubro': orig['rubro'],
                'subrubro': orig['subrubro'],
                'cat_comercial': orig['cat_comercial'],
                'units_box': orig['units_box'],
                'is_new': False,
                'is_active': True
            })
        else:
            cand_sku = last_known_sku + 1
            while cand_sku in used_skus:
                cand_sku += 1
            used_skus.add(cand_sku)
            last_known_sku = cand_sku

            assigned_sku_str = str(cand_sku).zfill(4)
            rubro = item['category'].split('-')[-1].strip() if '-' in item['category'] else item['category']
            precio_sin_iva = round(item['precio_final'] / 1.21, 2)

            final_products_list.append({
                'sku_str': assigned_sku_str,
                'name': item['name'],
                'precio_final': item['precio_final'],
                'precio_sin_iva': precio_sin_iva,
                'costo': round(precio_sin_iva / 1.35, 2),
                'rubro': rubro,
                'subrubro': item['subcategory'],
                'cat_comercial': 'Almacen',
                'units_box': 1,
                'is_new': True,
                'is_active': True
            })

    # Agregar inactivos
    for sku_str, orig in orig_by_sku.items():
        if sku_str not in matched_orig_skus:
            final_products_list.append({
                'sku_str': sku_str,
                'name': orig['name'],
                'precio_final': orig['precio_final'] or 0,
                'precio_sin_iva': orig['precio_sin_iva'] or 0,
                'costo': orig['costo'] or 0,
                'rubro': orig['rubro'],
                'subrubro': orig['subrubro'],
                'cat_comercial': orig['cat_comercial'],
                'units_box': orig['units_box'],
                'is_new': False,
                'is_active': False
            })

    # Reconstruir Maestro.xlsx usando tmp_bak como plantilla
    wb_m = openpyxl.load_workbook(tmp_bak)
    ws_m = wb_m['Productos']

    ws_m.delete_rows(2, ws_m.max_row + 1)
    final_products_list.sort(key=lambda x: int(x['sku_str']))

    for item in final_products_list:
        r_idx = ws_m.max_row + 1
        ws_m.cell(row=r_idx, column=1, value=item['sku_str'])
        ws_m.cell(row=r_idx, column=2, value=item['name'])
        ws_m.cell(row=r_idx, column=4, value=1)
        ws_m.cell(row=r_idx, column=5, value=item['units_box'])
        ws_m.cell(row=r_idx, column=6, value='SECO' if item['cat_comercial']=='Almacen' else 'FRIO')
        ws_m.cell(row=r_idx, column=7, value=10)
        ws_m.cell(row=r_idx, column=8, value=1)
        ws_m.cell(row=r_idx, column=9, value='DEP1-GENERAL')
        ws_m.cell(row=r_idx, column=10, value=21.0)
        ws_m.cell(row=r_idx, column=11, value=item['cat_comercial'])
        ws_m.cell(row=r_idx, column=12, value='NO')
        ws_m.cell(row=r_idx, column=14, value=item['rubro'])
        ws_m.cell(row=r_idx, column=15, value=item['subrubro'])
        ws_m.cell(row=r_idx, column=16, value=item['rubro'])
        ws_m.cell(row=r_idx, column=17, value=item['costo'])
        ws_m.cell(row=r_idx, column=18, value=35.0)
        ws_m.cell(row=r_idx, column=19, value=item['precio_sin_iva'])
        ws_m.cell(row=r_idx, column=20, value=item['precio_final'])
        ws_m.cell(row=r_idx, column=22, value='ACTIVO' if item['is_active'] else 'INACTIVO')

    wb_m.save(excel_maestro)
    wb_m.close()
    if os.path.exists(tmp_bak): os.remove(tmp_bak)

    res = {
        'total_final_products': len(final_products_list),
        'original_matched': len(matched_orig_skus),
        'truly_new_in_gaps': len([p for p in final_products_list if p['is_new']]),
        'inactivated': len([p for p in final_products_list if not p['is_active']]),
        'sku_0131': next((p for p in final_products_list if p['sku_str']=='0131'), None)
    }
    print(json.dumps(res, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    fix_all()
