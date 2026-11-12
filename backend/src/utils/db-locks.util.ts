import { Prisma } from '@prisma/client';

/**
 * Adquiere bloqueo exclusivo de fila (`SELECT ... FOR UPDATE`) sobre productos en PostgreSQL
 * dentro de una transacción interactiva `prisma.$transaction`.
 *
 * - Ordena los IDs de menor a mayor para eliminar cualquier riesgo de deadlock entre
 *   transacciones concurrentes (ej. dos conteos rápidos o ventas simultáneas).
 * - Si `tx` es un mock liviano en tests unitarios sin `$queryRaw`, hace no-op de forma segura.
 */
export async function lockProductsForUpdate(
  tx: Prisma.TransactionClient | Record<string, any>,
  productIds: number[],
): Promise<void> {
  const sortedUniqueIds = Array.from(
    new Set(
      productIds
        .map((id) => Math.trunc(Number(id)))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ).sort((a, b) => a - b);

  if (sortedUniqueIds.length === 0) return;
  if (typeof (tx as any).$queryRaw !== 'function') return;

  await (tx as Prisma.TransactionClient).$queryRaw(
    Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(sortedUniqueIds)}) ORDER BY id ASC FOR UPDATE`,
  );
}
