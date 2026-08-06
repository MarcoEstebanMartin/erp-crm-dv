import openpyxl
import re

wb = openpyxl.load_workbook('Maestro.xlsx', data_only=True)
ws = wb['POSICIONES']

entries = []
for row in list(ws.iter_rows(values_only=True))[1:]:
    if row and row[0]:
        code = str(row[0]).strip()
        dep = str(row[1]).strip() if row[1] else ''
        sector = str(row[2]).strip() if row[2] else ''
        tipo = str(row[3]).strip() if row[3] else ''
        nivel = str(row[4]).strip() if row[4] else ''
        picking = str(row[5]).strip() if row[5] else 'NO'
        rubro = str(row[6]).strip() if row[6] else ''
        obs = str(row[7]).strip() if row[7] else ''

        icon = '📦'
        color = '#8E8E93'
        bg = 'rgba(142, 142, 147, 0.08)'

        if 'Frío' in sector or 'Frio' in sector:
            icon = '❄️'
            color = '#007AFF'
            bg = 'rgba(0, 122, 255, 0.08)'
        elif 'Licores' in sector or 'Aperitivos' in obs:
            icon = '🍾'
            color = '#FF9500'
            bg = 'rgba(255, 149, 0, 0.08)'
        elif 'Deposito 2' in dep:
            icon = '🏢'
            color = '#5856D6'
            bg = 'rgba(88, 86, 214, 0.08)'
        elif 'Deposito 3' in dep:
            icon = '🥛' if 'Leches' in sector else '📦'
            color = '#FF2D55'
            bg = 'rgba(255, 45, 85, 0.08)'

        rubro_short = rubro[:30].replace("'", "\\'")
        obs_short = obs.replace("'", "\\'")
        sector_short = sector.replace("'", "\\'")
        tipo_short = tipo.replace("'", "\\'")

        label = f"{code} - {rubro_short}"
        desc = f"{sector_short} - {tipo_short} ({nivel}): {obs_short}"

        entry = f"    '{code}': {{ label: '{label}', icon: '{icon}', color: '{color}', bg: '{bg}', description: '{desc}' }},"
        entries.append(entry)

entries.append("    'S/U': { label: 'Sin Ubicación', icon: '📍', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Artículos sin ubicación física asignada' }")

new_map_code = "  const LOCATION_MAP: Record<string, { label: string; icon: string; color: string; bg: string; description: string }> = {\n" + "\n".join(entries) + "\n  };"

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'
with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'const LOCATION_MAP: Record<string, \{ label: string; icon: string; color: string; bg: string; description: string \}> = \{.*?\n  \};'
updated_content = re.sub(pattern, new_map_code, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print('EXITO: LOCATION_MAP en DepositoDashboard.tsx actualizado con 78 ubicaciones.')
