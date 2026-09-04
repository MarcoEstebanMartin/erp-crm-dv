import os
import shutil
import json

def restore():
    fotos_dir = r'C:\Users\Usuario\Desktop\ERP-CRM DV\ARCHIVOS\fotos\Productos'
    uploads_dir = r'C:\Users\Usuario\Desktop\ERP-CRM DV\backend\uploads\products'
    temp_restore = r'C:\Users\Usuario\Desktop\ERP-CRM DV\ARCHIVOS\fotos\Productos_restored'

    if not os.path.exists(temp_restore):
        print("❌ Carpeta temporal no encontrada")
        return

    # Limpiar y reemplazar fotos_dir
    for f in os.listdir(fotos_dir):
        try:
            os.remove(os.path.join(fotos_dir, f))
        except Exception:
            pass

    for f in os.listdir(temp_restore):
        shutil.copy2(os.path.join(temp_restore, f), os.path.join(fotos_dir, f))

    shutil.rmtree(temp_restore)

    # Copiar fotos a uploads_dir
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir, exist_ok=True)
    else:
        for f in os.listdir(uploads_dir):
            try:
                os.remove(os.path.join(uploads_dir, f))
            except Exception:
                pass

    for f in os.listdir(fotos_dir):
        shutil.copy2(os.path.join(fotos_dir, f), os.path.join(uploads_dir, f))

    print(f"✅ Se restauraron {len(os.listdir(fotos_dir))} fotos originales en ARCHIVOS/fotos/Productos y backend/uploads/products")

if __name__ == '__main__':
    restore()
