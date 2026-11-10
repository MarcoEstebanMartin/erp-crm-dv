# Modelo de Datos y Contratos API: 002 - Libro Mayor de Stock y Mapa de Depósito

> **Fase Spec-Kit**: `2A. Data Model (Tablas Prisma + Contratos Zod)`
> **Esquema**: PostgreSQL (`NUMERIC(12, 3)` y `NUMERIC(14, 2)`) + `Zod` estricto.

---

## 1. Modelos de Base de Datos (`backend/prisma/schema.prisma`)

```prisma
model ProductLot {
  id             Int       @id @default(autoincrement())
  productId      Int       @map("product_id")
  sku            String    @db.VarChar(32)
  lotNumber      String    @default("S/L") @map("lot_number") @db.VarChar(64)
  expirationDate String    @default("2036-12-31") @map("expiration_date") @db.VarChar(16)
  locationSlot   String?   @map("location_slot") @db.VarChar(32) // Ej: "D1-R01-C07-A"
  quantity       Int       @default(0) // Unidades / piezas físicas
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@unique([sku, lotNumber, locationSlot])
  @@index([sku])
  @@index([locationSlot])
  @@map("product_lots")
}

model StockLedger {
  id              Int      @id @default(autoincrement())
  sku             String   @db.VarChar(32)
  productName     String   @map("product_name") @db.VarChar(180)
  movementType    String   @map("movement_type") @db.VarChar(24) // IN | OUT | ADJUSTMENT | TRANSFER
  lotNumber       String   @default("S/L") @map("lot_number") @db.VarChar(64)
  expirationDate  String   @default("2036-12-31") @map("expiration_date") @db.VarChar(16)
  locationSlot    String?  @map("location_slot") @db.VarChar(32)
  previousStock   Int      @map("previous_stock")
  quantityDelta   Int      @map("quantity_delta")
  resultingStock  Int      @map("resulting_stock")
  unitCostSnapshot Decimal @map("unit_cost_snapshot") @db.Decimal(14, 2)
  reason          String   @db.VarChar(240)
  performedBy     String   @default("ADMIN") @map("performed_by") @db.VarChar(64)
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([sku, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
  @@map("stock_ledger")
}
```

---

## 2. Contratos de Validación `Zod` (`backend/src/modules/stock/stock.schema.ts`)

### 2.1 Ajuste Individual de Stock (`POST /api/stock/adjust`)
```typescript
export const AdjustStockSchema = z.object({
  sku: z.string().trim().min(1),
  quantityDelta: z.number().int().refine((n) => n !== 0, 'La diferencia no puede ser 0'),
  reason: z.string().trim().min(2).max(240).default('Ajuste manual administrativo'),
  lotNumber: z.string().trim().min(1).max(64).default('S/L'),
  expirationDate: z.string().trim().default('2036-12-31'),
  locationSlot: z.string().trim().max(32).nullable().optional(),
});
```

### 2.2 Inventario Rápido en Lote (`POST /api/stock/quick-inventory`)
```typescript
export const QuickInventoryBatchSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string().trim().min(1),
      lotId: z.number().int().optional(),
      lotNumber: z.string().trim().default('S/L'),
      expirationDate: z.string().trim().default('2036-12-31'),
      locationSlot: z.string().trim().nullable().optional(),
      targetQuantity: z.number().int().min(0),
    })
  ).min(1),
  reason: z.string().trim().default('Ajuste rápido de inventario'),
});
```

### 2.3 Asignación / Ubicación en Slot del Mapa (`POST /api/stock/slot-assign`)
```typescript
export const AssignSlotStockSchema = z.object({
  sku: z.string().trim().min(1),
  locationSlot: z.string().trim().min(3).max(32), // Ej: D1-R06-C07-A
  quantity: z.number().int().min(0),
  lotNumber: z.string().trim().default('S/L'),
  expirationDate: z.string().trim().default('2036-12-31'),
});
```
