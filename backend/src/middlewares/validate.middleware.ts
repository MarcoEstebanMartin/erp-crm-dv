import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export function validateRequest(schema: ZodType<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body) req.body = parsed.body;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default validateRequest;
