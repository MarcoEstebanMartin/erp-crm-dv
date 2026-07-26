import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_WEEKLY_SCHEDULE = [
  // SEMANA 1
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'LUNES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'América',
    description: 'Preventa presencial en comercios y autoservicios de América',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'LUNES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'General Villegas y Bunge',
    description: 'Entrega de pedidos zona Villegas Centro y Bunge',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'MARTES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'General Villegas',
    description: 'Preventa clientes recurrentes Villegas',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'MARTES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'América y Sansinena',
    description: 'Reparto de pedidos cargados el lunes',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'MIERCOLES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'Carlos Tejedor y Timote',
    description: 'Ruta Tejedor - atención a almacenes y distribuidores',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'MIERCOLES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'General Villegas',
    description: 'Reparto urbano General Villegas',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'JUEVES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'Piedritas y Blaquier',
    description: 'Preventa Ruta 33 Norte',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'JUEVES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'Carlos Tejedor',
    description: 'Entrega de mercadería en Tejedor',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'VIERNES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'Trenque Lauquen / Villegas',
    description: 'Cierre de pedidos semana y preventa especial',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'VIERNES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'Piedritas y Bunge',
    description: 'Reparto final de preventa jueves',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_1',
    dayOfWeek: 'SABADO',
    activityType: 'AMBOS',
    sellerName: 'Depósito & Ventas',
    location: 'General Villegas (Local)',
    description: 'Atención en mostrador y armado de congelados / lacteos',
    sortOrder: 1
  },

  // SEMANA 2
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'LUNES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'América y Roosevelt',
    description: 'Preventa zona América y localidades vecinas',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'LUNES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'General Villegas',
    description: 'Reparto local General Villegas',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'MARTES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'Banderaló y Buchardo',
    description: 'Visitas y toma de pedidos en Banderaló y Buchardo',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'MARTES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'América',
    description: 'Reparto de cargas de lunes',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'MIERCOLES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'General Villegas Centro',
    description: 'Preventa grandes cuentas y supermercados',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'MIERCOLES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'Banderaló y Buchardo',
    description: 'Reparto de preventa del martes',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'JUEVES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'Charlone y Santa Regina',
    description: 'Preventa pueblos del oeste',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'JUEVES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'Villegas Centro',
    description: 'Reparto pedidos del miércoles',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'VIERNES',
    activityType: 'PREVENTA',
    sellerName: 'Fabián',
    location: 'Emilio V. Bunge y Villa Saboya',
    description: 'Preventa final de la semana',
    sortOrder: 1
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'VIERNES',
    activityType: 'REPARTO',
    sellerName: 'Reparto General',
    location: 'Charlone y Santa Regina',
    description: 'Reparto preventa del jueves',
    sortOrder: 2
  },
  {
    weekType: 'SEMANA_2',
    dayOfWeek: 'SABADO',
    activityType: 'AMBOS',
    sellerName: 'Depósito & Cobranzas',
    location: 'General Villegas (Local)',
    description: 'Balance de caja y reparto express de contingencia',
    sortOrder: 1
  }
];

export class WeeklyScheduleService {
  /**
   * Obtiene la lista completa del cronograma y la semana activa actual
   */
  static async getWeeklySchedule() {
    let currentWeekSetting = await prisma.systemSetting.findUnique({
      where: { key: 'current_week' }
    });

    if (!currentWeekSetting) {
      currentWeekSetting = await prisma.systemSetting.create({
        data: {
          key: 'current_week',
          value: 'SEMANA_1'
        }
      });
    }

    let items = await prisma.weeklySchedule.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { id: 'asc' }
      ]
    });

    // Si la base está vacía, sembrar los datos iniciales
    if (items.length === 0) {
      await this.seedDefaultSchedule();
      items = await prisma.weeklySchedule.findMany({
        where: { isActive: true },
        orderBy: [
          { sortOrder: 'asc' },
          { id: 'asc' }
        ]
      });
    }

    return {
      currentWeek: currentWeekSetting.value,
      items
    };
  }

  /**
   * Actualiza la semana activa de referencia (SEMANA_1 o SEMANA_2)
   */
  static async setCurrentWeek(weekType: string) {
    const validWeek = weekType === 'SEMANA_2' ? 'SEMANA_2' : 'SEMANA_1';
    const setting = await prisma.systemSetting.upsert({
      where: { key: 'current_week' },
      update: { value: validWeek },
      create: { key: 'current_week', value: validWeek }
    });
    return setting;
  }

  /**
   * Crear una nueva entrada en el cronograma
   */
  static async createScheduleEntry(data: {
    weekType: string;
    dayOfWeek: string;
    activityType: string;
    sellerId?: number | null;
    sellerName?: string | null;
    location: string;
    description?: string | null;
    sortOrder?: number;
  }) {
    return await prisma.weeklySchedule.create({
      data: {
        weekType: data.weekType || 'SEMANA_1',
        dayOfWeek: data.dayOfWeek.toUpperCase(),
        activityType: data.activityType || 'PREVENTA',
        sellerId: data.sellerId || null,
        sellerName: data.sellerName || null,
        location: data.location.trim(),
        description: data.description ? data.description.trim() : null,
        sortOrder: data.sortOrder || 0
      }
    });
  }

  /**
   * Actualizar una entrada existente
   */
  static async updateScheduleEntry(id: number, data: {
    weekType?: string;
    dayOfWeek?: string;
    activityType?: string;
    sellerId?: number | null;
    sellerName?: string | null;
    location?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return await prisma.weeklySchedule.update({
      where: { id },
      data: {
        ...(data.weekType && { weekType: data.weekType }),
        ...(data.dayOfWeek && { dayOfWeek: data.dayOfWeek.toUpperCase() }),
        ...(data.activityType && { activityType: data.activityType }),
        ...(data.sellerId !== undefined && { sellerId: data.sellerId }),
        ...(data.sellerName !== undefined && { sellerName: data.sellerName }),
        ...(data.location && { location: data.location.trim() }),
        ...(data.description !== undefined && { description: data.description ? data.description.trim() : null }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      }
    });
  }

  /**
   * Eliminar (soft delete o hard delete) una entrada
   */
  static async deleteScheduleEntry(id: number) {
    return await prisma.weeklySchedule.delete({
      where: { id }
    });
  }

  /**
   * Sembrar datos por defecto
   */
  static async seedDefaultSchedule() {
    await prisma.weeklySchedule.deleteMany({});
    for (const item of DEFAULT_WEEKLY_SCHEDULE) {
      await prisma.weeklySchedule.create({
        data: item
      });
    }
  }
}
