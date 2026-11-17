import { Request, Response, NextFunction } from 'express';
import { parseVendedorOrderWithAi } from '../services/orders/order-ai-parser.service';

export const parseAiOrderHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await parseVendedorOrderWithAi(req.body);
    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
