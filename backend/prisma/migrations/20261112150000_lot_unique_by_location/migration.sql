-- =============================================================================
-- Modelo de Lotes Limpio: identidad física única por (productId, lotNumber, location)
-- Reemplaza @@unique([productId, lotNumber]) que obligaba a fabricar sufijos técnicos
-- (ej. 'S/L@D1-R01-C04-C', 'S/L-D1-R01-C04-A') al repartir un lote en varios racks.
-- Regla 5 AGENTS.md: CERO DROP SEQUENCE / DROP TABLE. movement_seq intacta.
-- =============================================================================

-- 1) Retirar la clave única antigua (productId, lotNumber)
DROP INDEX IF EXISTS "ProductLot_productId_lotNumber_key";

-- 2) Normalización defensiva de ubicaciones vacías
UPDATE "ProductLot" SET "location" = 'S/U' WHERE "location" IS NULL OR BTRIM("location") = '';

-- 3) Calcular el código de lote limpio de cada fila (quita '@SLOT' y 'S/L-SLOT')
CREATE TEMP TABLE "_lot_norm" AS
SELECT
  pl."id",
  pl."productId",
  pl."location",
  pl."lotNumber",
  CASE
    WHEN BTRIM(SPLIT_PART(pl."lotNumber", '@', 1)) = '' THEN 'S/L'
    WHEN UPPER(BTRIM(SPLIT_PART(pl."lotNumber", '@', 1))) ~ '^S/L(-.*)?$' THEN 'S/L'
    ELSE BTRIM(SPLIT_PART(pl."lotNumber", '@', 1))
  END AS "cleanLot"
FROM "ProductLot" pl;

-- 4) Por cada grupo (productId, cleanLot, location) elegir la fila sobreviviente:
--    prioriza la que ya tiene el código limpio y luego el id más antiguo.
CREATE TEMP TABLE "_lot_map" AS
SELECT
  n."id" AS "oldId",
  FIRST_VALUE(n."id") OVER (
    PARTITION BY n."productId", n."cleanLot", n."location"
    ORDER BY (n."lotNumber" = n."cleanLot") DESC, n."id" ASC
  ) AS "keepId"
FROM "_lot_norm" n;

-- 5) Fusión hipotética de duplicados (en la DB real hoy no hay colisiones; blindaje defensivo)
UPDATE "ProductLot" keep
SET "stock" = keep."stock" + agg."extraStock"
FROM (
  SELECT m."keepId", SUM(pl."stock") AS "extraStock"
  FROM "_lot_map" m
  JOIN "ProductLot" pl ON pl."id" = m."oldId"
  WHERE m."oldId" <> m."keepId"
  GROUP BY m."keepId"
) agg
WHERE keep."id" = agg."keepId";

UPDATE "StockMovement" sm
SET "productLotId" = m."keepId"
FROM "_lot_map" m
WHERE sm."productLotId" = m."oldId" AND m."oldId" <> m."keepId";

UPDATE "OrderItemLot" oil
SET "productLotId" = m."keepId"
FROM "_lot_map" m
WHERE oil."productLotId" = m."oldId" AND m."oldId" <> m."keepId";

DELETE FROM "ProductLot" pl
USING "_lot_map" m
WHERE pl."id" = m."oldId" AND m."oldId" <> m."keepId";

-- 6) Limpiar el código de lote de las filas sobrevivientes (ej. id 1115: 'S/L@D1-R01-C04-C' -> 'S/L')
UPDATE "ProductLot" pl
SET "lotNumber" = n."cleanLot"
FROM "_lot_norm" n
WHERE pl."id" = n."id" AND pl."lotNumber" <> n."cleanLot";

-- (Las tablas TEMP "_lot_norm"/"_lot_map" son de sesión y PostgreSQL las descarta solas al cerrar la conexión.)

-- 7) Nueva clave única física
CREATE UNIQUE INDEX "ProductLot_productId_lotNumber_location_key" ON "ProductLot"("productId", "lotNumber", "location");
