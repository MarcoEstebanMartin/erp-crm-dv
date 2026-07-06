import pandas as pd
import numpy as np

# Read both files
df_prov = pd.read_csv('Proveedores.csv', encoding='utf-8-sig', sep=';')
df_gral = pd.read_excel('Vendedores-Clientes.xlsx')

# 1. Clean up column names in Vendedores-Clientes
actual_cols = df_gral.columns.tolist()
new_cols = []
for c in actual_cols:
    c_str = str(c)
    if 'Tel' in c_str and 'fono' in c_str: new_cols.append('Teléfono')
    elif 'Direcci' in c_str and 'n' in c_str: new_cols.append('Dirección')
    elif 'Facturaci' in c_str and 'n' in c_str: new_cols.append('Facturación')
    else: new_cols.append(c_str.strip())
df_gral.columns = new_cols

# 2. Clean CUITs for matching (remove hyphens, spaces, handle nan)
def clean_cuit(c):
    if pd.isna(c):
        return ''
    # Convert to string and remove non-digits
    c = str(c).replace('-', '').replace(' ', '').strip()
    if c.endswith('.0'):
        c = c[:-2]
    return c

df_prov['CUIT_clean'] = df_prov['CUIT'].apply(clean_cuit)
df_gral['CUIT_clean'] = df_gral['CUIT'].apply(clean_cuit)

# Create a set of supplier CUITs
supplier_cuits = set(df_prov[df_prov['CUIT_clean'] != '']['CUIT_clean'])

# 3. Also match by Name (Denominacion) as a fallback
def clean_name(n):
    if pd.isna(n):
        return ''
    return str(n).strip().upper()

df_prov['Name_clean'] = df_prov['Denominacion'].apply(clean_name)
df_gral['Name_clean'] = df_gral['Nombre y Apellido'].apply(clean_name)

supplier_names = set(df_prov[df_prov['Name_clean'] != '']['Name_clean'])

# 4. Update "TIPO DE PERSONAS" if they match
def get_tipo(row):
    # if already set to PROVEEDOR, keep it
    current = str(row['TIPO DE PERSONAS']).upper().strip()
    if current == 'PROVEEDOR':
        return 'PROVEEDOR'
    
    if row['CUIT_clean'] in supplier_cuits and row['CUIT_clean'] != '':
        return 'PROVEEDOR'
    if row['Name_clean'] in supplier_names and row['Name_clean'] != '':
        return 'PROVEEDOR'
    
    return current if current != 'NAN' else ''

df_gral['TIPO DE PERSONAS'] = df_gral.apply(get_tipo, axis=1)

# 5. General Cleanup to make it "prolijo" (neat)
# Reformat CUITs nicely to XX-XXXXXXXX-X if they are exactly 11 digits
def format_cuit(c):
    c = clean_cuit(c)
    if len(c) == 11:
        return f"{c[:2]}-{c[2:10]}-{c[10]}"
    return c

df_gral['CUIT'] = df_gral['CUIT'].apply(format_cuit)

# Trim and uppercase strings in Name, Localidad, Provincia, Dirección
for col in ['Nombre y Apellido', 'Localidad / Pueblo', 'Provincia', 'Dirección', 'Facturación', 'Vendedor']:
    if col in df_gral.columns:
        df_gral[col] = df_gral[col].apply(lambda x: str(x).strip().upper() if pd.notna(x) else np.nan)
        
# Make Email lowercase
if 'Email' in df_gral.columns:
    df_gral['Email'] = df_gral['Email'].apply(lambda x: str(x).strip().lower() if pd.notna(x) else np.nan)

# Clean phone numbers (remove weird characters)
def clean_phone(p):
    if pd.isna(p):
        return np.nan
    p_str = str(p).strip()
    if p_str.endswith('.0'):
        p_str = p_str[:-2]
    return p_str

if 'Teléfono' in df_gral.columns:
    df_gral['Teléfono'] = df_gral['Teléfono'].apply(clean_phone)

# Drop helper columns
df_gral = df_gral.drop(columns=['CUIT_clean', 'Name_clean'])

# Output stats
total_proveedores = (df_gral['TIPO DE PERSONAS'] == 'PROVEEDOR').sum()
print(f"Total PROVEEDOR assigned: {total_proveedores}")

# Save to new Excel file
df_gral.to_excel('Vendedores-Clientes-LIMPIO.xlsx', index=False)
print("Saved cleaned file to Vendedores-Clientes-LIMPIO.xlsx")
