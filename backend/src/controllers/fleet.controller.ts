import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { VehicleStatus, MaintenanceType, ExpiryType, TransactionType, PaymentMethod, BillingType } from '@prisma/client';

/**
 * Obtener todos los vehículos de la flota
 */
export async function getVehicles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        maintenances: {
          orderBy: { date: 'desc' },
          take: 10, // Mostrar los últimos 10 mantenimientos en la vista general
          include: {
            supplier: {
              select: { id: true, name: true }
            }
          }
        },
        expirations: {
          orderBy: { expirationDate: 'asc' }
        },
        fuelLogs: {
          orderBy: { odometer: 'desc' },
          take: 10
        }
      },
      orderBy: { brand: 'asc' }
    });

    res.status(200).json({
      status: 'success',
      data: { vehicles }
    });
  } catch (error: any) {
    console.error('Error al obtener vehículos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la flota de vehículos.'
    });
  }
}

/**
 * Crear un nuevo vehículo
 */
export async function createVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { plate, brand, model, year, currentOdometer, status, notes } = req.body;
  const userId = req.user?.id;

  if (!plate || !brand || !model || !year || currentOdometer === undefined) {
    res.status(400).json({
      status: 'error',
      message: 'Patente, marca, modelo, año y kilometraje actual son campos requeridos.'
    });
    return;
  }

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    // Validar patente única
    const existing = await prisma.vehicle.findUnique({
      where: { plate: String(plate).toUpperCase().trim() }
    });

    if (existing) {
      res.status(400).json({
        status: 'error',
        message: `Ya existe un vehículo registrado con la patente ${plate}.`
      });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: String(plate).toUpperCase().trim(),
        brand: String(brand).trim(),
        model: String(model).trim(),
        year: Number(year),
        currentOdometer: Number(currentOdometer),
        status: status as VehicleStatus || VehicleStatus.ACTIVE,
        notes: notes ? String(notes).trim() : null
      }
    });

    await logAudit({
      userId,
      action: 'CREATE_VEHICLE',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      newValues: { plate: vehicle.plate }
    });

    res.status(201).json({
      status: 'success',
      data: { vehicle }
    });
  } catch (error: any) {
    console.error('Error al crear vehículo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar el vehículo.'
    });
  }
}

/**
 * Actualizar un vehículo de la flota
 */
export async function updateVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { brand, model, year, currentOdometer, status, notes } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Vehículo no encontrado.' });
      return;
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        brand: brand ? String(brand).trim() : undefined,
        model: model ? String(model).trim() : undefined,
        year: year ? Number(year) : undefined,
        currentOdometer: currentOdometer !== undefined ? Number(currentOdometer) : undefined,
        status: status as VehicleStatus || undefined,
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined
      }
    });

    await logAudit({
      userId,
      action: 'UPDATE_VEHICLE',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      newValues: { status: vehicle.status, currentOdometer: vehicle.currentOdometer }
    });

    res.status(200).json({
      status: 'success',
      data: { vehicle }
    });
  } catch (error: any) {
    console.error('Error al actualizar vehículo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el vehículo.'
    });
  }
}

/**
 * Eliminar un vehículo de la flota
 */
export async function deleteVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Vehículo no encontrado.' });
      return;
    }

    await prisma.vehicle.delete({
      where: { id }
    });

    await logAudit({
      userId,
      action: 'DELETE_VEHICLE',
      entityType: 'Vehicle',
      entityId: id,
      oldValues: { plate: existing.plate }
    });

    res.status(200).json({
      status: 'success',
      message: 'Vehículo eliminado con éxito de la flota.'
    });
  } catch (error: any) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el vehículo. Verifique que no tenga hojas de reparto asociadas.'
    });
  }
}

/**
 * Registrar un mantenimiento, service o carga de combustible
 */
export async function createMaintenance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const vehicleId = Number(req.params.id);
  const { type, description, cost, odometer, date, supplierId, affectFinance, paymentMethod, bankAccountId, billingType } = req.body;
  const userId = req.user?.id;

  if (!type || !description || cost === undefined || odometer === undefined) {
    res.status(400).json({
      status: 'error',
      message: 'Tipo de mantenimiento, descripción, costo y kilometraje son requeridos.'
    });
    return;
  }

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      res.status(404).json({ status: 'error', message: 'Vehículo no encontrado.' });
      return;
    }

    // Iniciar transacción en la base de datos para asegurar consistencia
    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      // 1. Si afecta finanzas, crear el movimiento contable correspondiente
      if (affectFinance) {
        // Crear la transacción de salida (OUTCOME) exactamente igual que en la Caja Grande (gasto contable verificado global)
        const transaction = await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.OUTCOME,
            paymentMethod: paymentMethod as PaymentMethod || PaymentMethod.CASH,
            billingType: billingType as BillingType || BillingType.INTERNAL,
            amount: Math.round(Number(cost)),
            description: `Gasto de Flota (${vehicle.plate}) - ${description}`,
            verified: true, // Auto-verificada
            personaId: supplierId ? Number(supplierId) : null
          }
        });

        transactionId = transaction.id;
      }

      // 2. Crear el registro del mantenimiento
      const maintenance = await tx.vehicleMaintenance.create({
        data: {
          vehicleId,
          type: type as MaintenanceType,
          description: String(description).trim(),
          cost: Number(cost),
          odometer: Number(odometer),
          date: date ? new Date(date) : new Date(),
          supplierId: supplierId ? Number(supplierId) : null,
          transactionId
        }
      });

      // 3. Actualizar automáticamente el kilometraje actual del vehículo si el cargado es mayor
      if (Number(odometer) > vehicle.currentOdometer) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { currentOdometer: Number(odometer) }
        });
      }

      return { maintenance, transactionId };
    });

    await logAudit({
      userId,
      action: 'CREATE_VEHICLE_MAINTENANCE',
      entityType: 'VehicleMaintenance',
      entityId: result.maintenance.id,
      newValues: { vehicleId, cost: Number(cost), type }
    });

    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    console.error('Error al registrar mantenimiento:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al registrar el mantenimiento en la flota.'
    });
  }
}

/**
 * Registrar un nuevo vencimiento para un vehículo
 */
export async function createExpiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const vehicleId = Number(req.params.id);
  const { type, description, expirationDate } = req.body;
  const userId = req.user?.id;

  if (!type || !description || !expirationDate) {
    res.status(400).json({
      status: 'error',
      message: 'Tipo de vencimiento, descripción y fecha de vencimiento son requeridos.'
    });
    return;
  }

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      res.status(404).json({ status: 'error', message: 'Vehículo no encontrado.' });
      return;
    }

    const expiry = await prisma.vehicleExpiry.create({
      data: {
        vehicleId,
        type: type as ExpiryType,
        description: String(description).trim(),
        expirationDate: new Date(expirationDate)
      }
    });

    await logAudit({
      userId,
      action: 'CREATE_VEHICLE_EXPIRY',
      entityType: 'VehicleExpiry',
      entityId: expiry.id,
      newValues: { vehicleId, type }
    });

    res.status(201).json({
      status: 'success',
      data: { expiry }
    });
  } catch (error: any) {
    console.error('Error al registrar vencimiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar el vencimiento de documentación.'
    });
  }
}

/**
 * Eliminar un mantenimiento/gasto de flota
 */
export async function deleteMaintenance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const maintenanceId = Number(req.params.id);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const maintenance = await prisma.vehicleMaintenance.findUnique({ where: { id: maintenanceId } });
    if (!maintenance) {
      res.status(404).json({ status: 'error', message: 'Mantenimiento no encontrado.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Si tenía una transacción financiera vinculada, eliminarla también
      if (maintenance.transactionId) {
        await tx.transaction.delete({
          where: { id: maintenance.transactionId }
        });
      }

      // 2. Eliminar el mantenimiento
      await tx.vehicleMaintenance.delete({
        where: { id: maintenanceId }
      });
    });

    await logAudit({
      userId,
      action: 'DELETE_VEHICLE_MAINTENANCE',
      entityType: 'VehicleMaintenance',
      entityId: maintenanceId,
      oldValues: { cost: Number(maintenance.cost) }
    });

    res.status(200).json({
      status: 'success',
      message: 'Mantenimiento y su transacción contable asociada eliminados con éxito.'
    });
  } catch (error: any) {
    console.error('Error al eliminar mantenimiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el registro de mantenimiento.'
    });
  }
}

/**
 * Eliminar un vencimiento de la lista
 */
export async function deleteExpiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const expiryId = Number(req.params.id);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const existing = await prisma.vehicleExpiry.findUnique({ where: { id: expiryId } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Registro de vencimiento no encontrado.' });
      return;
    }

    await prisma.vehicleExpiry.delete({ where: { id: expiryId } });

    await logAudit({
      userId,
      action: 'DELETE_VEHICLE_EXPIRY',
      entityType: 'VehicleExpiry',
      entityId: expiryId,
      oldValues: { type: existing.type }
    });

    res.status(200).json({
      status: 'success',
      message: 'Vencimiento de documentación eliminado con éxito.'
    });
  } catch (error: any) {
    console.error('Error al eliminar vencimiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el registro de vencimiento.'
    });
  }
}
