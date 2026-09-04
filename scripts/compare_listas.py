import openpyxl
import re
import json

def compare():
    # 1. Cargar Maestro.xlsx
    wb_old = openpyxl.load_workbook(r'C:\Users\Usuario\Desktop\ERP-CRM DV\Maestro.xlsx', data_only=True, read_only=True)
    ws_old = wb_old['Productos']
    rows_old = list(ws_old.iter_rows(values_only=True))

    maestro_products = {}
    for idx, r in enumerate(rows_old[1:], start=2):
        if not r or not r[1]:
            continue
        sku = str(r[0]).strip() if r[0] is not None else ''
        name = str(r[1]).strip()
        if not name or name == 'PRODUCTO':
            continue
        norm_name = re.sub(r'\s+', ' ', name.upper())
        
        # Precio final col index 19
        pf_val = r[19] if len(r) > 19 else None
        try:
            precio_final = float(pf_val) if pf_val is not None else None
        except (ValueError, TypeError):
            precio_final = None

        maestro_products[norm_name] = {
            'sku': sku,
            'name': name,
            'precio_final': precio_final,
            'rubro': r[13] if len(r) > 13 else '',
            'subrubro': r[14] if len(r) > 14 else ''
        }

    # 2. Cargar Lista General-15-08-2026.xlsx
    wb_new = openpyxl.load_workbook(r'C:\Users\Usuario\Desktop\ERP-CRM DV\Lista General-15-08-2026.xlsx', data_only=True, read_only=True)
    ws_new = wb_new.active
    rows_new = list(ws_new.iter_rows(values_only=True))

    new_list_products = {}
    current_category = ''
    current_subcat = ''

    for r in rows_new:
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
        new_list_products[norm_name] = {
            'name': c0,
            'precio_final': precio,
            'category': current_category,
            'subcategory': current_subcat
        }

    # Comparación
    price_changes = []
    unchanged = []
    new_in_list = []

    matched_maestro = set()

    for norm_name, data in new_list_products.items():
        if norm_name in maestro_products:
            matched_maestro.add(norm_name)
            old_data = maestro_products[norm_name]
            old_p = old_data['precio_final']
            new_p = data['precio_final']
            if old_p is not None and abs(old_p - new_p) > 0.01:
                price_changes.append({
                    'sku': old_data['sku'],
                    'name': old_data['name'],
                    'old_price': old_p,
                    'new_price': new_p,
                    'diff': round(new_p - old_p, 2),
                    'pct': round(((new_p - old_p)/old_p)*100, 2) if old_p else 0
                })
            else:
                unchanged.append(old_data['name'])
        else:
            # Partial match search
            found = False
            for m_norm, m_data in maestro_products.items():
                if m_norm in matched_maestro:
                    continue
                if norm_name == m_norm or (len(norm_name)>10 and norm_name in m_norm) or (len(m_norm)>10 and m_norm in norm_name):
                    matched_maestro.add(m_norm)
                    old_p = m_data['precio_final']
                    new_p = data['precio_final']
                    if old_p is not None and abs(old_p - new_p) > 0.01:
                        price_changes.append({
                            'sku': m_data['sku'],
                            'name': m_data['name'],
                            'matched_with': data['name'],
                            'old_price': old_p,
                            'new_price': new_p,
                            'diff': round(new_p - old_p, 2),
                            'pct': round(((new_p - old_p)/old_p)*100, 2) if old_p else 0
                        })
                    else:
                        unchanged.append(m_data['name'])
                    found = True
                    break
            if not found:
                new_in_list.append(data)

    missing_in_new = []
    for m_norm, m_data in maestro_products.items():
        if m_norm not in matched_maestro:
            missing_in_new.append(m_data)

    res = {
        'total_maestro': len(maestro_products),
        'total_nueva_lista': len(new_list_products),
        'precios_cambiados_count': len(price_changes),
        'precios_sin_cambio_count': len(unchanged),
        'productos_nuevos_count': len(new_in_list),
        'productos_faltantes_count': len(missing_in_new),
        'sample_price_changes': price_changes[:15],
        'sample_new_in_list': new_in_list[:15],
        'sample_missing': missing_in_new[:15]
    }

    print(json.dumps(res, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    compare()
