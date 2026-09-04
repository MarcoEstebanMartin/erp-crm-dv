import openpyxl
import os
import re
import json
import shutil

def resequence_all():
    excel_maestro = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx'
    excel_nueva = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Lista General-15-08-2026.xlsx'
    fotos_dir = r'C:\Users\Usuario\Desktop\ERP-CRM DV\ARCHIVOS\fotos\Productos'
    uploads_dir = r'C:\Users\Usuario\Desktop\ERP-CRM DV\backend\uploads\products'

    # 1. Leer productos de la nueva lista en orden estricto de aparición
    wb_new = openpyxl.load_workbook(excel_nueva, data_only=True, read_only=True)
    ws_new = wb_new.active

    ordered_products = []
    current_cat = 'ALMACEN'
    current_subcat = ''

    for r in ws_new.iter_rows(values_only=True):
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

        ordered_products.append({
            'name': c0,
            'precio_final': precio,
            'category': current_cat,
            'subcategory': current_subcat
        })

    # 2. Cargar Maestro original para mapear datos adicionales y fotos anteriores por Nombre
    wb_orig = openpyxl.load_workbook(r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro_original.xlsx', data_only=True, read_only=True)
    ws_orig = wb_orig['Productos']
    orig_map = {} # norm_name -> product_data

    for r in list(ws_orig.iter_rows(values_only=True))[1:]:
        if not r or not r[0] or not r[1]: continue
        old_sku = str(r[0]).strip().zfill(4)
        name = str(r[1]).strip()
        if name == 'PRODUCTO': continue
        norm = re.sub(r'\s+', ' ', name.upper())
        orig_map[norm] = {
            'old_sku': old_sku,
            'name': name,
            'costo': r[16] if len(r)>16 else None,
            'rubro': r[13] if len(r)>13 else '',
            'subrubro': r[14] if len(r)>14 else '',
            'proveedor': r[15] if len(r)>15 else '',
            'pesable': r[11] if len(r)>11 else 'NO',
            'units_box': r[4] if len(r)>4 else 1,
            'alicuota': r[9] if len(r)>9 else 21.0,
            'cat_comercial': r[10] if len(r)>10 else 'Almacen'
        }

    # 3. Construir la nueva estructura de Maestro con SKUs correlativos (0001, 0002, ...)
    wb_m = openpyxl.load_workbook(excel_maestro)
    ws_m = wb_m['Productos']
    
    # Limpiar filas existentes preservando el encabezado
    ws_m.delete_rows(2, ws_m.max_row + 1)

    matched_orig_norms = set()
    sku_counter = 1
    image_rename_map = {} # old_filename -> new_filename

    for item in ordered_products:
        norm_name = re.sub(r'\s+', ' ', item['name'].upper())
        orig_data = orig_map.get(norm_name)
        
        if not orig_data:
            # Buscar match parcial
            for m_norm, m_data in orig_map.items():
                if m_norm in matched_orig_norms: continue
                if (len(norm_name)>10 and norm_name in m_norm) or (len(m_norm)>10 and m_norm in norm_name):
                    orig_data = m_data
                    norm_name = m_norm
                    break

        new_sku = str(sku_counter).zfill(4)
        sku_counter += 1

        new_p = item['precio_final']
        precio_sin_iva = round(new_p / 1.21, 2)
        costo = orig_data['costo'] if orig_data and orig_data['costo'] else round(precio_sin_iva / 1.35, 2)
        rubro = orig_data['rubro'] if orig_data and orig_data['rubro'] else (item['category'].split('-')[-1].strip() if '-' in item['category'] else item['category'])
        subrubro = orig_data['subrubro'] if orig_data and orig_data['subrubro'] else item['subcategory']
        pesable = orig_data['pesable'] if orig_data else 'NO'
        units_box = orig_data['units_box'] if orig_data else 1
        cat_comercial = orig_data['cat_comercial'] if orig_data else 'Almacen'
        alicuota = orig_data['alicuota'] if orig_data else 21.0

        if orig_data:
            matched_orig_norms.add(norm_name)
            old_sku = orig_data['old_sku']
            # Registrar renombrado de imagen si existía foto con old_sku
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                old_img_name = f'{old_sku}{ext}'
                if os.path.exists(os.path.join(fotos_dir, old_img_name)):
                    image_rename_map[old_img_name] = f'{new_sku}{ext}'
                    break

        # Escribir en Maestro.xlsx
        row_idx = ws_m.max_row + 1
        ws_m.cell(row=row_idx, column=1, value=new_sku)
        ws_m.cell(row=row_idx, column=2, value=item['name'])
        ws_m.cell(row=row_idx, column=3, value='')
        ws_m.cell(row=row_idx, column=4, value=1)
        ws_m.cell(row=row_idx, column=5, value=units_box)
        ws_m.cell(row=row_idx, column=6, value='SECO' if cat_comercial=='Almacen' else 'FRIO')
        ws_m.cell(row=row_idx, column=7, value=10)
        ws_m.cell(row=row_idx, column=8, value=1)
        ws_m.cell(row=row_idx, column=9, value='DEP1-GENERAL')
        ws_m.cell(row=row_idx, column=10, value=alicuota)
        ws_m.cell(row=row_idx, column=11, value=cat_comercial)
        ws_m.cell(row=row_idx, column=12, value=pesable)
        ws_m.cell(row=row_idx, column=13, value=None)
        ws_m.cell(row=row_idx, column=14, value=rubro)
        ws_m.cell(row=row_idx, column=15, value=subrubro)
        ws_m.cell(row=row_idx, column=16, value=rubro)
        ws_m.cell(row=row_idx, column=17, value=costo)
        ws_m.cell(row=row_idx, column=18, value=35.0)
        ws_m.cell(row=row_idx, column=19, value=precio_sin_iva)
        ws_m.cell(row=row_idx, column=20, value=new_p)
        ws_m.cell(row=row_idx, column=22, value='ACTIVO')

    # Agregar inactivos al final con SKUs 9001, 9002...
    inactive_counter = 9001
    for m_norm, orig_data in orig_map.items():
        if m_norm not in matched_orig_norms:
            inact_sku = str(inactive_counter).zfill(4)
            inactive_counter += 1
            
            row_idx = ws_m.max_row + 1
            ws_m.cell(row=row_idx, column=1, value=inact_sku)
            ws_m.cell(row=row_idx, column=2, value=orig_data['name'])
            ws_m.cell(row=row_idx, column=4, value=1)
            ws_m.cell(row=row_idx, column=5, value=orig_data['units_box'])
            ws_m.cell(row=row_idx, column=10, value=orig_data['alicuota'])
            ws_m.cell(row=row_idx, column=11, value=orig_data['cat_comercial'])
            ws_m.cell(row=row_idx, column=12, value=orig_data['pesable'])
            ws_m.cell(row=row_idx, column=14, value=orig_data['rubro'])
            ws_m.cell(row=row_idx, column=15, value=orig_data['subrubro'])
            ws_m.cell(row=row_idx, column=17, value=orig_data['costo'] or 0)
            ws_m.cell(row=row_idx, column=20, value=0)
            ws_m.cell(row=row_idx, column=22, value='INACTIVO')

    wb_m.save(excel_maestro)

    # 4. Renombrar imágenes manteniendo las fotos asociadas al producto correcto
    temp_fotos_dir = r'C:\Users\Usuario\Desktop\ERP-CRM DV\ARCHIVOS\fotos\Productos_temp'
    if os.path.exists(temp_fotos_dir):
        shutil.rmtree(temp_fotos_dir)
    os.makedirs(temp_fotos_dir, exist_ok=True)

    # Copiar fotos renombradas a carpeta temp
    renamed_count = 0
    for old_img, new_img in image_rename_map.items():
        src = os.path.join(fotos_dir, old_img)
        dst = os.path.join(temp_fotos_dir, new_img)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            renamed_count += 1

    # Reemplazar contenido de ARCHIVOS/fotos/Productos
    for f in os.listdir(fotos_dir):
        os.remove(os.path.join(fotos_dir, f))
    for f in os.listdir(temp_fotos_dir):
        shutil.copy2(os.path.join(temp_fotos_dir, f), os.path.join(fotos_dir, f))
    shutil.rmtree(temp_fotos_dir)

    res = {
        'total_active_ordered': len(ordered_products),
        'total_inactivated': inactive_counter - 9001,
        'renamed_images': renamed_count,
        'sample_order': [
            {'sku': str(i+1).zfill(4), 'name': p['name']} for i, p in enumerate(ordered_products[:10])
        ]
    }
    print(json.dumps(res, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    resequence_all()
