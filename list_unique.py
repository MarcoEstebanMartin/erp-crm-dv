import pandas as pd

df = pd.read_excel('Vendedores-Clientes.xlsx')
localities = df['Localidad / Pueblo'].dropna().astype(str).str.strip().str.upper().unique()
provinces = df['Provincia'].dropna().astype(str).str.strip().str.upper().unique()

print("--- PROVINCIAS ÚNICAS ---")
print(sorted(provinces))

print("\n--- LOCALIDADES ÚNICAS ---")
print(sorted(localities))
