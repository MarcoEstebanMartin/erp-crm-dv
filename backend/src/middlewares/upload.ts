import multer from 'multer';
import { Request } from 'express';

// Filtro para validar tipos de archivos de imagen
const imageFileFilter = (req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Tipo de archivo no válido. Solo se permiten imágenes JPEG, PNG y WEBP.'));
  }
};

// Filtro para validar archivos ZIP
const zipFileFilter = (req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
  const isZipExtension = file.originalname.toLowerCase().endsWith('.zip');
  
  if (allowedMimeTypes.includes(file.mimetype) || isZipExtension) {
    callback(null, true);
  } else {
    callback(new Error('Tipo de archivo no válido. Solo se permiten archivos comprimidos ZIP.'));
  }
};

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Middleware para una sola imagen
export const uploadSingleImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB
  },
}).single('image');

// Middleware para archivo ZIP
export const uploadZipFile = multer({
  storage,
  fileFilter: zipFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // Limite de 50MB
  },
}).single('file');
