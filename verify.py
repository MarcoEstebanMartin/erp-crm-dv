import pandas as pd

df = pd.read_excel('Vendedores-Clientes.xlsx')
print(df[['Localidad / Pueblo', 'Provincia', 'Dirección']].head(36).to_string())
