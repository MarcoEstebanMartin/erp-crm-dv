import multer from 'multer';
import { Request } from 'express';

// Filtro para validar tipos de archivos de imagen
const imageFileFilter = (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Tipo de archivo no válido. Solo se permiten imágenes JPEG, PNG y WEBP.'));
  }
};

// Filtro para validar archivos ZIP (exige extensión .zip real Y MIME compatible)
const zipFileFilter = (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
  ];
  const isZipExtension = file.originalname.toLowerCase().endsWith('.zip');

  if (isZipExtension && allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Tipo de archivo no válido. Solo se permiten archivos comprimidos .zip.'));
  }
};

// Filtro para validar planillas seguras (.xlsx o .csv)
const excelFileFilter = (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const lowerName = file.originalname.toLowerCase();
  if (lowerName.endsWith('.xls')) {
    callback(
      new Error(
        'El formato antiguo .xls está deshabilitado por seguridad. Guardá la planilla como .xlsx o .csv.',
      ),
    );
    return;
  }
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv')) {
    callback(null, true);
  } else {
    callback(new Error('Formato no permitido. Solo se aceptan planillas .xlsx o .csv.'));
  }
};

const storage = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
}).single('image');

export const uploadZipFile = multer({
  storage,
  fileFilter: zipFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
}).single('file');

export const uploadExcelFile = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
}).single('file');
