import pandas as pd
import numpy as np
import re

def clean_data(file_path, output_path):
    df = pd.read_excel(file_path)
    
    # Valid provinces
    valid_provinces = ["BUENOS AIRES", "LA PAMPA", "CORDOBA", "SANTA FE", "MENDOZA", "SAN LUIS", "CABA"]
    
    # Helper to clean strings
    def clean_str(val):
        if pd.isna(val) or val == 0 or str(val).strip() == "0":
            return ""
        return str(val).strip().upper()
    
    # Counters for logging
    fixed_provinces = 0
    moved_addresses = 0
    cleaned_phones = 0
    
    for i in range(len(df)):
        loc = clean_str(df.at[i, 'Localidad / Pueblo'])
        prov = clean_str(df.at[i, 'Provincia'])
        dir_val = clean_str(df.at[i, 'Dirección'])
        phone = clean_str(df.at[i, 'Teléfono'])
        
        # 1. Phone number cleanup
        if phone:
            new_phone = re.sub(r'[^\d\+]', '', phone)  # Keep only numbers and +
            if new_phone != phone:
                df.at[i, 'Teléfono'] = new_phone
                cleaned_phones += 1
                
        # 2. Fix Province and Locality mixup
        prov_fixed = False
        for v_prov in valid_provinces:
            if prov.endswith(v_prov) and prov != v_prov:
                # E.g. "GENERAL VILLEGAS BUENOS AIRES" -> "GENERAL VILLEGAS" and "BUENOS AIRES"
                extracted_loc = prov.replace(v_prov, "").strip()
                
                # If there's already something in Locality, check if it's a reference/address
                if loc and loc != extracted_loc:
                    # Move old locality to address if it's a reference
                    if dir_val:
                        dir_val = f"{dir_val} - Ref: {loc}"
                    else:
                        dir_val = loc
                    df.at[i, 'Dirección'] = dir_val
                    moved_addresses += 1
                
                # Assign extracted locality and province
                df.at[i, 'Localidad / Pueblo'] = extracted_loc
                df.at[i, 'Provincia'] = v_prov
                prov_fixed = True
                fixed_provinces += 1
                break
                
        # 3. If province was already valid, but locality has references
        if not prov_fixed and ( "(" in loc or ")" in loc or "CLUB" in loc or "SPORTIVO" in loc ):
            if dir_val:
                dir_val = f"{dir_val} - Ref: {loc}"
            else:
                dir_val = loc
            df.at[i, 'Dirección'] = dir_val
            df.at[i, 'Localidad / Pueblo'] = "" # We clear it, user might have to fill it or leave it blank
            moved_addresses += 1
            
        # Clean up missing or '0' values that became empty strings
        if df.at[i, 'Localidad / Pueblo'] == "":
             df.at[i, 'Localidad / Pueblo'] = np.nan
        if df.at[i, 'Provincia'] == "":
             df.at[i, 'Provincia'] = np.nan
        if df.at[i, 'Dirección'] == "":
             df.at[i, 'Dirección'] = np.nan

    # Save to a new Excel file
    df.to_excel(output_path, index=False)
    
    print(f"Limpieza completada con éxito.")
    print(f"- Provincias separadas de localidades: {fixed_provinces}")
    print(f"- Referencias movidas a la dirección: {moved_addresses}")
    print(f"- Teléfonos formateados: {cleaned_phones}")
    print(f"Archivo guardado en: {output_path}")

if __name__ == "__main__":
    clean_data('Vendedores-Clientes.xlsx', 'Vendedores-Clientes-Limpio.xlsx')
