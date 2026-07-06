import pandas as pd

def is_valid_province(prov):
    if pd.isna(prov):
        return True # Handle NaN differently if needed
    prov = str(prov).strip().upper()
    valid_provinces = [
        "BUENOS AIRES", "LA PAMPA", "CORDOBA", "CÓRDOBA", "SANTA FE", 
        "MENDOZA", "SAN LUIS", "ENTRE RIOS", "ENTRE RÍOS", "CABA", 
        "CIUDAD AUTONOMA DE BUENOS AIRES", "RIO NEGRO", "RÍO NEGRO",
        "NEUQUEN", "NEUQUÉN", "CHUBUT", "SANTA CRUZ", "TIERRA DEL FUEGO",
        "LA RIOJA", "CATAMARCA", "TUCUMAN", "TUCUMÁN", "SALTA", "JUJUY",
        "SANTIAGO DEL ESTERO", "CHACO", "FORMOSA", "MISIONES", "CORRIENTES",
        "SAN JUAN"
    ]
    return prov in valid_provinces

def analyze_data(file_path):
    df = pd.read_excel(file_path)
    
    # Identify anomalies
    anomalies = []
    
    for index, row in df.iterrows():
        loc = str(row.get('Localidad / Pueblo', '')).strip().upper()
        prov = str(row.get('Provincia', '')).strip().upper()
        
        issue_reasons = []
        
        # Check Province validity
        if prov and str(prov) != 'NAN' and not is_valid_province(prov):
            issue_reasons.append(f"Provincia inválida o combinada con Localidad: '{prov}'")
            
        # Check for obvious garbage in Localidad
        if "(" in loc or ")" in loc or "CLUB" in loc or "SPORTIVO" in loc:
            issue_reasons.append(f"Localidad sospechosa: '{loc}'")
            
        if issue_reasons:
            # We copy the row as dict and add reasons
            row_dict = row.to_dict()
            row_dict['Fila (Excel)'] = index + 2 # Excel row is index + 2 (1 for header, 1 for 0-index)
            row_dict['Motivos de irregularidad'] = " | ".join(issue_reasons)
            anomalies.append(row_dict)
            
    anomalies_df = pd.DataFrame(anomalies)
    
    # Ensure it's readable, move 'Fila (Excel)' and 'Motivos de irregularidad' to front
    if not anomalies_df.empty:
        cols = ['Fila (Excel)', 'Motivos de irregularidad'] + [c for c in anomalies_df.columns if c not in ['Fila (Excel)', 'Motivos de irregularidad']]
        anomalies_df = anomalies_df[cols]
        
        # Export to CSV for inspection
        anomalies_df.to_csv('irregularidades_detectadas.csv', index=False, encoding='utf-8-sig')
        print(f"Se encontraron {len(anomalies_df)} irregularidades. Guardadas en 'irregularidades_detectadas.csv'.")
        print("Muestra de las primeras 10 irregularidades:")
        print(anomalies_df[['Fila (Excel)', 'Nombre y Apellido', 'Localidad / Pueblo', 'Provincia', 'Motivos de irregularidad']].head(10).to_string())
    else:
        print("No se encontraron irregularidades evidentes.")

if __name__ == "__main__":
    analyze_data('Vendedores-Clientes.xlsx')
