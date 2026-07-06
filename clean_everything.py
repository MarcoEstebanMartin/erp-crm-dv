import pandas as pd
import numpy as np
import re

def clean_all(input_file, output_file):
    df = pd.read_excel(input_file)
    
    valid_provinces = ["BUENOS AIRES", "LA PAMPA", "CORDOBA", "CÓRDOBA", "SANTA FE", "MENDOZA", "SAN LUIS", "CABA", "CIUDAD AUTONOMA DE BUENOS AIRES", "MISIONES"]
    valid_provinces.sort(key=len, reverse=True)
    
    valid_localities = [
        "GENERAL VILLEGAS", "RIVADAVIA AMERICA", "AMEGHINO", "EMILIO V. BUNGE", 
        "PIEDRITAS", "INTENDENTE ALVEAR", "BANDERALO", "CEBALLOS", "RUFINO", 
        "CORONEL CHARLONE", "CORONEL GRANADA", "BLAQUIER", "SANTA REGINA", 
        "VILLA SAUZE", "CAÑADA SECA", "TRES LOMAS", "REALICO", "HUINCA RENANCO", 
        "GENERAL ALVEAR", "BERNARDO LARROUDE", "SAN CARLOS DE BOLIVAR", 
        "BUCHARDO", "GENERAL DEHEZA", "FORTIN OLAVARRIA", "SANSINENA", 
        "CHABAS", "CHACABUCO", "EST.BOLIVAR", "EST. CORDOBA", "EST.CUENCA", "EST.TEJEDOR", "EST.JOVITA"
    ]
    valid_localities.sort(key=len, reverse=True)

    def clean_str(val):
        if pd.isna(val) or val == 0 or str(val).strip() == "0":
            return ""
        return str(val).strip().upper()
        
    for i in range(len(df)):
        loc = clean_str(df.at[i, 'Localidad / Pueblo'])
        prov = clean_str(df.at[i, 'Provincia'])
        dir_val = clean_str(df.at[i, 'Dirección'])
        phone = clean_str(df.at[i, 'Teléfono'])
        
        # Phone
        if phone:
            new_phone = re.sub(r'[^\d\+]', '', phone)
            if new_phone != phone:
                df.at[i, 'Teléfono'] = new_phone
                
        # References in locality
        if "(" in loc or ")" in loc or "CLUB" in loc or "SPORTIVO" in loc:
            if dir_val:
                dir_val = f"{dir_val} - Ref: {loc}"
            else:
                dir_val = f"Ref: {loc}"
            loc = ""
            df.at[i, 'Localidad / Pueblo'] = ""

        found_prov = ""
        found_loc = ""
        
        # Extract province from end of dir_val
        for vp in valid_provinces:
            pattern = r'[\s,]*' + vp.replace(' ', r'\s*') + r'$'
            if re.search(pattern, dir_val):
                dir_val = re.sub(pattern, '', dir_val).strip()
                found_prov = vp
                break
                
        # Extract locality from end of dir_val
        for vl in valid_localities:
            pattern = r'[\s,-]*' + vl.replace(' ', r'\s*') + r'$'
            if re.search(pattern, dir_val):
                dir_val = re.sub(pattern, '', dir_val).strip()
                found_loc = vl
                break
        
        # Extract province from end of dir_val again just in case it was "LOC PROV LOC" (unlikely)
        if not found_prov:
             for vp in valid_provinces:
                pattern = r'[\s,]*' + vp.replace(' ', r'\s*') + r'$'
                if re.search(pattern, dir_val):
                    dir_val = re.sub(pattern, '', dir_val).strip()
                    found_prov = vp
                    break

        if found_prov:
            prov = found_prov
        if found_loc:
            loc = found_loc
            
        # Clean up existing Prov if it contains locality (e.g. "GENERAL VILLEGAS BUENOS AIRES")
        for vp in valid_provinces:
            if prov.endswith(vp) and prov != vp:
                extracted_loc = prov.replace(vp, "").strip()
                if extracted_loc in valid_localities or len(extracted_loc) > 3:
                    if not loc:
                        loc = extracted_loc
                prov = vp
                break
                
        # Clean up Loc if it contains province
        for vp in valid_provinces:
            if loc.endswith(vp):
                loc = loc.replace(vp, "").strip()
                prov = vp
                break
                
        # Some special cases like ",EST.BOLIVAR" inside the address
        for vl in valid_localities:
            if vl in dir_val and not loc:
                 # It's inside the address, maybe at the end
                 pass # Too risky to blindly replace inside without boundary checks
                 
        df.at[i, 'Localidad / Pueblo'] = loc if loc else np.nan
        df.at[i, 'Provincia'] = prov if prov else np.nan
        df.at[i, 'Dirección'] = dir_val if dir_val else np.nan

    df.to_excel(output_file, index=False)
    print("Done cleaning addresses!")

if __name__ == "__main__":
    clean_all('Vendedores-Clientes.xlsx.bak', 'Vendedores-Clientes.xlsx')
