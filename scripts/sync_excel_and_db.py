import openpyxl
import re
import json

def sync_maestro():
    excel_maestro = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx'
    excel_nueva = r'C:\Users\Usuario\Desktop\ERP-CRM DV\Lista General-15-08-2026.xlsx'

    # 1. Leer Lista General Nueva
    wb_new = openpyxl.load_workbook(excel_nueva, data_only=True, read_only=True)
    ws_new = wb_new.active

    new_products = {}
    current_category = 'ALMACEN'
    current_subcat = ''

    for r in ws_new.iter_rows(values_only=True):
        if not r or not r[0]:
            continue
        c0 = str(r[0]).strip()
        c1 = r[1]
        
        if c1 is None:
            if re.match(r'^\d+\s*-\s*', c0):
                current_category = c0
            elif c0 not in ['LISTA GENERAL DON VENANCIO 15 - 8 - 2026', 'Producto', 'TODOS LOS PRODUCTOS']:
                current_subcat = c0
            continue
        
        if c0 in ['Producto', 'TODOS LOS PRODUCTOS'] or c1 == 'PRECIO FINAL':
            continue
            
        try:
            precio = float(c1)
        except (ValueError, TypeError):
            continue
            
        norm_name = re.sub(r'\s+', ' ', c0.upper())
        new_products[norm_name] = {
            'name': c0,
            'precio_final': precio,
            'category': current_category,
            'subcategory': current_subcat
        }

    # 2. Cargar y editar Maestro.xlsx (data_only=False para preservar fórmulas)
    wb_m = openpyxl.load_workbook(excel_maestro)
    ws_m = wb_m['Productos']

    # Map existing products in Maestro: norm_name -> row_index
    maestro_map = {}
    highest_sku = 0

    for r in range(2, ws_m.max_row + 1):
        sku_val = ws_m.cell(row=r, column=1).value
        name_val = ws_m.cell(row=r, column=2).value

        if sku_val:
            s_str = str(sku_val).strip()
            if s_str.isdigit():
                num = int(s_str)
                if num > highest_sku:
                    highest_sku = num

        if name_val:
            n_str = str(name_val).strip()
            norm = re.sub(r'\s+', ' ', n_str.upper())
            maestro_map[norm] = r

    updated_count = 0
    unchanged_count = 0
    added_count = 0
    matched_norms = set()

    for norm_name, data in new_products.items():
        row_idx = None
        if norm_name in maestro_map:
            row_idx = maestro_map[norm_name]
            matched_norms.add(norm_name)
        else:
            # Match por inclusión si es lo suficientemente largo
            for m_norm, r_idx in maestro_map.items():
                if m_norm in matched_norms:
                    continue
                if (len(norm_name)>10 and norm_name in m_norm) or (len(m_norm)>10 and m_norm in norm_name):
                    row_idx = r_idx
                    matched_norms.add(m_norm)
                    break
        
        if row_idx:
            # Actualizar precio final en Col 20
            old_p = ws_m.cell(row=row_idx, column=20).value
            new_p = data['precio_final']
            
            try:
                old_p_float = float(old_p) if old_p is not None else 0.0
            except:
                old_p_float = 0.0

            if abs(old_p_float - new_p) > 0.01:
                ws_m.cell(row=row_idx, column=20, value=new_p)
                # Recalcular precio sin IVA (col 19)
                ws_m.cell(row=row_idx, column=19, value=round(new_p / 1.21, 2))
                # Recalcular costo estimado si no tenía o por margen (col 17)
                costo_actual = ws_m.cell(row=row_idx, column=17).value
                if not costo_actual:
                    ws_m.cell(row=row_idx, column=17, value=round((new_p / 1.21) / 1.35, 2))
                # Marcar activo (col 22)
                ws_m.cell(row=row_idx, column=22, value='ACTIVO')
                updated_count += 1
            else:
                ws_m.cell(row=row_idx, column=22, value='ACTIVO')
                unchanged_count += 1
        else:
            # Producto NUEVO -> Agregar al final
            highest_sku += 1
            new_row_idx = ws_m.max_row + 1
            new_sku_str = str(highest_sku).zfill(4)
            new_p = data['precio_final']
            precio_sin_iva = round(new_p / 1.21, 2)
            costo = round(precio_sin_iva / 1.35, 2)
            rubro = data['category'].split('-')[-1].strip() if '-' in data['category'] else data['category']

            ws_m.cell(row=new_row_idx, column=1, value=new_sku_str) # SKU
            ws_m.cell(row=new_row_idx, column=2, value=data['name']) # PRODUCTO
            ws_m.cell(row=new_row_idx, column=3, value='') # TIPO DE QUESO
            ws_m.cell(row=new_row_idx, column=4, value=1) # MINIMO VENTA
            ws_m.cell(row=new_row_idx, column=5, value=1) # UNIDADES POR CAJA
            ws_m.cell(row=new_row_idx, column=6, value='SECO') # ZONA ARMADO
            ws_m.cell(row=new_row_idx, column=7, value=10) # STOCK MINIMO
            ws_m.cell(row=new_row_idx, column=8, value=1) # DEPOSITO
            ws_m.cell(row=new_row_idx, column=9, value='DEP1-GENERAL') # SECTOR
            ws_m.cell(row=new_row_idx, column=10, value=21.0) # ALICUOTA
            ws_m.cell(row=new_row_idx, column=11, value='Almacen') # CAT COMERCIAL
            ws_m.cell(row=new_row_idx, column=12, value='NO') # PESABLE
            ws_m.cell(row=new_row_idx, column=13, value=None) # PESO APROX
            ws_m.cell(row=new_row_idx, column=14, value=rubro) # RUBRO
            ws_m.cell(row=new_row_idx, column=15, value=data['subcategory']) # SUBRUBRO
            ws_m.cell(row=new_row_idx, column=16, value=rubro) # PROVEEDOR
            ws_m.cell(row=new_row_idx, column=17, value=costo) # COSTO
            ws_m.cell(row=new_row_idx, column=18, value=35.0) # RENTABILIDAD
            ws_m.cell(row=new_row_idx, column=19, value=precio_sin_iva) # PRECIO SIN IVA
            ws_m.cell(row=new_row_idx, column=20, value=new_p) # PRECIO FINAL
            ws_m.cell(row=new_row_idx, column=22, value='ACTIVO') # ESTADO

            added_count += 1

    # Inactivos: Productos en Maestro que no vinieron en la nueva lista
    inactivated_count = 0
    for m_norm, r_idx in maestro_map.items():
        if m_norm not in matched_norms:
            ws_m.cell(row=r_idx, column=22, value='INACTIVO')
            inactivated_count += 1

    wb_m.save(excel_maestro)

    res = {
        'updated_prices': updated_count,
        'unchanged_prices': unchanged_count,
        'new_products_added': added_count,
        'inactivated_products': inactivated_count,
        'highest_sku_reached': str(highest_sku).zfill(4)
    }
    print(json.dumps(res, indent=2))

if __name__ == '__main__':
    sync_maestro()
