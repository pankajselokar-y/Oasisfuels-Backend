import multer from 'multer';
import { MAX_PHOTO_BYTES } from '../config/constants.js';

/** Photos are held in memory just long enough to be verified and written to UPLOAD_DIR. */
export const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
}).single('photo');
