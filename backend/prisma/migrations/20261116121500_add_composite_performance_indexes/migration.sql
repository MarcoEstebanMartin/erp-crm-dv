-- Asegurar existencia de la secuencia unificada de movimientos (Regla 5)
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- Índices compuestos para acelerar consultas de Clientes, Deudores, Inicio y Paginación de Pedidos
CREATE INDEX IF NOT EXISTS "Persona_isClient_isActive_name_idx" ON "Persona"("isClient", "isActive", "name");
CREATE INDEX IF NOT EXISTS "Persona_isClient_outstandingBalance_idx" ON "Persona"("isClient", "outstandingBalance");

CREATE INDEX IF NOT EXISTS "Order_status_createdAt_id_idx" ON "Order"("status", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "Order_sellerId_status_createdAt_idx" ON "Order"("sellerId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_createdAt_id_idx" ON "Order"("createdAt", "id");

CREATE INDEX IF NOT EXISTS "Transaction_personaId_type_orderId_idx" ON "Transaction"("personaId", "type", "orderId");
CREATE INDEX IF NOT EXISTS "Transaction_orderId_type_idx" ON "Transaction"("orderId", "type");

CREATE INDEX IF NOT EXISTS "CreditNote_personaId_status_orderId_idx" ON "CreditNote"("personaId", "status", "orderId");
CREATE INDEX IF NOT EXISTS "CreditNote_orderId_status_idx" ON "CreditNote"("orderId", "status");
