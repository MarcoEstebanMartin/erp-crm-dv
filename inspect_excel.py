import pandas as pd

try:
    df = pd.read_excel('Vendedores-Clientes.xlsx')
    print("Columns:")
    print(df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head(5).to_string())
except Exception as e:
    print(f"Error: {e}")
