import pandas as pd

df = pd.read_excel('Vendedores-Clientes.xlsx')
localities = df['Localidad / Pueblo'].dropna().astype(str).str.strip().str.upper().unique()
print("Unique localities found:")
print(sorted([loc for loc in localities if len(loc) > 2]))
