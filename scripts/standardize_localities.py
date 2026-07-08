import pandas as pd
import numpy as np

def standardize_data(file_path):
    df = pd.read_excel(file_path)
    
    modifications = 0
    
    for i in range(len(df)):
        loc = str(df.at[i, 'Localidad / Pueblo']).strip().upper()
        prov = str(df.at[i, 'Provincia']).strip().upper()
        addr = str(df.at[i, 'Dirección']).strip().upper()
        if addr == 'NAN': addr = ''
        
        orig_loc = loc
        orig_prov = prov
        
        # 1. Clean garbage localities
        if loc in ['NAN', '-', '61', 'SUS', 'DE JULIO 252']:
            if loc == 'DE JULIO 252':
                addr = f"{addr} DE JULIO 252".strip()
            elif loc == '61':
                 addr = f"{addr} 61".strip()
            loc = ''
            
        # 2. Standardize CABA
        if any(x in loc for x in ['CIUDAD AUTONOMA', 'CABA', 'CAPITAL FEDERAL']) or any(x in prov for x in ['CIUDAD AUTONOMA', 'CABA', 'CAPITAL FEDERAL']):
            loc = 'CABA'
            prov = 'CABA'
            
        # 3. Standardize Tres Algarrobos (Estación Cuenca)
        if 'CUENCA' in loc or 'TRES ALGARROBOS' in loc:
            loc = 'TRES ALGARROBOS'
            
        # 4. Standardize Buchardo
        if 'BUCHARDO' in loc:
            loc = 'BUCHARDO'
            
        # 5. Standardize Tejedor
        if 'TEJEDOR' in loc:
            loc = 'CARLOS TEJEDOR'
            
        # 6. Standardize Piedritas
        if 'PIEDRITAS' in loc:
            loc = 'PIEDRITAS'
            
        # 7. Standardize Bolivar
        if 'BOLIVAR' in loc:
            loc = 'SAN CARLOS DE BOLIVAR'
            
        # 8. Standardize Intendente Alvear
        if 'INTENDENTE ALVEAR' in loc:
            loc = 'INTENDENTE ALVEAR'
            
        # 9. Standardize Jovita
        if 'JOVITA' in loc:
            loc = 'JOVITA'
            
        # 10. Standardize Rio Cuarto
        if 'RIO CUARTO' in loc:
            loc = 'RIO CUARTO'
            
        # 11. Standardize General Villegas
        if 'VILLEGAS' in loc:
            loc = 'GENERAL VILLEGAS'
            
        # 12. Standardize Coquimbito
        if 'COQUIMBITO' in loc:
            loc = 'COQUIMBITO'

        # Apply changes
        if loc != orig_loc or prov != orig_prov:
            df.at[i, 'Localidad / Pueblo'] = loc if loc else np.nan
            df.at[i, 'Provincia'] = prov if prov else np.nan
            df.at[i, 'Dirección'] = addr if addr else np.nan
            modifications += 1

    df.to_excel(file_path, index=False)
    print(f"Estandarización completada. Se modificaron {modifications} registros.")

if __name__ == "__main__":
    standardize_data('Vendedores-Clientes.xlsx')
