-- Asegurar existencia de la secuencia unificada de movimientos (Regla 5)
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- AlterTable OrderItem: incorporar Snapshots históricos inmutables de Costo, Precio de Lista y Descuento (Spec 01 Sección 3)
ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "unitCostSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "listPriceSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "discountPctSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- Backfill seguro: poblar los snapshots en renglones históricos existentes usando el costo actual del producto y el unitPrice vendido
UPDATE "OrderItem" oi
SET
  "unitCostSnapshot" = COALESCE(p."costPrice", 0.00),
  "listPriceSnapshot" = oi."unitPrice",
  "discountPctSnapshot" = 0.00
FROM "Product" p
WHERE oi."productId" = p."id"
  AND oi."unitCostSnapshot" = 0.00
  AND oi."listPriceSnapshot" = 0.00;
