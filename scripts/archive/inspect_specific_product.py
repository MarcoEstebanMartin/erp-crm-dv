import pandas as pd

df = pd.read_excel('IDUO/Productos.xlsx')
row = df[df['PRODUCTO'].str.contains('UNTABLE AZUL', case=False, na=False)]
print(row.to_string())
