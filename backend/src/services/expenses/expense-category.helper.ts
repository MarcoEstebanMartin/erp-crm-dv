import { DEFAULT_EXPENSE_CATEGORIES } from './expense.service';

type CategoryClient = {
  expenseCategory?: {
    findMany: () => Promise<Array<{ id: number; name: string }>>;
    createMany?: (args: { data: typeof DEFAULT_EXPENSE_CATEGORIES }) => Promise<unknown>;
  };
};

export function inferCategoryNameFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('sueldo')) return 'Sueldos';
  if (lower.includes('patronal')) return 'Cargas Patronales';
  if (
    lower.includes('claro') ||
    lower.includes('gas') ||
    lower.includes('luz') ||
    lower.includes('flow') ||
    lower.includes('internet') ||
    lower.includes('servicio')
  ) {
    return 'Servicios';
  }
  if (lower.includes('combustible') || lower.includes('nafta') || lower.includes('gasoil')) {
    return 'Combustible';
  }
  if (lower.includes('seguro') || lower.includes('seg.')) return 'Seguros';
  if (lower.includes('mantenimiento') || lower.includes('service') || lower.includes('reparaci') || lower.includes('cubierta')) {
    return 'Mantenimiento';
  }
  if (lower.includes('contador') || lower.includes('iduo') || lower.includes('profesional')) {
    return 'Gastos Profesionales';
  }
  if (lower.includes('facebook') || lower.includes('publicidad') || lower.includes('radio')) {
    return 'Publicidad y Comunicación';
  }
  if (lower.includes('banco') || lower.includes('bancario')) return 'Gastos Bancarios';
  if (
    lower.includes('impuesto') ||
    lower.includes('patente') ||
    lower.includes('iva') ||
    lower.includes('ganancia') ||
    lower.includes('personales') ||
    lower.includes('arba') ||
    lower.includes('municipal') ||
    lower.includes('abl') ||
    lower.includes('ingresos brutos')
  ) {
    return 'Impuestos y Patentes';
  }
  return 'Otros Gastos';
}

export async function resolveExpenseCategoryId(
  client: CategoryClient,
  preferredNameOrText: string,
): Promise<number | null> {
  if (!client.expenseCategory?.findMany) return null;

  let categories = await client.expenseCategory.findMany();
  if (categories.length === 0 && client.expenseCategory.createMany) {
    await client.expenseCategory.createMany({ data: DEFAULT_EXPENSE_CATEGORIES });
    categories = await client.expenseCategory.findMany();
  }
  if (categories.length === 0) return null;

  const targetName = inferCategoryNameFromText(preferredNameOrText).toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === targetName);
  if (exact) return exact.id;

  const direct = categories.find((c) => c.name.toLowerCase() === preferredNameOrText.toLowerCase());
  if (direct) return direct.id;

  const otros = categories.find((c) => c.name.toLowerCase().includes('otros'));
  return otros?.id ?? categories[0].id;
}
