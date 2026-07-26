import { Request, Response } from 'express';
import { WeeklyScheduleService } from '../services/weeklySchedule.service';

export const getWeeklySchedule = async (req: Request, res: Response) => {
  try {
    const data = await WeeklyScheduleService.getWeeklySchedule();
    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error: any) {
    console.error('Error in getWeeklySchedule:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al obtener el cronograma semanal'
    });
  }
};

export const setCurrentWeek = async (req: Request, res: Response) => {
  try {
    const { weekType } = req.body;
    if (!weekType || (weekType !== 'SEMANA_1' && weekType !== 'SEMANA_2')) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe especificar una semana válida (SEMANA_1 o SEMANA_2)'
      });
    }
    const setting = await WeeklyScheduleService.setCurrentWeek(weekType);
    res.status(200).json({
      status: 'success',
      data: setting
    });
  } catch (error: any) {
    console.error('Error in setCurrentWeek:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al cambiar la semana activa'
    });
  }
};

export const createScheduleEntry = async (req: Request, res: Response) => {
  try {
    const { weekType, dayOfWeek, activityType, sellerId, sellerName, location, description, sortOrder } = req.body;
    if (!dayOfWeek || !location) {
      return res.status(400).json({
        status: 'error',
        message: 'El día de la semana y la localidad son obligatorios'
      });
    }
    const entry = await WeeklyScheduleService.createScheduleEntry({
      weekType,
      dayOfWeek,
      activityType,
      sellerId: sellerId ? Number(sellerId) : null,
      sellerName,
      location,
      description,
      sortOrder: sortOrder ? Number(sortOrder) : 0
    });
    res.status(201).json({
      status: 'success',
      data: entry
    });
  } catch (error: any) {
    console.error('Error in createScheduleEntry:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al crear la entrada del cronograma'
    });
  }
};

export const updateScheduleEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { weekType, dayOfWeek, activityType, sellerId, sellerName, location, description, sortOrder, isActive } = req.body;
    const entry = await WeeklyScheduleService.updateScheduleEntry(Number(id), {
      weekType,
      dayOfWeek,
      activityType,
      sellerId: sellerId !== undefined ? (sellerId ? Number(sellerId) : null) : undefined,
      sellerName,
      location,
      description,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      isActive
    });
    res.status(200).json({
      status: 'success',
      data: entry
    });
  } catch (error: any) {
    console.error('Error in updateScheduleEntry:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al actualizar la entrada del cronograma'
    });
  }
};

export const deleteScheduleEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await WeeklyScheduleService.deleteScheduleEntry(Number(id));
    res.status(200).json({
      status: 'success',
      message: 'Entrada eliminada correctamente'
    });
  } catch (error: any) {
    console.error('Error in deleteScheduleEntry:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al eliminar la entrada del cronograma'
    });
  }
};

export const seedDefaultSchedule = async (req: Request, res: Response) => {
  try {
    await WeeklyScheduleService.seedDefaultSchedule();
    const data = await WeeklyScheduleService.getWeeklySchedule();
    res.status(200).json({
      status: 'success',
      message: 'Cronograma restablecido a valores por defecto',
      data
    });
  } catch (error: any) {
    console.error('Error in seedDefaultSchedule:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al restaurar valores por defecto'
    });
  }
};
