import pandas as pd

try:
    df = pd.read_excel('IDUO/Productos.xlsx')
    print("Columns:")
    print(df.columns.tolist())
    print("\nFirst 10 rows:")
    print(df.head(10).to_string())
    print("\nUnique categories (Rubro):")
    if 'Rubro' in df.columns:
        print(df['Rubro'].unique())
    elif 'RUBRO' in df.columns:
        print(df['RUBRO'].unique())
except Exception as e:
    print(f"Error: {e}")
