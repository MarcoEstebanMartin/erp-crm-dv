import re

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'const [selectedSector, setSelectedSector]' not in content:
    content = content.replace(
        "const [selectedSlot, setSelectedSlot] = useState<any | null>(null);",
        "const [selectedSlot, setSelectedSlot] = useState<any | null>(null);\n  const [selectedSector, setSelectedSector] = useState<string>('ALL');"
    )

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("EXITO: Estado selectedSector agregado a DepositoDashboard.tsx.")
