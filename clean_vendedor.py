import pandas as pd
import numpy as np

# Load the clean file
file_path = 'Vendedores-Clientes-LIMPIO_v2.xlsx'
df = pd.read_excel(file_path)

# Update Vendedor column
if 'Vendedor' in df.columns:
    # First, handle NaN/empty values
    df['Vendedor'] = df['Vendedor'].fillna('OFICINA')
    
    # Second, replace "PENDIENTE DE RUTA" or "PENDIENTE RUTA"
    df['Vendedor'] = df['Vendedor'].apply(
        lambda x: 'OFICINA' if 'PENDIENTE' in str(x).strip().upper() or str(x).strip() == '' else x
    )

# Save back to a new file to avoid PermissionError if open
output_file = 'Vendedores-Clientes-LIMPIO_v3.xlsx'
df.to_excel(output_file, index=False)
print(f"Updated Vendedor column successfully. Saved as {output_file}")
